"""
Delivery Submissions API
========================
Creator → submits video → Admin reviews → Admin approves → Client can view/download

Security rules:
- Private files are NEVER served via public static
- Access checks re-validated on every stream/download request
- Audit logs written for every access
"""

import os
import uuid
import hashlib
from datetime import datetime, timezone
from typing import Optional, List

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form,
    Query, BackgroundTasks, Request
)
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func

from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.core.database import get_db
from app.core.security import get_current_user, require_role, require_admin, decode_token
from app.core.config import settings
from app.models.user import User
from app.models.order import Order, Notification
from app.models.delivery import DeliverySubmission, DeliveryAuditLog
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api", tags=["deliveries"])

media_security = HTTPBearer(auto_error=False)

def get_user_for_media(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(media_security),
    db: Session = Depends(get_db)
) -> User:
    raw_token = None
    if credentials and credentials.credentials:
        raw_token = credentials.credentials
    elif token:
        raw_token = token

    if not raw_token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(raw_token)
    if not payload or not payload.get("sub"):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_blocked:
        raise HTTPException(status_code=403, detail="Account is blocked")
    return user

DELIVERY_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "private_uploads", "deliveries")
THUMBNAIL_UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__)))), "private_uploads", "thumbnails")

MAX_VIDEO_SIZE_MB = int(os.environ.get("MAX_DELIVERY_VIDEO_MB", "500"))
MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024

MAX_IMAGE_SIZE_MB = int(os.environ.get("MAX_DELIVERY_IMAGE_MB", "50"))
MAX_IMAGE_SIZE_BYTES = MAX_IMAGE_SIZE_MB * 1024 * 1024

ALLOWED_VIDEO_MIME_TYPES = {
    "video/mp4",
    "video/webm",
    "video/quicktime",  # MOV
}
ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".webm", ".mov"}

ALLOWED_IMAGE_MIME_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

ALLOWED_MIME_TYPES = ALLOWED_VIDEO_MIME_TYPES | ALLOWED_IMAGE_MIME_TYPES
ALLOWED_EXTENSIONS = ALLOWED_VIDEO_EXTENSIONS | ALLOWED_IMAGE_EXTENSIONS

def _deliverable_kind(mime: str) -> str:
    """"image" or "video" for a detected content type."""
    return "image" if (mime or "").startswith("image/") else "video"

os.makedirs(DELIVERY_UPLOAD_DIR, exist_ok=True)
os.makedirs(THUMBNAIL_UPLOAD_DIR, exist_ok=True)

def _detect_mime(file_bytes: bytes, filename: str = "") -> str:
    """Detect MIME type from file bytes with fallback to filename."""
    try:
        import magic as _magic  # type: ignore
        return _magic.from_buffer(file_bytes[:4096], mime=True)
    except Exception:
        pass

    if len(file_bytes) >= 12:
        if file_bytes[4:8] == b"ftyp":
            brand = file_bytes[8:12]
            if brand in (b"qt  ", b"moov"):
                return "video/quicktime"
            return "video/mp4"
        if file_bytes[:4] == b"\x1a\x45\xdf\xa3":
            return "video/webm"
        if file_bytes[4:8] in (b"moov", b"wide", b"mdat"):
            return "video/quicktime"
        if file_bytes[:3] == b"\xff\xd8\xff":
            return "image/jpeg"
        if file_bytes[:8] == b"\x89PNG\r\n\x1a\n":
            return "image/png"
        if file_bytes[:4] == b"RIFF" and file_bytes[8:12] == b"WEBP":
            return "image/webp"

    if filename:
        ext = os.path.splitext(filename)[1].lower()
        by_ext = {
            ".mp4": "video/mp4",
            ".webm": "video/webm",
            ".mov": "video/quicktime",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".webp": "image/webp",
        }
        if ext in by_ext:
            return by_ext[ext]

    return "application/octet-stream"

def _safe_storage_key(order_id: int, version: int, ext: str) -> str:
    rand = uuid.uuid4().hex[:12]
    return f"order_{order_id}_v{version}_{rand}{ext}"

def _write_private_file(directory: str, filename: str, data: bytes) -> str:
    """Write to private storage and return the key."""
    os.makedirs(directory, exist_ok=True)
    path = os.path.join(directory, filename)
    with open(path, "wb") as f:
        f.write(data)
    return filename

def _audit(db: Session, delivery_id: int, order_id: int, actor: User, action: str, details: str | None = None):
    log = DeliveryAuditLog(
        delivery_id=delivery_id,
        order_id=order_id,
        actor_id=actor.id,
        actor_role=actor.role,
        action=action,
        details=details,
    )
    db.add(log)
    db.commit()

def _format_delivery(d: DeliverySubmission, include_storage_key: bool = False) -> dict:
    """
    Format a delivery submission for API response.
    Never include storage_key in client-facing responses.
    """
    result = {
        "id": d.id,
        "order_id": d.order_id,
        "creator_id": d.creator_id,
        "version_number": d.version_number,
        "title": d.title,
        "description": d.description,
        "original_filename": d.original_filename,
        "file_size": d.file_size,
        "detected_content_type": d.detected_content_type,
        "deliverable_kind": _deliverable_kind(d.detected_content_type or ""),
        "status": d.status,
        "creator_visible_feedback": d.creator_visible_feedback,
        "submitted_at": d.submitted_at.isoformat() if d.submitted_at else None,
        "reviewed_at": d.reviewed_at.isoformat() if d.reviewed_at else None,
        "approved_at": d.approved_at.isoformat() if d.approved_at else None,
        "delivered_at": d.delivered_at.isoformat() if d.delivered_at else None,
        "review_due_at": d.review_due_at.isoformat() if d.review_due_at else None,
        "released_at": d.released_at.isoformat() if d.released_at else None,
        "release_method": d.release_method,
        "created_at": d.created_at.isoformat() if d.created_at else None,
        "has_thumbnail": bool(d.thumbnail_storage_key),
        "delivered_to_client": bool(d.status == "approved" and d.delivered_at),
        "reviewer": {
            "id": d.reviewer.id,
            "name": d.reviewer.name
        } if d.reviewer else None,
        "creator": {
            "id": d.creator.id,
            "name": d.creator.name
        } if d.creator else None,
    }
    if include_storage_key:
        result["storage_key"] = d.storage_key
    return result

@router.post("/orders/{order_id}/deliveries")
async def create_delivery_draft(
    order_id: int,
    title: str = Form(...),
    description: str = Form(None),
    submit_immediately: Optional[str] = Form(None),
    video: UploadFile = File(...),
    thumbnail: UploadFile = File(None),
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Creator uploads a video for an order.
    Creates a draft submission or immediately submits for review if submit_immediately is true.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not assigned to this order")

    if order.status not in ["assigned", "in_progress", "revision_requested", "accepted"]:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit a delivery for an order with status '{order.status}'"
        )

    orig_name = video.filename or "upload"
    ext = os.path.splitext(orig_name)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported deliverable format '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
            )
        )

    video_bytes = await video.read()
    if not video_bytes:
        raise HTTPException(status_code=400, detail="The uploaded file is empty or the upload did not complete.")

    detected_mime = _detect_mime(video_bytes, orig_name)
    if detected_mime not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File content does not match an allowed video or image format (detected: {detected_mime})."
        )

    kind = _deliverable_kind(detected_mime)
    if kind == "video" and ext not in ALLOWED_VIDEO_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"'{orig_name}' contains video but has an image extension.")
    if kind == "image" and ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"'{orig_name}' contains an image but has a video extension.")

    limit_bytes = MAX_IMAGE_SIZE_BYTES if kind == "image" else MAX_VIDEO_SIZE_BYTES
    limit_mb = MAX_IMAGE_SIZE_MB if kind == "image" else MAX_VIDEO_SIZE_MB
    if len(video_bytes) > limit_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"This {kind} exceeds the {limit_mb} MB upload limit."
        )

    existing_count = db.query(DeliverySubmission).filter(
        DeliverySubmission.order_id == order_id
    ).count()
    version = existing_count + 1

    storage_filename = _safe_storage_key(order_id, version, ext)
    _write_private_file(DELIVERY_UPLOAD_DIR, storage_filename, video_bytes)

    thumb_key = None
    if thumbnail and thumbnail.filename:
        thumb_bytes = await thumbnail.read()
        thumb_ext = os.path.splitext(thumbnail.filename)[1].lower()
        if thumb_ext in {".jpg", ".jpeg", ".png", ".webp"}:
            thumb_filename = f"thumb_{storage_filename}{thumb_ext}"
            _write_private_file(THUMBNAIL_UPLOAD_DIR, thumb_filename, thumb_bytes)
            thumb_key = thumb_filename

    should_submit = submit_immediately is not None and submit_immediately.strip().lower() in ("true", "1", "yes")
    initial_status = "pending_review" if should_submit else "draft"
    now_dt = datetime.now(timezone.utc) if should_submit else None

    submission = DeliverySubmission(
        order_id=order_id,
        creator_id=current_user.id,
        version_number=version,
        title=title,
        description=description,
        storage_key=storage_filename,
        thumbnail_storage_key=thumb_key,
        original_filename=orig_name,
        file_size=len(video_bytes),
        detected_content_type=detected_mime,
        status=initial_status,
        submitted_at=now_dt,
        review_due_at=(
            now_dt + __import__('datetime').timedelta(hours=settings.AUTO_RELEASE_HOURS)
            if now_dt else None
        ),
    )
    db.add(submission)
    db.commit()
    db.refresh(submission)

    _audit(db, submission.id, order_id, current_user, "uploaded",
           f"Uploaded v{version}: {orig_name} ({len(video_bytes)} bytes)")

    if should_submit:
        _audit(db, submission.id, order_id, current_user, "submitted_for_review",
               f"Submitted v{version} for admin review")
        if order.status in ["revision_requested", "assigned", "accepted"]:
            setattr(order, "status", "in_progress")
            db.commit()

        from app.models.user import User as UserModel
        admins = db.query(UserModel).filter(UserModel.role == "admin").all()
        for a in admins:
            create_notification(
                db=db,
                user_id=a.id,
                title="🎬 New Video Delivery for Review",
                message=f"Creator {current_user.name} submitted v{version} for order #{order_id} '{order.title}'.",
                type="info"
            )

    return _format_delivery(submission)

@router.post("/deliveries/{delivery_id}/submit")
def submit_delivery_for_review(
    delivery_id: int,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Creator submits a draft delivery for admin review.
    """
    submission = db.query(DeliverySubmission).filter(
        DeliverySubmission.id == delivery_id,
        DeliverySubmission.creator_id == current_user.id,
    ).first()
    if not submission:
        raise HTTPException(status_code=404, detail="Delivery not found")

    if submission.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"This delivery is already in status '{submission.status}' and cannot be re-submitted."
        )

    from datetime import timedelta
    now_dt = datetime.now(timezone.utc)
    setattr(submission, "status", "pending_review")
    setattr(submission, "submitted_at", now_dt)
    setattr(submission, "review_due_at", now_dt + timedelta(hours=settings.AUTO_RELEASE_HOURS))
    db.commit()
    db.refresh(submission)

    order = db.query(Order).filter(Order.id == submission.order_id).first()
    if order and order.status in ["revision_requested", "assigned", "accepted"]:
        setattr(order, "status", "in_progress")
        db.commit()

    from app.models.user import User as UserModel
    admins = db.query(UserModel).filter(UserModel.role == "admin").all()
    for admin in admins:
        create_notification(
            db=db,
            user_id=admin.id,
            title="📹 Video Pending Review",
            message=f"Creator {current_user.name} submitted a new video (v{submission.version_number}) for order #{submission.order_id}: {order.title if order else 'N/A'}. Review deadline: {submission.review_due_at.strftime('%Y-%m-%d %H:%M UTC') if submission.review_due_at else 'N/A'}.",
            type="order"
        )

    _audit(db, delivery_id, submission.order_id, current_user, "submitted_for_review",
           f"Submitted v{submission.version_number} for admin review")

    return {
        **_format_delivery(submission),
        "message": (
            "Your video has been submitted for review. "
            f"If no review decision is made within {settings.AUTO_RELEASE_HOURS} hours, "
            "this video will be released automatically to the client."
        )
    }

@router.get("/orders/{order_id}/deliveries")
def get_order_deliveries(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all delivery submissions for an order.
    Creators see all their own submissions.
    Clients see ONLY approved deliveries (and only storage key info is excluded).
    Admins see all.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    if current_user.role == "creator":
        if order.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        subs = db.query(DeliverySubmission).filter(
            DeliverySubmission.order_id == order_id,
            DeliverySubmission.creator_id == current_user.id,
        ).order_by(DeliverySubmission.version_number.desc()).all()
        return [_format_delivery(s) for s in subs]

    elif current_user.role == "client":
        if order.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        subs = db.query(DeliverySubmission).filter(
            DeliverySubmission.order_id == order_id,
            DeliverySubmission.status == "approved",
        ).order_by(DeliverySubmission.version_number.desc()).all()
        return [_format_delivery(s) for s in subs]

    elif current_user.role == "admin":
        subs = db.query(DeliverySubmission).filter(
            DeliverySubmission.order_id == order_id,
        ).order_by(DeliverySubmission.version_number.desc()).all()
        return [_format_delivery(s, include_storage_key=True) for s in subs]

    raise HTTPException(status_code=403, detail="Access denied")

@router.get("/admin/video-approvals")
def list_video_approvals(
    status: Optional[str] = Query(None),
    creator_name: Optional[str] = Query(None),
    client_name: Optional[str] = Query(None),
    order_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: list all delivery submissions with filters."""
    from app.models.user import User as UserModel
    query = db.query(DeliverySubmission)

    if status:
        query = query.filter(DeliverySubmission.status == status)
    if order_id:
        query = query.filter(DeliverySubmission.order_id == order_id)

    subs = query.order_by(DeliverySubmission.submitted_at.desc().nullslast()).all()

    result = []
    for s in subs:
        order = db.query(Order).filter(Order.id == s.order_id).first()
        creator_user = db.query(UserModel).filter(UserModel.id == s.creator_id).first()
        client_user = db.query(UserModel).filter(UserModel.id == order.client_id).first() if order else None

        creator_n = creator_user.name if creator_user else ""
        client_n = client_user.name if client_user else ""

        if creator_name and creator_name.lower() not in creator_n.lower():
            continue
        if client_name and client_name.lower() not in client_n.lower():
            continue
        if search:
            s_lower = search.lower()
            if not any([
                s_lower in (order.title or "").lower() if order else False,
                s_lower in creator_n.lower(),
                s_lower in client_n.lower(),
                s_lower in str(s.order_id),
            ]):
                continue

        row = _format_delivery(s, include_storage_key=True)
        row["order_title"] = order.title if order else ""
        row["client_name"] = client_n
        row["creator_name"] = creator_n
        result.append(row)

    return result[skip:skip + limit]

@router.get("/admin/video-approvals/{delivery_id}")
def get_video_approval_detail(
    delivery_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin: get full detail for a delivery submission."""
    from app.models.user import User as UserModel
    s = db.query(DeliverySubmission).filter(DeliverySubmission.id == delivery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")

    order = db.query(Order).filter(Order.id == s.order_id).first()
    creator_user = db.query(UserModel).filter(UserModel.id == s.creator_id).first()
    client_user = db.query(UserModel).filter(UserModel.id == order.client_id).first() if order else None

    all_versions = db.query(DeliverySubmission).filter(
        DeliverySubmission.order_id == s.order_id
    ).order_by(DeliverySubmission.version_number.asc()).all()

    result = _format_delivery(s, include_storage_key=True)
    result["internal_admin_notes"] = s.internal_admin_notes
    result["order_title"] = order.title if order else ""
    result["order_brief"] = order.brief if order else ""
    result["order_requirements"] = order.requirements if order else ""
    result["client_name"] = client_user.name if client_user else ""
    result["client_id"] = client_user.id if client_user else None
    result["creator_name"] = creator_user.name if creator_user else ""
    result["all_versions"] = [_format_delivery(v, include_storage_key=True) for v in all_versions]

    return result

@router.post("/admin/video-approvals/{delivery_id}/approve")
def approve_delivery(
    delivery_id: int,
    payload: dict,
    background_tasks: BackgroundTasks,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin: approve a specific delivery version.
    Makes this exact version available to the client.
    Uses the shared delivery_release service for consistent state.
    """
    s = db.query(DeliverySubmission).filter(DeliverySubmission.id == delivery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")

    if s.status != "pending_review":
        raise HTTPException(
            status_code=400,
            detail=f"Only 'pending_review' submissions can be approved. Current status: {s.status}"
        )

    from app.services.delivery_release import release_delivery
    released = release_delivery(
        db=db,
        submission=s,
        release_method="admin_approved",
        reviewer_id=admin.id,
        internal_notes=payload.get("internal_notes"),
    )

    if not released:
        raise HTTPException(
            status_code=409,
            detail="Delivery was already processed by another action. Please refresh."
        )

    db.refresh(s)
    return _format_delivery(s, include_storage_key=True)

@router.post("/admin/video-approvals/{delivery_id}/request-changes")
def request_changes(
    delivery_id: int,
    payload: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Admin: request changes on a delivery.
    Requires a feedback reason. Video remains unavailable to client.
    """
    feedback = payload.get("feedback", "").strip()
    if not feedback:
        raise HTTPException(status_code=400, detail="Feedback reason is required when requesting changes.")

    s = db.query(DeliverySubmission).filter(DeliverySubmission.id == delivery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Submission not found")

    if s.status != "pending_review":
        raise HTTPException(
            status_code=400,
            detail=f"Only 'pending_review' submissions can have changes requested. Current status: {s.status}"
        )

    order = db.query(Order).filter(Order.id == s.order_id).first()

    now = datetime.now(timezone.utc)
    setattr(s, "status", "changes_requested")
    setattr(s, "reviewed_by", admin.id)
    setattr(s, "reviewed_at", now)
    setattr(s, "creator_visible_feedback", feedback)
    setattr(s, "internal_admin_notes", payload.get("internal_notes", s.internal_admin_notes))
    db.commit()
    db.refresh(s)

    _audit(db, delivery_id, s.order_id, admin, "changes_requested",
           f"Admin requested changes on v{s.version_number}: {feedback}")

    create_notification(
        db=db,
        user_id=s.creator_id,
        title="⚠️ Changes Requested on Your Video",
        message=f"The admin has reviewed your video (v{s.version_number}) for '{order.title if order else 'order #' + str(s.order_id)}' and requested changes. Please review the feedback.",
        type="warning"
    )

    return _format_delivery(s)

@router.get("/orders/{order_id}/approved-deliveries")
def get_approved_deliveries(
    order_id: int,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db),
):
    """
    Client-facing: returns only approved deliveries for their order.
    Never leaks pending/rejected videos.
    """
    order = db.query(Order).filter(Order.id == order_id, Order.client_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    subs = db.query(DeliverySubmission).filter(
        DeliverySubmission.order_id == order_id,
        DeliverySubmission.status == "approved",
    ).order_by(DeliverySubmission.version_number.desc()).all()

    return [_format_delivery(s) for s in subs]

def _check_delivery_access(delivery_id: int, current_user: User, db: Session) -> DeliverySubmission:
    """
    Re-validate access per request:
    - Admins: any submission
    - Creator: only their own (any status) submissions
    - Client: only approved submissions for their order
    Raises 403/404 if not authorized.
    """
    s = db.query(DeliverySubmission).filter(DeliverySubmission.id == delivery_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Delivery not found")

    order = db.query(Order).filter(Order.id == s.order_id).first()

    if current_user.role == "admin":
        return s

    if current_user.role == "creator":
        if s.creator_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        return s

    if current_user.role == "client":
        if not order or order.client_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")
        if s.status != "approved":
            raise HTTPException(status_code=403, detail="This video is not yet approved for delivery.")
        return s

    raise HTTPException(status_code=403, detail="Access denied")

@router.get("/deliveries/{delivery_id}/stream")
def stream_delivery(
    delivery_id: int,
    current_user: User = Depends(get_user_for_media),
    db: Session = Depends(get_db),
):
    """Secure streaming endpoint for authenticated, authorized users."""
    s = _check_delivery_access(delivery_id, current_user, db)

    if not s.storage_key:
        raise HTTPException(status_code=404, detail="Video file not found")

    file_path = os.path.join(DELIVERY_UPLOAD_DIR, s.storage_key)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on server")

    _audit(db, delivery_id, s.order_id, current_user, "accessed_stream",
           f"Streamed v{s.version_number}")

    return FileResponse(
        file_path,
        media_type=s.detected_content_type or "video/mp4",
        filename=s.original_filename or s.storage_key,
    )

@router.get("/deliveries/{delivery_id}/download")
def download_delivery(
    delivery_id: int,
    current_user: User = Depends(get_user_for_media),
    db: Session = Depends(get_db),
):
    """Secure download endpoint for authenticated, authorized users."""
    s = _check_delivery_access(delivery_id, current_user, db)

    if not s.storage_key:
        raise HTTPException(status_code=404, detail="Video file not found")

    file_path = os.path.join(DELIVERY_UPLOAD_DIR, s.storage_key)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Video file not found on server")

    _audit(db, delivery_id, s.order_id, current_user, "accessed_download",
           f"Downloaded v{s.version_number}")

    return FileResponse(
        file_path,
        media_type=s.detected_content_type or "video/mp4",
        filename=s.original_filename or s.storage_key,
        headers={"Content-Disposition": f'attachment; filename="{s.original_filename or s.storage_key}"'},
    )

@router.get("/deliveries/{delivery_id}/thumbnail")
def get_delivery_thumbnail(
    delivery_id: int,
    current_user: User = Depends(get_user_for_media),
    db: Session = Depends(get_db),
):
    """Secure thumbnail access for authorized users only."""
    s = _check_delivery_access(delivery_id, current_user, db)

    if not s.thumbnail_storage_key:
        raise HTTPException(status_code=404, detail="No thumbnail available")

    file_path = os.path.join(THUMBNAIL_UPLOAD_DIR, s.thumbnail_storage_key)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Thumbnail not found")

    ext = os.path.splitext(s.thumbnail_storage_key)[1].lower()
    mime = {"jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}.get(ext, "image/jpeg")
    return FileResponse(file_path, media_type=mime)

@router.get("/deliveries/config")
def get_delivery_config(current_user: User = Depends(get_current_user)):
    return {
        "max_video_size_mb": MAX_VIDEO_SIZE_MB,
        "allowed_formats": list(ALLOWED_EXTENSIONS),
        "allowed_mime_types": list(ALLOWED_MIME_TYPES),
    }
