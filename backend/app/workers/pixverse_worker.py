"""
PixVerse Polling Worker
=======================
Durable background scheduler that advances in-flight PixVerse jobs without
holding any browser request open. On each pass it:

  - finds this creator-agnostic set of jobs still in flight
    (generating / saving_output) that have a provider task id,
  - polls the provider result endpoint (one call per job, with an overall
    per-job timeout and a bounded poll rate),
  - maps the provider status to the local status,
  - on success: downloads the output, validates it is a real video (not
    JSON/HTML), stores it privately, and marks the job completed,
  - on moderation/failure/timeout: marks the job failed with a safe message.

A completed generation provider-side that fails to download is left in
saving_output and retried on the next pass — it never triggers a new
(chargeable) generation.

Single scheduler instance, max_instances=1: no duplicate polling of a job.
"""
import logging
import os
from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.services import pixverse_service as pv

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None

_BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
PIXVERSE_DIR = os.path.join(_BASE, "private_uploads", "pixverse")
os.makedirs(PIXVERSE_DIR, exist_ok=True)


def _is_timed_out(job, now) -> bool:
    start = job.submitted_at or job.created_at
    if start is None:
        return False
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return (now - start).total_seconds() > settings.PIXVERSE_JOB_TIMEOUT_SECONDS


def _store_output(job, data: bytes, content_type) -> None:
    storage_key = f"pixverse_{job.creator_id}_{job.id}.mp4"
    path = os.path.join(PIXVERSE_DIR, storage_key)
    with open(path, "wb") as f:
        f.write(data)
    written = os.path.getsize(path)
    if written != len(data):
        os.remove(path)
        raise pv.PixVerseError("Stored output was incomplete.", code="store_failed", retryable=True)
    job.storage_key = storage_key
    job.output_content_type = content_type or "video/mp4"
    job.output_file_size = len(data)


def _validate_video(data: bytes, content_type) -> None:
    """Reject JSON/HTML/empty payloads masquerading as video."""
    from app.services import media_probe
    if not data or len(data) < 1024:
        raise pv.PixVerseError("The provider returned an empty or truncated video.", code="bad_output", retryable=True)
    head = data[:64].lstrip()[:16].lower()
    if head.startswith(b"<!doctype") or head.startswith(b"<html") or head.startswith(b"{") or head.startswith(b"["):
        raise pv.PixVerseError("The downloaded output was not a video file.", code="bad_output")
    ct = (content_type or "").lower()
    if ct and not (ct.startswith("video/") or ct == "application/octet-stream" or ct.startswith("binary/")):
        raise pv.PixVerseError(f"Unexpected output content type: {ct}", code="bad_output")
    info = media_probe.probe(data, content_type or "video/mp4", "pixverse_output.mp4")
    # probe returns has_video_track False only when it positively parsed no video
    # track; None means "could not read", which we tolerate (don't false-reject).
    if info.get("has_video_track") is False:
        raise pv.PixVerseError("The generated file has no video track.", code="bad_output")


def _download_and_complete(job, url, db) -> None:
    job.status = "saving_output"
    db.commit()
    data, content_type = pv.download_output(url)
    _validate_video(data, content_type)
    _store_output(job, data, content_type)
    job.status = "completed"
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    try:
        from app.services.notification_service import create_notification
        create_notification(
            db=db, user_id=job.creator_id,
            title="AI video ready 🎬",
            message="Your AI-generated video has finished. Open the AI Generator to preview, save, or edit it.",
            type="success",
        )
    except Exception:
        pass


def _process_job(job, db) -> None:
    now = datetime.now(timezone.utc)

    if _is_timed_out(job, now) and job.status in ("generating", "queued"):
        job.status = "failed"
        job.error_message = "Generation timed out. Please try again."
        job.error_code = "timeout"
        db.commit()
        return

    # The scheduler interval paces polling; each pass polls each in-flight job once.
    job.poll_attempts = (job.poll_attempts or 0) + 1
    db.commit()

    try:
        res = pv.get_result(video_id=job.provider_task_id, trace_id=job.trace_id or pv.new_trace_id())
    except pv.PixVerseError as exc:
        if not exc.retryable:
            job.status = "failed"
            job.error_message = exc.message
            job.error_code = exc.code
            db.commit()
        # retryable: leave as-is for the next pass
        return

    status = res.get("status")
    job.provider_status = status if isinstance(status, int) else job.provider_status

    if status == pv.STATUS_SUCCESS:
        url = res.get("url")
        if not url:
            # Success reported but no URL yet; try again next pass.
            return
        try:
            _download_and_complete(job, url, db)
        except pv.PixVerseError as exc:
            # Keep in saving_output if retryable (no re-generation); else fail.
            job.status = "saving_output" if exc.retryable else "failed"
            job.error_message = exc.message
            job.error_code = exc.code
            db.commit()
    elif status == pv.STATUS_GENERATING:
        if job.status != "generating":
            job.status = "generating"
            db.commit()
    elif status == pv.STATUS_MODERATION_FAILED:
        job.status = "failed"
        job.error_message = "The prompt was rejected by content moderation. Please revise it."
        job.error_code = "moderation"
        db.commit()
    elif status == pv.STATUS_FAILED:
        job.status = "failed"
        job.error_message = "The provider failed to generate this video. Please try again."
        job.error_code = "provider_failed"
        db.commit()
    # Unknown status: leave for next pass (bounded by overall timeout).


def _process_inflight_jobs():
    from app.core.database import SessionLocal
    from app.models.pixverse_job import PixVerseJob

    db = SessionLocal()
    try:
        jobs = db.query(PixVerseJob).filter(
            PixVerseJob.status.in_(("generating", "saving_output")),
            PixVerseJob.provider_task_id.isnot(None),
        ).all()
        for job in jobs:
            try:
                _process_job(job, db)
            except Exception as exc:
                logger.error("PixVerse worker error on job #%s: %s", job.id, exc, exc_info=True)
                db.rollback()
    except Exception as exc:
        logger.error("PixVerse worker pass error: %s", exc, exc_info=True)
    finally:
        db.close()


def start_pixverse_scheduler():
    global _scheduler
    if not pv.is_configured():
        logger.info("PixVerse worker not started (no API key configured).")
        return
    interval = max(5, min(settings.PIXVERSE_POLL_INTERVAL_SECONDS, 60))
    _scheduler = BackgroundScheduler(timezone="UTC")
    _scheduler.add_job(
        _process_inflight_jobs,
        trigger="interval",
        seconds=interval,
        id="pixverse_poll",
        name="Poll in-flight PixVerse generations",
        max_instances=1,
        coalesce=True,
        replace_existing=True,
    )
    _scheduler.start()
    logger.info("PixVerse polling worker started. Interval: %ds", interval)


def stop_pixverse_scheduler():
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("PixVerse polling worker stopped.")
