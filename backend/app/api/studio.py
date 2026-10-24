"""
Video Studio API — Creator-only video editing workspace
=======================================================
All endpoints require role="creator".
Creators can only access their own projects, assets, and render jobs.

Routes:
  /api/creator/studio/projects        — CRUD projects
  /api/creator/studio/assets          — upload / list / delete media
  /api/creator/studio/render-jobs     — start / poll / cancel exports
  /api/creator/studio/submit/{job_id} — submit completed render for admin review
"""
import os
import json
import uuid
import threading
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File,
    Form, Query, BackgroundTasks, Request
)
from fastapi.responses import FileResponse, StreamingResponse
from app.services import media_probe
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import require_role, decode_token
from app.models.user import User
from app.models.order import Order
from app.models.studio import StudioProject, StudioAsset, StudioRenderJob
from app.models.delivery import DeliverySubmission
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/creator/studio", tags=["studio"])

_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
STUDIO_ASSET_DIR  = os.path.join(_BASE, "private_uploads", "studio", "assets")
STUDIO_RENDER_DIR = os.path.join(_BASE, "private_uploads", "studio", "renders")

for _d in (STUDIO_ASSET_DIR, STUDIO_RENDER_DIR):
    os.makedirs(_d, exist_ok=True)

ALLOWED_VIDEO_EXT  = {".mp4", ".webm", ".mov"}
ALLOWED_IMAGE_EXT  = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
ALLOWED_AUDIO_EXT  = {".mp3", ".wav", ".ogg", ".aac", ".m4a"}
ALLOWED_VIDEO_MIME = {"video/mp4", "video/webm", "video/quicktime"}
ALLOWED_IMAGE_MIME = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_AUDIO_MIME = {"audio/mpeg", "audio/wav", "audio/ogg", "audio/aac", "audio/mp4", "audio/x-m4a"}

MAX_ASSET_MB = int(os.environ.get("MAX_STUDIO_ASSET_MB", "500"))
MAX_ASSET_BYTES = MAX_ASSET_MB * 1024 * 1024

_media_sec = HTTPBearer(auto_error=False)

def _get_creator_for_media(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_media_sec),
    db: Session = Depends(get_db),
) -> User:
    raw = (credentials.credentials if credentials else None) or token
    if not raw:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(raw)
    if not payload or not payload.get("sub"):
        raise HTTPException(401, "Invalid token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_blocked:
        raise HTTPException(403, "Account blocked")
    if user.role != "creator":
        raise HTTPException(403, "Creator access only")
    return user

def _require_own_project(project_id: int, creator: User, db: Session) -> StudioProject:
    p = db.query(StudioProject).filter(
        StudioProject.id == project_id,
        StudioProject.creator_id == creator.id,
        StudioProject.is_deleted == False,  # noqa
    ).first()
    if not p:
        raise HTTPException(404, "Project not found")
    return p

def _format_project(p: StudioProject) -> dict:
    return {
        "id": p.id,
        "creator_id": p.creator_id,
        "order_id": p.order_id,
        "title": p.title,
        "aspect_ratio": p.aspect_ratio,
        "duration": p.duration,
        "timeline_json": p.timeline_json,
        "output_settings_json": p.output_settings_json,
        "revision_number": p.revision_number,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }

def _format_asset(a: StudioAsset) -> dict:
    return {
        "id": a.id,
        "creator_id": a.creator_id,
        "project_id": a.project_id,
        "media_type": a.media_type,
        "original_filename": a.original_filename,
        "detected_content_type": a.detected_content_type,
        "file_size": a.file_size,
        "duration": a.duration,
        "width": a.width,
        "height": a.height,
        "metadata_json": a.metadata_json,
        **_probe_fields(a),
        "created_at": a.created_at.isoformat() if a.created_at else None,
    }

def _probe_fields(a: StudioAsset) -> dict:
    """Read back the stored probe results. Unknown stays None, never False."""
    try:
        probe = (json.loads(a.metadata_json or "{}") or {}).get("probe") or {}
    except (ValueError, TypeError):
        probe = {}
    return {
        "has_video_track": probe.get("has_video_track"),
        "has_audio_track": probe.get("has_audio_track"),
        "video_codec": probe.get("video_codec"),
        "audio_codec": probe.get("audio_codec"),
        "probe_note": probe.get("note"),
    }

def _format_job(j: StudioRenderJob) -> dict:
    return {
        "id": j.id,
        "project_id": j.project_id,
        "creator_id": j.creator_id,
        "project_revision": j.project_revision,
        "status": j.status,
        "progress": j.progress,
        "error_message": j.error_message,
        "output_ready": bool(j.output_storage_key and j.status == "completed"),
        "output_file_size": j.output_file_size,
        "delivery_submission_id": j.delivery_submission_id,
        "started_at": j.started_at.isoformat() if j.started_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
        "created_at": j.created_at.isoformat() if j.created_at else None,
    }

@router.get("/projects")
def list_projects(
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """List all non-deleted studio projects for this creator."""
    projects = db.query(StudioProject).filter(
        StudioProject.creator_id == creator.id,
        StudioProject.is_deleted == False,  # noqa
    ).order_by(StudioProject.updated_at.desc()).all()
    return [_format_project(p) for p in projects]

@router.post("/projects")
def create_project(
    body: dict,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Create a new studio project, optionally linked to an order."""
    title = str(body.get("title") or "Untitled Project")[:255]
    order_id = body.get("order_id")
    aspect_ratio = body.get("aspect_ratio", "16:9")
    if aspect_ratio not in ("16:9", "9:16", "1:1"):
        aspect_ratio = "16:9"

    if order_id:
        order = db.query(Order).filter(
            Order.id == order_id,
            Order.creator_id == creator.id,
        ).first()
        if not order:
            raise HTTPException(400, "Order not found or not assigned to you")

    p = StudioProject(
        creator_id=creator.id,
        order_id=order_id,
        title=title,
        aspect_ratio=aspect_ratio,
        timeline_json="{}",
        output_settings_json=json.dumps({
            "format": "mp4",
            "resolution": "720p",
            "aspect_ratio": aspect_ratio,
        }),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return _format_project(p)

@router.get("/projects/{project_id}")
def get_project(
    project_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    p = _require_own_project(project_id, creator, db)
    result = _format_project(p)
    assets = db.query(StudioAsset).filter(
        StudioAsset.project_id == project_id,
        StudioAsset.creator_id == creator.id,
        StudioAsset.is_deleted == False,  # noqa
    ).all()
    result["assets"] = [_format_asset(a) for a in assets]
    return result

@router.patch("/projects/{project_id}")
def update_project(
    project_id: int,
    body: dict,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Save project state (timeline, title, settings).
    Increments revision_number when timeline_json changes.
    """
    p = _require_own_project(project_id, creator, db)

    changed = False
    if "title" in body:
        setattr(p, "title", str(body["title"])[:255])
        changed = True
    if "aspect_ratio" in body and body["aspect_ratio"] in ("16:9", "9:16", "1:1"):
        setattr(p, "aspect_ratio", body["aspect_ratio"])
        changed = True
    if "duration" in body:
        setattr(p, "duration", float(body["duration"] or 0))
        changed = True
    if "timeline_json" in body:
        new_tl = body["timeline_json"]
        if isinstance(new_tl, dict):
            new_tl = json.dumps(new_tl)
        if new_tl != p.timeline_json:
            setattr(p, "timeline_json", new_tl)
            setattr(p, "revision_number", (p.revision_number or 1) + 1)
        changed = True
    if "output_settings_json" in body:
        ose = body["output_settings_json"]
        if isinstance(ose, dict):
            ose = json.dumps(ose)
        setattr(p, "output_settings_json", ose)
        changed = True

    if changed:
        db.commit()
        db.refresh(p)
    return _format_project(p)

@router.delete("/projects/{project_id}")
def delete_project(
    project_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Soft-delete a project."""
    p = _require_own_project(project_id, creator, db)
    setattr(p, "is_deleted", True)
    db.commit()
    return {"deleted": True, "project_id": project_id}

@router.post("/projects/{project_id}/duplicate")
def duplicate_project(
    project_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Duplicate a project as a new draft."""
    src = _require_own_project(project_id, creator, db)
    dup = StudioProject(
        creator_id=creator.id,
        order_id=None,  # duplication detaches from order
        title=f"Copy of {src.title}"[:255],
        aspect_ratio=src.aspect_ratio,
        duration=src.duration,
        timeline_json=src.timeline_json,
        output_settings_json=src.output_settings_json,
        revision_number=1,
    )
    db.add(dup)
    db.commit()
    db.refresh(dup)
    return _format_project(dup)

@router.get("/my-orders")
def get_eligible_orders(
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Return orders assigned to this creator that are eligible for Studio work."""
    orders = db.query(Order).filter(
        Order.creator_id == creator.id,
        Order.status.in_(["accepted", "in_progress", "revision_requested", "assigned", "delivered"]),
    ).order_by(Order.created_at.desc()).all()
    return [
        {
            "id": o.id,
            "title": o.title,
            "status": o.status,
            "budget": o.budget,
            "deadline": o.deadline.isoformat() if o.deadline else None,
        }
        for o in orders
    ]

@router.post("/assets")
async def upload_asset(
    project_id: Optional[int] = Form(None),
    media_type: str = Form(...),           # "video" | "image" | "audio"
    file: UploadFile = File(...),
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Upload a media asset. Validates type and size. Stores privately."""
    if media_type not in ("video", "image", "audio"):
        raise HTTPException(400, "media_type must be 'video', 'image', or 'audio'")

    orig = file.filename or "upload"
    ext = os.path.splitext(orig)[1].lower()

    allowed_ext = {
        "video": ALLOWED_VIDEO_EXT,
        "image": ALLOWED_IMAGE_EXT,
        "audio": ALLOWED_AUDIO_EXT,
    }[media_type]

    if ext not in allowed_ext:
        raise HTTPException(400, f"Unsupported {media_type} format '{ext}'")

    data = await file.read()
    if len(data) > MAX_ASSET_BYTES:
        raise HTTPException(413, f"File exceeds the {MAX_ASSET_MB} MB limit")

    if project_id:
        _require_own_project(project_id, creator, db)

    mime_map = {
        ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
        ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
        ".webp": "image/webp", ".gif": "image/gif",
        ".mp3": "audio/mpeg", ".wav": "audio/wav", ".ogg": "audio/ogg",
        ".aac": "audio/aac", ".m4a": "audio/mp4",
    }
    mime = mime_map.get(ext, "application/octet-stream")

    info = {}
    probe_note = None
    if media_type in ("video", "audio"):
        info = media_probe.probe(data, mime, orig)
        playable, reason = media_probe.is_browser_playable(info, media_type)
        if not playable:
            raise HTTPException(status_code=400, detail=reason)
        probe_note = info.get("probe_note")

    storage_key = f"creator_{creator.id}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(STUDIO_ASSET_DIR, storage_key)
    with open(path, "wb") as f:
        f.write(data)

    written = os.path.getsize(path)
    if written != len(data):
        os.remove(path)
        raise HTTPException(
            status_code=500,
            detail=f"Upload was incomplete ({written} of {len(data)} bytes stored). Please try again.",
        )

    metadata = {
        "probe": {
            "has_video_track": info.get("has_video_track"),
            "has_audio_track": info.get("has_audio_track"),
            "video_codec": info.get("video_codec"),
            "audio_codec": info.get("audio_codec"),
            "note": probe_note,
        }
    } if info else {}

    asset = StudioAsset(
        creator_id=creator.id,
        project_id=project_id,
        media_type=media_type,
        storage_key=storage_key,
        original_filename=orig,
        detected_content_type=mime,
        file_size=len(data),
        duration=info.get("duration"),
        width=info.get("width"),
        height=info.get("height"),
        metadata_json=json.dumps(metadata) if metadata else "{}",
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return _format_asset(asset)

@router.get("/assets")
def list_assets(
    project_id: Optional[int] = Query(None),
    media_type: Optional[str] = Query(None),
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """List creator's assets, optionally filtered by project or type."""
    q = db.query(StudioAsset).filter(
        StudioAsset.creator_id == creator.id,
        StudioAsset.is_deleted == False,  # noqa
    )
    if project_id:
        q = q.filter(StudioAsset.project_id == project_id)
    if media_type:
        q = q.filter(StudioAsset.media_type == media_type)
    return [_format_asset(a) for a in q.order_by(StudioAsset.created_at.desc()).all()]

@router.get("/assets/{asset_id}/stream")
def stream_asset(
    asset_id: int,
    creator: User = Depends(_get_creator_for_media),
    db: Session = Depends(get_db),
):
    """Secure streaming for creator's own assets only."""
    a = db.query(StudioAsset).filter(
        StudioAsset.id == asset_id,
        StudioAsset.creator_id == creator.id,
        StudioAsset.is_deleted == False,  # noqa
    ).first()
    if not a:
        raise HTTPException(404, "Asset not found")

    path = os.path.join(STUDIO_ASSET_DIR, a.storage_key)
    if not os.path.exists(path):
        raise HTTPException(404, "Asset file missing from storage")

    return FileResponse(
        path,
        media_type=a.detected_content_type or "application/octet-stream",
        headers={"Content-Disposition": "inline"},
    )

@router.delete("/assets/{asset_id}")
def delete_asset(
    asset_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    a = db.query(StudioAsset).filter(
        StudioAsset.id == asset_id,
        StudioAsset.creator_id == creator.id,
    ).first()
    if not a:
        raise HTTPException(404, "Asset not found")
    setattr(a, "is_deleted", True)
    db.commit()
    return {"deleted": True, "asset_id": asset_id}

@router.post("/render-jobs")
def start_render_job(
    body: dict,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Create a render job record.
    The actual render happens client-side via canvas/MediaRecorder.
    The client will call /render-jobs/{id}/complete once the blob is ready.
    """
    project_id = body.get("project_id")
    if not project_id:
        raise HTTPException(400, "project_id required")

    project = _require_own_project(project_id, creator, db)

    active = db.query(StudioRenderJob).filter(
        StudioRenderJob.project_id == project_id,
        StudioRenderJob.status.in_(["queued", "rendering"]),
    ).first()
    if active:
        raise HTTPException(409, f"A render job is already running (id={active.id})")

    job = StudioRenderJob(
        project_id=project_id,
        creator_id=creator.id,
        project_revision=project.revision_number,
        timeline_snapshot_json=project.timeline_json,
        output_settings_json=project.output_settings_json,
        status="rendering",   # client renders immediately
        started_at=datetime.now(timezone.utc),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return _format_job(job)

@router.post("/render-jobs/{job_id}/upload-output")
async def upload_render_output(
    job_id: int,
    file: UploadFile = File(...),
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Client uploads the rendered blob here after browser-side export completes.
    Validates ownership, saves privately, marks job completed.
    """
    job = db.query(StudioRenderJob).filter(
        StudioRenderJob.id == job_id,
        StudioRenderJob.creator_id == creator.id,
    ).first()
    if not job:
        raise HTTPException(404, "Render job not found")
    if job.status not in ("rendering", "queued"):
        raise HTTPException(400, f"Job is already in status '{job.status}'")

    orig = file.filename or "export.mp4"
    ext = os.path.splitext(orig)[1].lower() or ".mp4"
    data = await file.read()

    if len(data) > MAX_ASSET_BYTES:
        raise HTTPException(413, "Exported file too large")

    storage_key = f"render_{creator.id}_{job_id}_{uuid.uuid4().hex}{ext}"
    path = os.path.join(STUDIO_RENDER_DIR, storage_key)
    with open(path, "wb") as f:
        f.write(data)

    setattr(job, "status", "completed")
    setattr(job, "output_storage_key", storage_key)
    setattr(job, "output_file_size", len(data))
    setattr(job, "completed_at", datetime.now(timezone.utc))
    setattr(job, "progress", 100.0)
    db.commit()
    db.refresh(job)
    return _format_job(job)

@router.post("/render-jobs/{job_id}/fail")
def mark_render_failed(
    job_id: int,
    body: dict,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Client reports that browser-side render failed."""
    job = db.query(StudioRenderJob).filter(
        StudioRenderJob.id == job_id,
        StudioRenderJob.creator_id == creator.id,
    ).first()
    if not job:
        raise HTTPException(404, "Render job not found")
    setattr(job, "status", "failed")
    setattr(job, "error_message", str(body.get("error", "Unknown error"))[:500])
    db.commit()
    db.refresh(job)
    return _format_job(job)

@router.get("/render-jobs")
def list_render_jobs(
    project_id: Optional[int] = Query(None),
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    q = db.query(StudioRenderJob).filter(
        StudioRenderJob.creator_id == creator.id,
    )
    if project_id:
        q = q.filter(StudioRenderJob.project_id == project_id)
    return [_format_job(j) for j in q.order_by(StudioRenderJob.created_at.desc()).all()]

@router.get("/render-jobs/{job_id}")
def get_render_job(
    job_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    job = db.query(StudioRenderJob).filter(
        StudioRenderJob.id == job_id,
        StudioRenderJob.creator_id == creator.id,
    ).first()
    if not job:
        raise HTTPException(404, "Job not found")
    return _format_job(job)

@router.get("/render-jobs/{job_id}/download")
def download_render(
    job_id: int,
    creator: User = Depends(_get_creator_for_media),
    db: Session = Depends(get_db),
):
    """Preview/download a completed render (creator only)."""
    job = db.query(StudioRenderJob).filter(
        StudioRenderJob.id == job_id,
        StudioRenderJob.creator_id == creator.id,
        StudioRenderJob.status == "completed",
    ).first()
    if not job or not job.output_storage_key:
        raise HTTPException(404, "Completed render not found")

    path = os.path.join(STUDIO_RENDER_DIR, job.output_storage_key)
    if not os.path.exists(path):
        raise HTTPException(404, "Render file missing from storage")

    ext = os.path.splitext(job.output_storage_key)[1].lower()
    mime = {"mp4": "video/mp4", ".mp4": "video/mp4", ".webm": "video/webm"}.get(ext, "video/mp4")
    return FileResponse(path, media_type=mime, filename=f"studio_export_{job_id}{ext}")

@router.post("/render-jobs/{job_id}/submit-for-review")
def submit_for_review(
    job_id: int,
    body: dict,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Submit a completed render for admin review via existing delivery pipeline.
    Creates a DeliverySubmission and links it to the render job.
    """
    job = db.query(StudioRenderJob).filter(
        StudioRenderJob.id == job_id,
        StudioRenderJob.creator_id == creator.id,
        StudioRenderJob.status == "completed",
    ).first()
    if not job or not job.output_storage_key:
        raise HTTPException(400, "Render must be completed before submission")

    if job.delivery_submission_id:
        raise HTTPException(409, "This render has already been submitted for review")

    project = db.query(StudioProject).filter(
        StudioProject.id == job.project_id,
        StudioProject.creator_id == creator.id,
    ).first()
    if not project or not project.order_id:
        raise HTTPException(400, "Project must be linked to an order before submitting")

    order = db.query(Order).filter(
        Order.id == project.order_id,
        Order.creator_id == creator.id,
    ).first()
    if not order:
        raise HTTPException(403, "Order not found or not assigned to you")

    if order.status not in ("accepted", "in_progress", "revision_requested", "assigned"):
        raise HTTPException(400, f"Cannot submit for order in status '{order.status}'")

    existing_count = db.query(DeliverySubmission).filter(
        DeliverySubmission.order_id == project.order_id,
    ).count()
    version = existing_count + 1

    title = str(body.get("title") or project.title)[:255]
    description = str(body.get("description") or "")[:2000]

    render_path = os.path.join(STUDIO_RENDER_DIR, job.output_storage_key)
    if not os.path.exists(render_path):
        raise HTTPException(500, "Render file missing from storage")

    delivery_dir = os.path.join(_BASE, "private_uploads", "deliveries")
    os.makedirs(delivery_dir, exist_ok=True)
    ext = os.path.splitext(job.output_storage_key)[1].lower() or ".mp4"
    delivery_key = f"order_{project.order_id}_v{version}_{uuid.uuid4().hex[:8]}{ext}"
    delivery_path = os.path.join(delivery_dir, delivery_key)

    import shutil
    shutil.copy2(render_path, delivery_path)

    file_size = os.path.getsize(delivery_path)
    mime_map = {".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime"}
    detected_mime = mime_map.get(ext, "video/mp4")

    now = datetime.now(timezone.utc)
    submission = DeliverySubmission(
        order_id=project.order_id,
        creator_id=creator.id,
        version_number=version,
        title=title,
        description=description,
        storage_key=delivery_key,
        original_filename=f"studio_export_v{version}{ext}",
        file_size=file_size,
        detected_content_type=detected_mime,
        status="pending_review",
        submitted_at=now,
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    setattr(job, "delivery_submission_id", submission.id)
    if order.status in ("revision_requested", "assigned", "accepted"):
        setattr(order, "status", "in_progress")
    db.commit()

    from app.models.user import User as UserModel
    admins = db.query(UserModel).filter(UserModel.role == "admin").all()
    for a in admins:
        create_notification(
            db=db,
            user_id=a.id,
            title="🎬 Studio Video Submitted for Review",
            message=f"Creator {creator.name} submitted v{version} from Video Studio for order #{project.order_id} '{order.title}'.",
            type="info",
        )

    return {
        "delivery_submission_id": submission.id,
        "version_number": version,
        "status": "pending_review",
        "order_id": project.order_id,
        "message": "Video submitted for admin review. The client will receive it only after approval.",
    }
