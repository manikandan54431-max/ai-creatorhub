"""
Delivery Release Service
=========================
Shared logic for releasing a delivery submission to the client.
Used by BOTH:
  1. Admin manual approval (deliveries.py → approve_delivery)
  2. Auto-release scheduler (workers/auto_release_worker.py)

Using a shared service ensures consistent state transitions,
audit logs, and notifications regardless of release path.

Safe concurrency:
  The function checks status == "pending_review" inside the same
  transaction. If an admin approved while the worker runs, the
  worker's query finds status != "pending_review" and exits cleanly.
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session

from app.models.delivery import DeliverySubmission, DeliveryAuditLog
from app.models.order import Order, Notification
from app.services.notification_service import create_notification

def _kind(sub: DeliverySubmission) -> str:
    """Word for the deliverable's media type, so notifications read correctly
    for photo deliverables as well as video ones (Issue 5D). The release logic
    itself is type-agnostic: it only moves status and timestamps."""
    return "image" if (sub.detected_content_type or "").startswith("image/") else "video"

def release_delivery(
    db: Session,
    submission: DeliverySubmission,
    release_method: str,          # "admin_approved" | "auto_released_after_timeout"
    reviewer_id: int | None,      # Admin user ID for manual; None for auto
    internal_notes: str | None = None,
) -> bool:
    """
    Atomically approve and release a delivery submission.

    Returns True if released, False if the submission was no longer eligible
    (e.g., already approved or changed by a concurrent admin action).

    Caller must hold a DB session; this function commits the transaction.
    """
    _fresh = db.query(DeliverySubmission).filter(
        DeliverySubmission.id == submission.id,
        DeliverySubmission.status == "pending_review",  # Safety guard
    ).first()

    if _fresh is None:
        return False

    fresh: DeliverySubmission = _fresh

    order = db.query(Order).filter(Order.id == fresh.order_id).first()
    if not order:
        return False

    if order.status in ("cancelled", "completed"):
        return False

    now = datetime.now(timezone.utc)

    db.query(DeliverySubmission).filter(
        DeliverySubmission.order_id == fresh.order_id,
        DeliverySubmission.id != fresh.id,
        DeliverySubmission.status == "approved",
    ).update({"status": "superseded"}, synchronize_session=False)

    setattr(fresh, 'status', 'approved')
    setattr(fresh, 'reviewed_by', reviewer_id)
    setattr(fresh, 'reviewed_at', now)
    setattr(fresh, 'approved_at', now)
    setattr(fresh, 'delivered_at', now)
    setattr(fresh, 'released_at', now)
    setattr(fresh, 'release_method', release_method)
    if internal_notes is not None:
        setattr(fresh, 'internal_admin_notes', internal_notes)

    if order.status in ("in_progress", "assigned", "accepted", "revision_requested"):
        setattr(order, 'status', 'delivered')

    db.commit()
    db.refresh(fresh)

    _write_audit(db, fresh, reviewer_id, release_method)

    _notify_release(db, fresh, order, release_method)

    return True

def _write_audit(
    db: Session,
    sub: DeliverySubmission,
    actor_id: int | None,
    release_method: str,
):
    action = "approved" if release_method == "admin_approved" else "auto_released"
    details = (
        f"v{sub.version_number} released via {release_method}"
        + (f" by admin #{actor_id}" if actor_id else " (automatic)")
    )
    log = DeliveryAuditLog(
        delivery_id=sub.id,
        order_id=sub.order_id,
        actor_id=actor_id or sub.creator_id,  # Use creator as actor for auto (no admin)
        actor_role="admin" if actor_id else "system",
        action=action,
        details=details,
    )
    db.add(log)

    log2 = DeliveryAuditLog(
        delivery_id=sub.id,
        order_id=sub.order_id,
        actor_id=actor_id or sub.creator_id,
        actor_role="admin" if actor_id else "system",
        action="delivered_to_client",
        details=f"v{sub.version_number} made available to client via {release_method}",
    )
    db.add(log2)
    db.commit()

def _notify_release(
    db: Session,
    sub: DeliverySubmission,
    order: Order,
    release_method: str,
):
    order_title = order.title or f"Order #{sub.order_id}"

    if release_method == "admin_approved":
        creator_msg = (
            f"Your {_kind(sub)} (v{sub.version_number}) for '{order_title}' "
            f"has been reviewed and approved by admin. It's now delivered to the client."
        )
        client_msg = (
            f"Your project {_kind(sub)} for '{order_title}' has been Admin Approved "
            f"and is now available for your review."
        )
        client_title = "🎬 Your Project Video is Ready (Admin Approved)"
    else:
        creator_msg = (
            f"Your {_kind(sub)} (v{sub.version_number}) for '{order_title}' "
            f"has been automatically released to the client. "
            f"The 24-hour admin review window expired with no decision."
        )
        client_msg = (
            f"Your project {_kind(sub)} for '{order_title}' is now available. "
            f"Label: Automatically Released — Review Window Expired."
        )
        client_title = "🎬 Your Project Video is Ready (Auto-Released)"

    create_notification(
        db=db,
        user_id=sub.creator_id,
        title="✅ Video Delivered to Client",
        message=creator_msg,
        type="success",
    )
    create_notification(
        db=db,
        user_id=order.client_id,
        title=client_title,
        message=client_msg,
        type="success",
    )
