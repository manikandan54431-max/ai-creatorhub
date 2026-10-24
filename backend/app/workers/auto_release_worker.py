"""
Auto-Release Worker
====================
Durable background scheduler that checks for delivery submissions
whose 24-hour admin review window has expired and automatically
releases them to the client.

Policy:
  - Creator submits → review_due_at is set to submitted_at + AUTO_RELEASE_HOURS
  - This worker runs every AUTO_RELEASE_INTERVAL_SECONDS (default: 60s)
  - If a submission is still pending_review after review_due_at passes,
    it is released via the shared delivery_release service
  - Release occurs on the next scheduler pass AFTER the deadline
    (not at the exact second)

Concurrency safety:
  - release_delivery() re-queries with status == "pending_review" inside
    the same transaction, so concurrent admin approvals are safe
  - Multiple worker instances are safe: only the first to commit wins

This worker is started via FastAPI lifespan events in main.py.
"""
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None

def _process_overdue_submissions():
    """
    Called by the scheduler every AUTO_RELEASE_INTERVAL_SECONDS.
    Finds all pending_review submissions past their review_due_at and releases them.
    """
    from app.core.database import SessionLocal
    from app.models.delivery import DeliverySubmission
    from app.services.delivery_release import release_delivery

    db = SessionLocal()
    try:
        now = datetime.now(timezone.utc)

        candidates = db.query(DeliverySubmission).filter(
            DeliverySubmission.status == "pending_review",
            DeliverySubmission.review_due_at.isnot(None),
        ).all()

        overdue = []
        for sub in candidates:
            due = sub.review_due_at
            if due.tzinfo is None:
                due = due.replace(tzinfo=timezone.utc)
            if due <= now:
                overdue.append(sub)

        if not overdue:
            return

        logger.info("Auto-release worker: found %d overdue submission(s)", len(overdue))

        for sub in overdue:
            try:
                released = release_delivery(
                    db=db,
                    submission=sub,
                    release_method="auto_released_after_timeout",
                    reviewer_id=None,  # No admin — automatic
                )
                if released:
                    logger.info(
                        "Auto-released delivery #%d (order #%d, v%d)",
                        sub.id, sub.order_id, sub.version_number,
                    )
                else:
                    logger.debug(
                        "Delivery #%d was not auto-released (likely already handled by admin)",
                        sub.id,
                    )
            except Exception as exc:
                logger.error(
                    "Error auto-releasing delivery #%d: %s", sub.id, exc, exc_info=True
                )
    except Exception as exc:
        logger.error("Auto-release worker error: %s", exc, exc_info=True)
    finally:
        db.close()

def start_scheduler():
    """Start the APScheduler background scheduler. Called from FastAPI lifespan."""
    global _scheduler

    interval = max(10, settings.AUTO_RELEASE_INTERVAL_SECONDS)  # Minimum 10s for safety

    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _process_overdue_submissions,
        trigger="interval",
        seconds=interval,
        id="auto_release_delivery",
        name="Auto-release overdue delivery submissions",
        max_instances=1,          # Prevent overlapping executions
        coalesce=True,            # Skip missed runs (don't catch up)
        replace_existing=True,
    )
    _scheduler.start()
    logger.info(
        "Auto-release scheduler started. Interval: %ds, Window: %dh",
        interval, settings.AUTO_RELEASE_HOURS,
    )

def stop_scheduler():
    """Stop the scheduler on app shutdown."""
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Auto-release scheduler stopped.")
