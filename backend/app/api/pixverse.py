"""
AI Generator API — creator-only PixVerse text-to-video.
=======================================================
Route prefix: /api/creator/ai-generator

Every endpoint is creator-only and ownership-scoped. Clients, admins and guests
are denied server-side (hiding the sidebar link is not relied upon). The
PixVerse key never appears in any response, URL, or log.

Generated output is a DRAFT asset. Nothing here submits to a client, approves a
delivery, completes an order, or starts a payout — those stay with the existing
delivery/review workflow.
"""
from __future__ import annotations

import json
import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from app.core.database import get_db
from app.core.security import require_role, decode_token
from app.core.config import settings
from app.models.user import User
from app.models.studio import StudioProject, StudioAsset
from app.models.pixverse_job import PixVerseJob
from app.services import pixverse_service as pv
from app.services import media_probe
from app.services.notification_service import create_notification

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/creator/ai-generator", tags=["ai-generator"])

_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
PIXVERSE_DIR = os.path.join(_BASE, "private_uploads", "pixverse")
STUDIO_ASSET_DIR = os.path.join(_BASE, "private_uploads", "studio", "assets")
for _d in (PIXVERSE_DIR, STUDIO_ASSET_DIR):
    os.makedirs(_d, exist_ok=True)

_media_sec = HTTPBearer(auto_error=False)

ACTIVE_STATUSES = ("queued", "generating", "saving_output")


class GenerateRequest(BaseModel):
    prompt: str = Field(..., min_length=3)
    aspect_ratio: str = "16:9"
    duration: int = 5
    quality: str = "540p"
    seed: Optional[int] = None


def _creator_from_token(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_media_sec),
    db: Session = Depends(get_db),
) -> User:
    """Auth for media GETs that a <video>/<a download> cannot send a header on."""
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


def _format_job(j: PixVerseJob) -> dict:
    """Serialize a job. Never exposes storage_key, trace_id, or the API key."""
    return {
        "id": j.id,
        "status": j.status,                     # queued|generating|saving_output|completed|failed
        "status_label": _STATUS_LABELS.get(j.status, j.status),
        "prompt": j.prompt,
        "model": j.model,
        "aspect_ratio": j.aspect_ratio,
        "duration": j.duration,
        "quality": j.quality,
        "error_message": j.error_message,
        "error_code": j.error_code,
        "credits": j.credits,
        "output_ready": bool(j.storage_key and j.status == "completed"),
        "output_asset_id": j.output_asset_id,
        "output_content_type": j.output_content_type,
        "created_at": j.created_at.isoformat() if j.created_at else None,
        "submitted_at": j.submitted_at.isoformat() if j.submitted_at else None,
        "completed_at": j.completed_at.isoformat() if j.completed_at else None,
    }


_STATUS_LABELS = {
    "queued": "Queued",
    "generating": "Generating",
    "saving_output": "Saving Output",
    "completed": "Completed",
    "failed": "Failed",
}


def _own_job(job_id: int, creator: User, db: Session) -> PixVerseJob:
    j = db.query(PixVerseJob).filter(
        PixVerseJob.id == job_id,
        PixVerseJob.creator_id == creator.id,
    ).first()
    if not j:
        raise HTTPException(404, "Generation job not found")
    return j


@router.get("/config")
def get_config(creator: User = Depends(require_role("creator"))):
    """What the creator UI needs to render options. Never includes the key."""
    return {
        "available": pv.is_configured(),
        "provider": "pixverse",
        "supported_aspect_ratios": pv.SUPPORTED_ASPECT_RATIOS,
        "supported_qualities": pv.SUPPORTED_QUALITIES,
        "supported_durations": pv.SUPPORTED_DURATIONS,
        "defaults": {
            "aspect_ratio": "16:9",
            "quality": settings.PIXVERSE_DEFAULT_QUALITY,
            "duration": settings.PIXVERSE_DEFAULT_DURATION,
        },
        "limits": {
            "max_prompt_chars": settings.PIXVERSE_MAX_PROMPT_CHARS,
            "max_concurrent": settings.PIXVERSE_MAX_CONCURRENT_PER_CREATOR,
            "daily_limit": settings.PIXVERSE_DAILY_LIMIT_PER_CREATOR,
        },
        # Honest cost note; we do not fabricate a remaining-credit figure.
        "cost_note": "Each generation consumes platform video-generation credits. "
                     "Generated videos are private drafts until you submit them for review.",
    }


@router.post("/generate")
def generate(
    body: GenerateRequest,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    if not pv.is_configured():
        raise HTTPException(503, "AI video generation is not configured on this server.")

    prompt = (body.prompt or "").strip()
    if len(prompt) < 3:
        raise HTTPException(400, "Please enter a longer prompt.")
    if len(prompt) > settings.PIXVERSE_MAX_PROMPT_CHARS:
        raise HTTPException(400, f"Prompt must be {settings.PIXVERSE_MAX_PROMPT_CHARS} characters or fewer.")
    if body.aspect_ratio not in pv.SUPPORTED_ASPECT_RATIOS:
        raise HTTPException(400, "Unsupported aspect ratio.")
    if body.quality not in pv.SUPPORTED_QUALITIES:
        raise HTTPException(400, "Unsupported quality.")
    if body.duration not in pv.SUPPORTED_DURATIONS:
        raise HTTPException(400, "Unsupported duration.")
    if body.seed is not None and not (0 <= body.seed <= 2_147_483_647):
        raise HTTPException(400, "Seed out of range.")

    now = datetime.now(timezone.utc)

    # Concurrency limit.
    active = db.query(PixVerseJob).filter(
        PixVerseJob.creator_id == creator.id,
        PixVerseJob.status.in_(ACTIVE_STATUSES),
    ).count()
    if active >= settings.PIXVERSE_MAX_CONCURRENT_PER_CREATOR:
        raise HTTPException(429, "You already have the maximum number of generations in progress. "
                                 "Please wait for one to finish.")

    # Daily limit.
    day_ago = now - timedelta(hours=24)
    todays = db.query(PixVerseJob).filter(
        PixVerseJob.creator_id == creator.id,
        PixVerseJob.created_at >= day_ago,
    ).count()
    if todays >= settings.PIXVERSE_DAILY_LIMIT_PER_CREATOR:
        raise HTTPException(429, "You have reached today's generation limit. Please try again tomorrow.")

    # Duplicate-submit guard: an identical prompt+settings within the dedupe
    # window returns the existing in-flight job instead of charging again.
    window = now - timedelta(seconds=settings.PIXVERSE_DEDUPE_WINDOW_SECONDS)
    dupe = db.query(PixVerseJob).filter(
        PixVerseJob.creator_id == creator.id,
        PixVerseJob.prompt == prompt,
        PixVerseJob.aspect_ratio == body.aspect_ratio,
        PixVerseJob.duration == body.duration,
        PixVerseJob.quality == body.quality,
        PixVerseJob.created_at >= window,
    ).order_by(PixVerseJob.id.desc()).first()
    if dupe:
        return {"job": _format_job(dupe), "deduplicated": True}

    model = settings.PIXVERSE_MODEL
    trace_id = pv.new_trace_id()

    job = PixVerseJob(
        creator_id=creator.id,
        provider="pixverse",
        model=model,
        prompt=prompt,
        aspect_ratio=body.aspect_ratio,
        duration=body.duration,
        quality=body.quality,
        seed=body.seed,
        trace_id=trace_id,
        status="queued",
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    # Submit synchronously so the creator gets immediate honest errors
    # (moderation, invalid setting, no credits). The LONG wait (generation
    # itself) is polled by the background worker — the request is not held open.
    try:
        result = pv.submit_text_to_video(
            prompt=prompt, model=model, aspect_ratio=body.aspect_ratio,
            duration=body.duration, quality=body.quality, seed=body.seed,
            trace_id=trace_id,
        )
    except pv.PixVerseError as exc:
        job.status = "failed"
        job.error_message = exc.message
        job.error_code = exc.code
        db.commit()
        # 502 for provider failures, 400 for a setting the creator can fix.
        code = 400 if exc.code and not exc.retryable and exc.code not in ("auth", "network") else 502
        raise HTTPException(code, exc.message)

    job.provider_task_id = result["video_id"]
    job.credits = result.get("credits")
    job.status = "generating"
    job.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return {"job": _format_job(job), "deduplicated": False}


@router.get("/jobs")
def list_jobs(
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    jobs = db.query(PixVerseJob).filter(
        PixVerseJob.creator_id == creator.id,
    ).order_by(PixVerseJob.id.desc()).limit(100).all()
    return [_format_job(j) for j in jobs]


@router.get("/jobs/{job_id}")
def get_job(
    job_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    return _format_job(_own_job(job_id, creator, db))


@router.get("/jobs/{job_id}/stream")
def stream_job_output(
    job_id: int,
    creator: User = Depends(_creator_from_token),
    db: Session = Depends(get_db),
):
    j = _own_job(job_id, creator, db)
    if not j.storage_key or j.status != "completed":
        raise HTTPException(404, "No output available for this job yet")
    path = os.path.join(PIXVERSE_DIR, j.storage_key)
    if not os.path.exists(path):
        raise HTTPException(404, "Output file missing from storage")
    return FileResponse(path, media_type=j.output_content_type or "video/mp4",
                        headers={"Content-Disposition": "inline"})


@router.get("/jobs/{job_id}/download")
def download_job_output(
    job_id: int,
    creator: User = Depends(_creator_from_token),
    db: Session = Depends(get_db),
):
    j = _own_job(job_id, creator, db)
    if not j.storage_key or j.status != "completed":
        raise HTTPException(404, "No output available for this job yet")
    path = os.path.join(PIXVERSE_DIR, j.storage_key)
    if not os.path.exists(path):
        raise HTTPException(404, "Output file missing from storage")
    fname = f"ai-generated-{j.id}.mp4"
    return FileResponse(path, media_type=j.output_content_type or "video/mp4",
                        filename=fname)


def _save_job_as_asset(j: PixVerseJob, db: Session) -> StudioAsset:
    """Copy a completed job's private output into the Studio media library.
    Idempotent: returns the existing asset if already saved."""
    if j.output_asset_id:
        existing = db.query(StudioAsset).filter(StudioAsset.id == j.output_asset_id).first()
        if existing:
            return existing

    src = os.path.join(PIXVERSE_DIR, j.storage_key or "")
    if not j.storage_key or not os.path.exists(src):
        raise HTTPException(409, "This job has no stored output to save.")

    with open(src, "rb") as f:
        data = f.read()

    mime = j.output_content_type or "video/mp4"
    info = media_probe.probe(data, mime, f"ai-generated-{j.id}.mp4")

    ext = ".mp4"
    storage_key = f"creator_{j.creator_id}_{uuid.uuid4().hex}{ext}"
    dst = os.path.join(STUDIO_ASSET_DIR, storage_key)
    with open(dst, "wb") as f:
        f.write(data)

    metadata = {"probe": {
        "has_video_track": info.get("has_video_track"),
        "has_audio_track": info.get("has_audio_track"),
        "video_codec": info.get("video_codec"),
        "audio_codec": info.get("audio_codec"),
        "note": info.get("probe_note"),
    }, "source": "ai_generator", "pixverse_job_id": j.id}

    asset = StudioAsset(
        creator_id=j.creator_id,
        project_id=None,
        media_type="video",
        storage_key=storage_key,
        original_filename=f"AI Generated #{j.id}.mp4",
        detected_content_type=mime,
        file_size=len(data),
        duration=info.get("duration"),
        width=info.get("width"),
        height=info.get("height"),
        metadata_json=json.dumps(metadata),
    )
    db.add(asset)
    db.commit()
    db.refresh(asset)
    j.output_asset_id = asset.id
    db.commit()
    return asset


@router.post("/jobs/{job_id}/save-to-media")
def save_to_media(
    job_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    j = _own_job(job_id, creator, db)
    if j.status != "completed":
        raise HTTPException(409, "Generation is not complete yet.")
    asset = _save_job_as_asset(j, db)
    return {"asset_id": asset.id, "saved": True}


@router.post("/jobs/{job_id}/open-in-studio")
def open_in_studio(
    job_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Save the output to My Media (idempotent) and create a new project with
    the asset attached, so the existing editor opens it via its normal library
    flow. Returns the project id for the client to navigate to."""
    j = _own_job(job_id, creator, db)
    if j.status != "completed":
        raise HTTPException(409, "Generation is not complete yet.")
    asset = _save_job_as_asset(j, db)

    project = StudioProject(
        creator_id=creator.id,
        title=f"AI Draft #{j.id}",
        aspect_ratio=j.aspect_ratio if j.aspect_ratio in ("16:9", "9:16", "1:1") else "16:9",
        timeline_json="{}",
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    # Attach the asset to the new project so it appears in that project's library.
    asset.project_id = project.id
    db.commit()
    return {"project_id": project.id, "asset_id": asset.id}


@router.post("/jobs/{job_id}/retry-save")
def retry_save(
    job_id: int,
    creator: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """Retry retrieving/storing the output when generation succeeded provider-side
    but the download/store failed. NEVER re-submits a new (chargeable) generation."""
    j = _own_job(job_id, creator, db)
    if j.status == "completed" and j.storage_key:
        return {"job": _format_job(j), "retried": False}
    if not j.provider_task_id:
        raise HTTPException(409, "This job was never submitted; nothing to retrieve.")
    # Reset to saving_output and let the worker pick it up on its next pass.
    j.status = "saving_output"
    j.error_message = None
    j.error_code = None
    db.commit()
    db.refresh(j)
    return {"job": _format_job(j), "retried": True}
