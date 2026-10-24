"""
Turnover reporting — the single source of truth for payment period filtering.

Both the summary totals and the transaction list go through `period_bounds()` and
`completed_payments_query()`, so a figure in a summary card can never disagree
with the rows listed underneath it.

TURNOVER DEFINITION (as implemented here)
─────────────────────────────────────────
"Turnover" means **gross completed-payment turnover**: the sum of
`Payment.amount` over payments whose `status == "completed"` and whose
`created_at` falls inside the selected period.

It is deliberately NOT any of these, which are reported as separate figures:

  * `platform_commission`  — the platform's 20% cut (`Payment.commission`)
  * `creator_earnings`     — what creators receive (`Payment.creator_earnings`)
  * `refunded_amount`      — reported separately and **never netted off**
                             turnover, because this codebase has no accounting
                             rule for refund periods (a refund carries no refund
                             timestamp, only `status`/`refund_status`), and
                             inventing one would misstate the books.

`net_after_refunds` is supplied as a clearly-labelled convenience value
(`turnover - refunded_amount` within the same period) so the UI can show it
under its own label rather than silently redefining turnover.

TIMESTAMP
─────────
`Payment.created_at` is the only payment timestamp the schema has — there is no
`completed_at` / `paid_at` column. It is therefore the documented turnover
timestamp. SQLite stores it via `func.now()`, i.e. **naive UTC**.

TIMEZONE
────────
The application had no timezone setting before this feature. Reporting periods
are human, local-calendar periods, so they are resolved in
`settings.REPORTING_TIMEZONE` (default `Asia/Kolkata`, matching the INR
currency the platform bills in) and then converted to UTC for the query.

Boundaries are **inclusive start, exclusive end** — `start <= created_at < end` —
so a payment at a period boundary is counted in exactly one period.

CURRENCY
────────
Single currency (INR). There is no currency column on `Payment`, so no
mixed-currency totals are possible.
"""

from __future__ import annotations

from datetime import datetime, date, timedelta, timezone
from typing import Literal, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.order import Payment

PeriodType = Literal["week", "month", "year", "all"]

COMPLETED_STATUSES = ("completed",)

EXCLUDED_STATUSES = ("pending", "failed", "cancelled", "refunded")

def reporting_tz() -> ZoneInfo:
    """The timezone reporting periods are expressed in."""
    name = getattr(settings, "REPORTING_TIMEZONE", "Asia/Kolkata")
    try:
        return ZoneInfo(name)
    except Exception:
        return ZoneInfo("UTC")

def _to_naive_utc(dt: datetime) -> datetime:
    """Convert an aware datetime to the naive-UTC form stored in the database."""
    return dt.astimezone(timezone.utc).replace(tzinfo=None)

def _local_midnight(d: date, tz: ZoneInfo) -> datetime:
    """Midnight on date `d` in timezone `tz`, as an aware datetime."""
    return datetime(d.year, d.month, d.day, tzinfo=tz)

def period_bounds(
    period: PeriodType,
    anchor: Optional[date] = None,
    *,
    week_start_monday: bool = True,
) -> tuple[Optional[datetime], Optional[datetime], str]:
    """
    Resolve a period to a half-open UTC window plus a human label.

    Returns ``(start_utc, end_utc, label)``. Both datetimes are naive UTC, ready
    to compare against ``Payment.created_at``. For ``period="all"`` both are
    ``None`` (no filtering).

    The window is **[start, end)** — inclusive start, exclusive end.

    `anchor` is a date *in the reporting timezone* that selects which week,
    month or year is wanted. It defaults to today in that timezone.

    Month and year arithmetic is calendar-based (not 30-day approximations), so
    month lengths, leap years and year rollovers are all handled correctly.
    """
    tz = reporting_tz()
    if anchor is None:
        anchor = datetime.now(tz).date()

    if period == "all":
        return None, None, "All time"

    if period == "week":
        offset = anchor.weekday() if week_start_monday else (anchor.weekday() + 1) % 7
        local_start = anchor - timedelta(days=offset)
        local_end = local_start + timedelta(days=7)
        label = f"Week of {local_start.strftime('%d %b %Y')}"

    elif period == "month":
        local_start = anchor.replace(day=1)
        if local_start.month == 12:
            local_end = local_start.replace(year=local_start.year + 1, month=1)
        else:
            local_end = local_start.replace(month=local_start.month + 1)
        label = local_start.strftime("%B %Y")

    elif period == "year":
        local_start = anchor.replace(month=1, day=1)
        local_end = local_start.replace(year=local_start.year + 1)
        label = local_start.strftime("%Y")

    else:
        raise ValueError(f"Unknown period '{period}'")

    start_utc = _to_naive_utc(_local_midnight(local_start, tz))
    end_utc = _to_naive_utc(_local_midnight(local_end, tz))
    return start_utc, end_utc, label

def payments_query(
    db: Session,
    start_utc: Optional[datetime],
    end_utc: Optional[datetime],
    *,
    status: Optional[str] = None,
):
    """
    Base payment query for a period. Used for both the summary and the list, so
    they always describe the same set of rows.

    `Payment.id` is the primary key and no joins are applied, so each payment is
    counted exactly once — there is no join fan-out or webhook duplication to
    guard against here.
    """
    q = db.query(Payment)
    if start_utc is not None:
        q = q.filter(Payment.created_at >= start_utc)
    if end_utc is not None:
        q = q.filter(Payment.created_at < end_utc)
    if status is not None:
        q = q.filter(Payment.status == status)
    return q

def completed_payments_query(db: Session, start_utc, end_utc):
    """Only payments eligible for turnover."""
    return payments_query(db, start_utc, end_utc).filter(
        Payment.status.in_(COMPLETED_STATUSES)
    )

def _sum(db: Session, column, start_utc, end_utc, statuses) -> float:
    q = db.query(func.coalesce(func.sum(column), 0.0)).filter(
        Payment.status.in_(statuses)
    )
    if start_utc is not None:
        q = q.filter(Payment.created_at >= start_utc)
    if end_utc is not None:
        q = q.filter(Payment.created_at < end_utc)
    return float(q.scalar() or 0.0)

def _count(db: Session, start_utc, end_utc, statuses) -> int:
    q = db.query(func.count(Payment.id)).filter(Payment.status.in_(statuses))
    if start_utc is not None:
        q = q.filter(Payment.created_at >= start_utc)
    if end_utc is not None:
        q = q.filter(Payment.created_at < end_utc)
    return int(q.scalar() or 0)

def turnover_summary(
    db: Session,
    period: PeriodType,
    anchor: Optional[date] = None,
) -> dict:
    """
    Compute the turnover summary for one period.

    Every figure is separately labelled; nothing is conflated. Sums are computed
    in SQL over the same filtered row set the transaction list uses.
    """
    start_utc, end_utc, label = period_bounds(period, anchor)
    tz = reporting_tz()

    turnover = _sum(db, Payment.amount, start_utc, end_utc, COMPLETED_STATUSES)
    commission = _sum(db, Payment.commission, start_utc, end_utc, COMPLETED_STATUSES)
    earnings = _sum(db, Payment.creator_earnings, start_utc, end_utc, COMPLETED_STATUSES)
    refunded = _sum(db, Payment.amount, start_utc, end_utc, ("refunded",))

    return {
        "period": period,
        "period_label": label,
        "timezone": str(tz),
        "range_start_utc": start_utc.isoformat() if start_utc else None,
        "range_end_utc_exclusive": end_utc.isoformat() if end_utc else None,
        "currency": "INR",

        "turnover": round(turnover, 2),
        "platform_commission": round(commission, 2),
        "creator_earnings": round(earnings, 2),
        "refunded_amount": round(refunded, 2),
        "net_after_refunds": round(turnover - refunded, 2),

        "completed_count": _count(db, start_utc, end_utc, COMPLETED_STATUSES),
        "pending_count": _count(db, start_utc, end_utc, ("pending",)),
        "failed_count": _count(db, start_utc, end_utc, ("failed",)),
        "refunded_count": _count(db, start_utc, end_utc, ("refunded",)),

        "turnover_definition": (
            "Gross sum of Payment.amount for payments with status='completed' "
            "and created_at within the selected period "
            "(inclusive start, exclusive end). Refunds are reported separately "
            "and are not deducted from turnover."
        ),
    }
