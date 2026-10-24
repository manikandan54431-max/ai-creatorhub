"""
Client Media Editing Requests API (Issue 5)
===========================================

A client uploads their own photos/videos and asks a chosen creator to edit them.

Integration, not a parallel system
----------------------------------
Creating a request also creates an `Order`. Acceptance, delivery submissions,
version history, revision requests, admin review, the release policy,
auto-release and final client acceptance are therefore the *existing* flows in
`orders.py` / `deliveries.py`, untouched. This module adds only the client's
source media and the editing brief.

Security rules
--------------
* Source media is written to private storage and served only through the
  authorised stream/download endpoints here. Nothing is public.
* A creator can read the media of a request addressed to them, and nothing else.
  There is no endpoint that hands a creator every client's media.
* Every stream and download re-validates authorisation on each request.
* A request starts as `pending_creator_response`, so sending one never implies
  the creator accepted it.
"""

import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import (
    APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Body,
)
from fastapi.responses import FileResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user, require_role, decode_token
from app.models.creator import CreatorProfile
from app.models.editing_request import EditingRequest, EditingRequestMedia
from app.models.order import Order, Chat
from app.models.user import User
from app.services import media_probe
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/editing-requests", tags=["editing-requests"])

_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
SOURCE_MEDIA_DIR = os.path.join(_BASE, "private_uploads", "editing_requests")
os.makedirs(SOURCE_MEDIA_DIR, exist_ok=True)

MAX_FILES_PER_REQUEST = int(os.environ.get("MAX_EDIT_REQUEST_FILES", "10"))
MAX_FILE_MB = int(os.environ.get("MAX_EDIT_REQUEST_FILE_MB", "500"))
MAX_TOTAL_MB = int(os.environ.get("MAX_EDIT_REQUEST_TOTAL_MB", "2048"))
MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024
MAX_TOTAL_BYTES = MAX_TOTAL_MB * 1024 * 1024

MIN_INSTRUCTIONS_CHARS = 10

ALLOWED_VIDEO_EXT = {".mp4", ".webm", ".mov"}
ALLOWED_IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_EXT = ALLOWED_VIDEO_EXT | ALLOWED_IMAGE_EXT

DELIVERABLE_TYPES = ("video", "photo", "both")

_media_sec = HTTPBearer(auto_error=False)

def _detect_content_type(data: bytes, filename: str) -> Optional[str]:
    """
    Identify a file by its magic bytes, not by the name the browser sent.
    Returns None when the content is not an accepted media type.
    """
    if len(data) < 12:
        return None
    if data[4:8] == b"ftyp":
        brand = data[8:12]
        if brand[:3] == b"qt ":
            return "video/quicktime"
        return "video/mp4"
    if data.startswith(b"\x1a\x45\xdf\xa3"):
        return "video/webm"
    if data.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP":
        return "image/webp"
    return None

def _media_type_for(content_type: str) -> str:
    return "image" if content_type.startswith("image/") else "video"

def _get_user_for_media(
    token: Optional[str] = Query(None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_media_sec),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the viewer for a media request (header or ?token= for media tags)."""
    raw = (credentials.credentials if credentials else None) or token
    if not raw:
        raise HTTPException(401, "Not authenticated")
    payload = decode_token(raw)
    if not payload or not payload.get("sub"):
        raise HTTPException(401, "Invalid or expired token")
    user = db.query(User).filter(User.id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_blocked:
        raise HTTPException(403, "Account blocked")
    return user

def _authorised_request(request_id: int, user: User, db: Session) -> EditingRequest:
    """
    Fetch a request the given user may see: its client, its creator, or an admin.

    Everyone else gets 404 rather than 403, so the endpoint does not confirm that
    some other client's request exists.
    """
    req = db.query(EditingRequest).filter(EditingRequest.id == request_id).first()
    if not req:
        raise HTTPException(404, "Editing request not found")
    if user.role == "admin":
        return req
    if user.id == req.client_id or user.id == req.creator_id:
        return req
    raise HTTPException(404, "Editing request not found")

def _eligible_creator(creator_user_id: int, db: Session) -> User:
    """
    Validate that the chosen creator can actually be hired.

    Checked server-side on every request; the client's own UI is never trusted.
    """
    user = db.query(User).filter(User.id == creator_user_id).first()
    if not user or user.role != "creator":
        raise HTTPException(400, "The selected creator does not exist")
    if user.is_blocked or not user.is_active:
        raise HTTPException(400, "The selected creator is not available")

    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == user.id).first()
    if not profile:
        raise HTTPException(400, "The selected creator has not completed their profile")
    if profile.approval_status != "approved":
        raise HTTPException(
            400,
            "The selected creator is not currently accepting work "
            f"(profile status: {profile.approval_status}).",
        )
    return user

def _format_media(m: EditingRequestMedia) -> dict:
    return {
        "id": m.id,
        "request_id": m.request_id,
        "media_type": m.media_type,
        "original_filename": m.original_filename,
        "detected_content_type": m.detected_content_type,
        "file_size": m.file_size,
        "duration": m.duration,
        "width": m.width,
        "height": m.height,
        "created_at": m.created_at.isoformat() if m.created_at else None,
    }

def _format_request(r: EditingRequest, *, include_media: bool = True) -> dict:
    data = {
        "id": r.id,
        "order_id": r.order_id,
        "client_id": r.client_id,
        "creator_id": r.creator_id,
        "client_name": r.client.name if r.client else None,
        "creator_name": r.creator.name if r.creator else None,
        "title": r.title,
        "instructions": r.instructions,
        "preferred_style": r.preferred_style,
        "deliverables": r.deliverables,
        "deliverable_type": r.deliverable_type,
        "output_format": r.output_format,
        "aspect_ratio": r.aspect_ratio,
        "target_duration_seconds": r.target_duration_seconds,
        "budget": r.budget,
        "deadline": r.deadline.isoformat() if r.deadline else None,
        "status": r.status,
        "creator_response_note": r.creator_response_note,
        "responded_at": r.responded_at.isoformat() if r.responded_at else None,
        "media_count": len([m for m in r.media if not m.is_deleted]),
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None,
    }
    if include_media:
        data["media"] = [_format_media(m) for m in r.media if not m.is_deleted]
    return data

@router.post("", status_code=201)
async def create_editing_request(
    creator_id: int = Form(...),
    title: str = Form(...),
    instructions: str = Form(...),
    preferred_style: Optional[str] = Form(None),
    deliverables: Optional[str] = Form(None),
    deliverable_type: str = Form("video"),
    output_format: Optional[str] = Form(None),
    aspect_ratio: Optional[str] = Form(None),
    target_duration_seconds: Optional[int] = Form(None),
    budget: Optional[int] = Form(None),
    deadline: Optional[str] = Form(None),
    files: List[UploadFile] = File(...),
    client_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db),
):
    """
    Create an editing request with the client's own source media.

    Validation happens before anything is written, so a rejected request leaves
    no partial rows and no orphaned files on disk.
    """
    title = (title or "").strip()
    instructions = (instructions or "").strip()
    if not title:
        raise HTTPException(400, "A request title is required")
    if len(instructions) < MIN_INSTRUCTIONS_CHARS:
        raise HTTPException(
            400,
            f"Editing instructions are required (at least {MIN_INSTRUCTIONS_CHARS} characters), "
            "so the creator knows what to do.",
        )
    if deliverable_type not in DELIVERABLE_TYPES:
        raise HTTPException(400, f"deliverable_type must be one of {', '.join(DELIVERABLE_TYPES)}")

    parsed_deadline = None
    if deadline:
        try:
            parsed_deadline = datetime.fromisoformat(deadline.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(400, "deadline must be an ISO 8601 datetime")

    if budget is not None and budget < 0:
        raise HTTPException(400, "budget cannot be negative")
    if target_duration_seconds is not None and target_duration_seconds <= 0:
        raise HTTPException(400, "target_duration_seconds must be positive")

    creator = _eligible_creator(creator_id, db)
    if creator.id == client_user.id:
        raise HTTPException(400, "You cannot send an editing request to yourself")

    real_files = [f for f in files if f and f.filename]
    if not real_files:
        raise HTTPException(400, "Attach at least one photo or video to edit")
    if len(real_files) > MAX_FILES_PER_REQUEST:
        raise HTTPException(400, f"Attach at most {MAX_FILES_PER_REQUEST} files per request")

    staged = []
    total = 0
    for upload in real_files:
        name = upload.filename or "upload"
        ext = os.path.splitext(name)[1].lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(
                400,
                f"'{name}': unsupported format '{ext}'. "
                f"Allowed: {', '.join(sorted(ALLOWED_EXT))}",
            )

        data = await upload.read()
        if not data:
            raise HTTPException(400, f"'{name}' is empty or the upload did not complete")
        if len(data) > MAX_FILE_BYTES:
            raise HTTPException(413, f"'{name}' exceeds the {MAX_FILE_MB} MB per-file limit")

        total += len(data)
        if total > MAX_TOTAL_BYTES:
            raise HTTPException(413, f"The attachments exceed the {MAX_TOTAL_MB} MB total limit")

        content_type = _detect_content_type(data, name)
        if content_type is None:
            raise HTTPException(
                400,
                f"'{name}' does not look like a supported photo or video file. "
                "Its contents do not match an accepted format.",
            )
        media_type = _media_type_for(content_type)
        if media_type == "video" and ext not in ALLOWED_VIDEO_EXT:
            raise HTTPException(400, f"'{name}' contains video but has a photo extension")
        if media_type == "image" and ext not in ALLOWED_IMAGE_EXT:
            raise HTTPException(400, f"'{name}' contains an image but has a video extension")

        info = media_probe.probe(data, content_type, name) if media_type == "video" else {}
        if media_type == "video":
            playable, reason = media_probe.is_browser_playable(info, "video")
            if not playable:
                raise HTTPException(400, f"'{name}': {reason}")

        staged.append({
            "data": data,
            "name": name,
            "ext": ext,
            "content_type": content_type,
            "media_type": media_type,
            "info": info or {},
        })

    order = Order(
        client_id=client_user.id,
        creator_id=creator.id,
        title=title,
        brief=instructions,
        requirements="\n".join(filter(None, [
            f"Deliverable type: {deliverable_type}",
            f"Preferred style: {preferred_style}" if preferred_style else None,
            f"Deliverables: {deliverables}" if deliverables else None,
            f"Format: {output_format}" if output_format else None,
            f"Aspect ratio: {aspect_ratio}" if aspect_ratio else None,
            f"Target duration: {target_duration_seconds}s" if target_duration_seconds else None,
            f"Client supplied {len(staged)} source file(s) for editing.",
        ])),
        budget=budget or 0,
        deadline=parsed_deadline,
        status="pending",
    )
    db.add(order)
    db.flush()

    req = EditingRequest(
        order_id=order.id,
        client_id=client_user.id,
        creator_id=creator.id,
        title=title,
        instructions=instructions,
        preferred_style=preferred_style,
        deliverables=deliverables,
        deliverable_type=deliverable_type,
        output_format=output_format,
        aspect_ratio=aspect_ratio,
        target_duration_seconds=target_duration_seconds,
        budget=budget,
        deadline=parsed_deadline,
        status="pending_creator_response",
    )
    db.add(req)
    db.flush()

    written_paths = []
    try:
        for item in staged:
            storage_key = f"req{req.id}_{uuid.uuid4().hex}{item['ext']}"
            path = os.path.join(SOURCE_MEDIA_DIR, storage_key)
            with open(path, "wb") as fh:
                fh.write(item["data"])
            written_paths.append(path)

            on_disk = os.path.getsize(path)
            if on_disk != len(item["data"]):
                raise HTTPException(
                    500,
                    f"'{item['name']}' was only partially stored "
                    f"({on_disk} of {len(item['data'])} bytes). Please try again.",
                )

            info = item["info"]
            duration = info.get("duration")
            db.add(EditingRequestMedia(
                request_id=req.id,
                media_type=item["media_type"],
                storage_key=storage_key,
                original_filename=item["name"],
                detected_content_type=item["content_type"],
                file_size=len(item["data"]),
                duration=int(duration) if duration else None,
                width=info.get("width"),
                height=info.get("height"),
                probe_metadata={
                    "has_video_track": info.get("has_video_track"),
                    "has_audio_track": info.get("has_audio_track"),
                    "video_codec": info.get("video_codec"),
                    "note": info.get("probe_note"),
                } if info else None,
            ))

        existing_chat = db.query(Chat).filter(
            Chat.client_id == client_user.id,
            Chat.creator_id == creator.id,
        ).first()
        if existing_chat:
            setattr(existing_chat, "last_message", f"Editing request sent: {title}")
        else:
            db.add(Chat(
                client_id=client_user.id,
                creator_id=creator.id,
                order_id=order.id,
                last_message=f"Editing request sent: {title}",
            ))

        db.commit()
    except Exception:
        db.rollback()
        for path in written_paths:
            try:
                os.remove(path)
            except OSError:
                pass
        raise

    db.refresh(req)

    create_notification(
        db=db, user_id=creator.id, title="New editing request",
        message=(
            f"{client_user.name} sent an editing request: '{title}' "
            f"with {len(staged)} source file(s). Review it and accept or decline."
        ),
        type="order",
    )
    create_notification(
        db=db, user_id=client_user.id, title="Editing request sent",
        message=(
            f"Your request '{title}' was sent to {creator.name}. "
            "It is awaiting their response - they have not accepted it yet."
        ),
        type="info",
    )

    return _format_request(req)

@router.get("/my")
def list_my_requests(
    status: Optional[str] = Query(None),
    client_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db),
):
    """The requesting client's own editing requests. Scoped to them in SQL."""
    q = db.query(EditingRequest).filter(EditingRequest.client_id == client_user.id)
    if status:
        q = q.filter(EditingRequest.status == status)
    rows = q.order_by(EditingRequest.created_at.desc()).all()
    return [_format_request(r) for r in rows]

@router.get("/assigned")
def list_assigned_requests(
    status: Optional[str] = Query(None),
    creator_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Requests addressed to the authenticated creator — and only those.

    There is deliberately no endpoint that returns every client's media.
    """
    q = db.query(EditingRequest).filter(EditingRequest.creator_id == creator_user.id)
    if status:
        q = q.filter(EditingRequest.status == status)
    rows = q.order_by(EditingRequest.created_at.desc()).all()
    return [_format_request(r) for r in rows]

@router.get("/{request_id}")
def get_editing_request(
    request_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _format_request(_authorised_request(request_id, user, db))

@router.post("/{request_id}/respond")
def respond_to_request(
    request_id: int,
    data: dict = Body(...),
    creator_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db),
):
    """
    Accept or decline a request addressed to this creator.

    Acceptance moves the owning Order into the existing `accepted` state, from
    which the normal delivery workflow takes over.
    """
    req = db.query(EditingRequest).filter(EditingRequest.id == request_id).first()
    if not req or req.creator_id != creator_user.id:
        raise HTTPException(404, "Editing request not found")

    accept = data.get("accept")
    if not isinstance(accept, bool):
        raise HTTPException(400, "'accept' must be true or false")

    if req.status != "pending_creator_response":
        raise HTTPException(
            400,
            f"This request has already been answered (status: {req.status}).",
        )

    note = (data.get("note") or "").strip() or None
    now = datetime.now(timezone.utc)
    order = db.query(Order).filter(Order.id == req.order_id).first()

    if accept:
        setattr(req, "status", "accepted")
        if order:
            setattr(order, "status", "accepted")
        client_title = "Editing request accepted"
        client_msg = f"{creator_user.name} accepted your request '{req.title}' and can now start work."
    else:
        if not note:
            raise HTTPException(400, "Please give the client a reason when declining")
        setattr(req, "status", "declined")
        if order:
            setattr(order, "status", "cancelled")
        client_title = "Editing request declined"
        client_msg = f"{creator_user.name} declined your request '{req.title}'. Reason: {note}"

    setattr(req, "creator_response_note", note)
    setattr(req, "responded_at", now)
    db.commit()
    db.refresh(req)

    create_notification(db=db, user_id=req.client_id, title=client_title,
                        message=client_msg, type="order")

    return _format_request(req)

@router.post("/{request_id}/cancel")
def cancel_request(
    request_id: int,
    client_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db),
):
    """A client may withdraw a request the creator has not yet answered."""
    req = db.query(EditingRequest).filter(EditingRequest.id == request_id).first()
    if not req or req.client_id != client_user.id:
        raise HTTPException(404, "Editing request not found")
    if req.status != "pending_creator_response":
        raise HTTPException(400, f"Only an unanswered request can be cancelled (status: {req.status})")

    setattr(req, "status", "cancelled")
    order = db.query(Order).filter(Order.id == req.order_id).first()
    if order:
        setattr(order, "status", "cancelled")
    db.commit()
    db.refresh(req)

    create_notification(db=db, user_id=req.creator_id, title="Editing request withdrawn",
                        message=f"{client_user.name} withdrew the request '{req.title}'.",
                        type="info")
    return _format_request(req)

def _authorised_media(request_id: int, media_id: int, user: User, db: Session):
    """
    Resolve one media file, re-checking authorisation on every call.

    A creator reaches a client's media only while the request is addressed to
    them and they have not declined it.
    """
    req = _authorised_request(request_id, user, db)

    if user.role == "creator" and req.status in ("declined", "cancelled"):
        raise HTTPException(403, "This request is closed, so its media is no longer available")

    media = db.query(EditingRequestMedia).filter(
        EditingRequestMedia.id == media_id,
        EditingRequestMedia.request_id == req.id,
        EditingRequestMedia.is_deleted == False,  # noqa: E712
    ).first()
    if not media:
        raise HTTPException(404, "Media not found")

    path = os.path.join(SOURCE_MEDIA_DIR, media.storage_key)
    if not os.path.exists(path):
        raise HTTPException(404, "Media file is missing from storage")
    return media, path

@router.get("/{request_id}/media/{media_id}/stream")
def stream_source_media(
    request_id: int,
    media_id: int,
    user: User = Depends(_get_user_for_media),
    db: Session = Depends(get_db),
):
    """Inline playback/preview of one source file. Range requests supported."""
    media, path = _authorised_media(request_id, media_id, user, db)
    return FileResponse(
        path,
        media_type=media.detected_content_type or "application/octet-stream",
        headers={"Content-Disposition": "inline"},
    )

@router.get("/{request_id}/media/{media_id}/download")
def download_source_media(
    request_id: int,
    media_id: int,
    user: User = Depends(_get_user_for_media),
    db: Session = Depends(get_db),
):
    """Download one source file, under the same authorisation as streaming."""
    media, path = _authorised_media(request_id, media_id, user, db)
    return FileResponse(
        path,
        media_type=media.detected_content_type or "application/octet-stream",
        filename=media.original_filename or media.storage_key,
    )

@router.get("/config/limits")
def get_limits(_user: User = Depends(get_current_user)):
    """Upload limits, so the UI enforces the same numbers the server does."""
    return {
        "max_files_per_request": MAX_FILES_PER_REQUEST,
        "max_file_mb": MAX_FILE_MB,
        "max_total_mb": MAX_TOTAL_MB,
        "allowed_video_extensions": sorted(ALLOWED_VIDEO_EXT),
        "allowed_image_extensions": sorted(ALLOWED_IMAGE_EXT),
        "min_instructions_chars": MIN_INSTRUCTIONS_CHARS,
        "deliverable_types": list(DELIVERABLE_TYPES),
        "storage": "private-disk",
    }
