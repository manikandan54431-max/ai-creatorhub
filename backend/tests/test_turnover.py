"""
Turnover reporting tests (Issue 4).

Covers the boundary cases the brief calls for: a transaction exactly at the
period start, just before the exclusive end, exactly at the next period
boundary, excluded statuses, and refund handling per the documented rule.

All payments here are isolated fixtures created inside the test transaction.
"""

from datetime import datetime, date, timedelta, timezone

import pytest

from app.models.order import Order, Payment
from app.services import revenue

def test_week_bounds_are_monday_to_monday_half_open():
    start, end, label = revenue.period_bounds("week", date(2026, 10, 24))  # a Saturday
    assert start == datetime(2026, 10, 18, 18, 30)
    assert end == datetime(2026, 10, 25, 18, 30)
    assert end - start == timedelta(days=7)
    assert label == "Week of 19 Oct 2026"

def test_month_bounds_handle_leap_february():
    start, end, label = revenue.period_bounds("month", date(2024, 2, 10))
    assert start == datetime(2024, 1, 31, 18, 30)   # 1 Feb 00:00 IST
    assert end == datetime(2024, 2, 29, 18, 30)     # 1 Mar 00:00 IST -> 29 days
    assert end - start == timedelta(days=29)
    assert label == "February 2024"

def test_month_bounds_handle_december_year_rollover():
    start, end, _ = revenue.period_bounds("month", date(2026, 12, 15))
    assert start == datetime(2026, 11, 30, 18, 30)
    assert end == datetime(2026, 12, 31, 18, 30)    # 1 Jan 2027 00:00 IST

def test_year_bounds_span_a_full_year():
    start, end, label = revenue.period_bounds("year", date(2026, 7, 1))
    assert start == datetime(2025, 12, 31, 18, 30)  # 1 Jan 2026 00:00 IST
    assert end == datetime(2026, 12, 31, 18, 30)    # 1 Jan 2027 00:00 IST
    assert label == "2026"

def test_all_period_applies_no_bounds():
    start, end, label = revenue.period_bounds("all")
    assert start is None and end is None
    assert label == "All time"

def test_unknown_period_is_rejected():
    with pytest.raises(ValueError):
        revenue.period_bounds("fortnight", date(2026, 10, 24))

def _pay(db, order, client_id, creator_id, amount, status, created_at):
    p = Payment(
        order_id=order.id,
        client_id=client_id,
        creator_id=creator_id,
        amount=amount,
        commission=amount * 0.2,
        creator_earnings=amount * 0.8,
        status=status,
        created_at=created_at,
    )
    db.add(p)
    db.commit()
    return p

@pytest.fixture
def order_for_payments(db, client_user, creator_user):
    o = Order(
        client_id=client_user["user"].id,
        creator_id=creator_user["user"].id,
        title="Turnover fixture order",
        budget=1000,
        status="completed",
    )
    db.add(o)
    db.commit()
    db.refresh(o)
    return o

def test_boundary_payments_land_in_exactly_one_period(db, order_for_payments, client_user, creator_user):
    """Start-inclusive, end-exclusive: no double counting, no gaps."""
    anchor = date(2026, 10, 24)
    start, end, _ = revenue.period_bounds("week", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id

    _pay(db, order_for_payments, cid, crid, 100, "completed", start)
    _pay(db, order_for_payments, cid, crid, 200, "completed", end - timedelta(seconds=1))
    _pay(db, order_for_payments, cid, crid, 400, "completed", end)
    _pay(db, order_for_payments, cid, crid, 800, "completed", start - timedelta(seconds=1))

    this_week = revenue.turnover_summary(db, "week", anchor)
    assert this_week["turnover"] == 300.0
    assert this_week["completed_count"] == 2

    next_week = revenue.turnover_summary(db, "week", anchor + timedelta(days=7))
    assert next_week["turnover"] == 400.0

    prev_week = revenue.turnover_summary(db, "week", anchor - timedelta(days=7))
    assert prev_week["turnover"] == 800.0

    assert this_week["turnover"] + next_week["turnover"] + prev_week["turnover"] == 1500.0

def test_pending_failed_and_cancelled_are_excluded(db, order_for_payments, client_user, creator_user):
    anchor = date(2026, 10, 24)
    start, _end, _ = revenue.period_bounds("month", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id
    inside = start + timedelta(days=1)

    _pay(db, order_for_payments, cid, crid, 500, "completed", inside)
    _pay(db, order_for_payments, cid, crid, 999, "pending", inside)
    _pay(db, order_for_payments, cid, crid, 777, "failed", inside)
    _pay(db, order_for_payments, cid, crid, 123, "cancelled", inside)

    s = revenue.turnover_summary(db, "month", anchor)
    assert s["turnover"] == 500.0
    assert s["completed_count"] == 1
    assert s["pending_count"] == 1
    assert s["failed_count"] == 1

def test_refunds_are_reported_separately_and_not_netted_off_turnover(
    db, order_for_payments, client_user, creator_user
):
    anchor = date(2026, 10, 24)
    start, _end, _ = revenue.period_bounds("month", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id
    inside = start + timedelta(days=2)

    _pay(db, order_for_payments, cid, crid, 1000, "completed", inside)
    _pay(db, order_for_payments, cid, crid, 250, "refunded", inside)

    s = revenue.turnover_summary(db, "month", anchor)
    assert s["turnover"] == 1000.0
    assert s["refunded_amount"] == 250.0
    assert s["refunded_count"] == 1
    assert s["net_after_refunds"] == 750.0

def test_commission_and_earnings_are_not_conflated_with_turnover(
    db, order_for_payments, client_user, creator_user
):
    anchor = date(2026, 10, 24)
    start, _end, _ = revenue.period_bounds("month", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id

    _pay(db, order_for_payments, cid, crid, 1000, "completed", start + timedelta(days=1))

    s = revenue.turnover_summary(db, "month", anchor)
    assert s["turnover"] == 1000.0
    assert s["platform_commission"] == 200.0
    assert s["creator_earnings"] == 800.0
    assert s["turnover"] != s["platform_commission"] != s["creator_earnings"]

def test_empty_period_reports_zero_not_an_error(db):
    s = revenue.turnover_summary(db, "year", date(1999, 6, 1))
    assert s["turnover"] == 0.0
    assert s["completed_count"] == 0

def test_summary_reports_the_window_it_queried(db):
    s = revenue.turnover_summary(db, "month", date(2026, 10, 24))
    assert s["range_start_utc"] == "2026-09-30T18:30:00"
    assert s["range_end_utc_exclusive"] == "2026-10-31T18:30:00"
    assert s["timezone"] == "Asia/Kolkata"
    assert s["currency"] == "INR"

def test_each_payment_counted_once_no_join_fanout(db, order_for_payments, client_user, creator_user):
    """
    The order has multiple delivery submissions; turnover must not multiply.
    """
    from app.models.delivery import DeliverySubmission

    anchor = date(2026, 10, 24)
    start, _end, _ = revenue.period_bounds("month", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id

    for v in (1, 2, 3):
        db.add(DeliverySubmission(
            order_id=order_for_payments.id, creator_id=crid,
            version_number=v, title=f"v{v}", status="approved",
        ))
    db.commit()

    _pay(db, order_for_payments, cid, crid, 600, "completed", start + timedelta(days=1))

    s = revenue.turnover_summary(db, "month", anchor)
    assert s["turnover"] == 600.0
    assert s["completed_count"] == 1

def test_turnover_endpoint_requires_admin(client, creator_user):
    r = client.get("/api/admin/turnover", headers=creator_user["headers"])
    assert r.status_code == 403

def test_turnover_endpoint_rejects_anonymous(client):
    r = client.get("/api/admin/turnover")
    assert r.status_code in (401, 403)

def test_turnover_endpoint_returns_summary(client, admin_user):
    r = client.get("/api/admin/turnover?period=month", headers=admin_user["headers"])
    assert r.status_code == 200
    body = r.json()
    for key in (
        "turnover", "platform_commission", "creator_earnings", "refunded_amount",
        "net_after_refunds", "period_label", "timezone", "currency",
        "turnover_definition",
    ):
        assert key in body

def test_turnover_endpoint_rejects_bad_period(client, admin_user):
    r = client.get("/api/admin/turnover?period=decade", headers=admin_user["headers"])
    assert r.status_code == 422

def test_turnover_endpoint_rejects_bad_anchor(client, admin_user):
    r = client.get("/api/admin/turnover?period=week&anchor=not-a-date", headers=admin_user["headers"])
    assert r.status_code == 400

def test_payments_list_and_summary_agree(client, admin_user, db, order_for_payments, client_user, creator_user):
    """The list and the summary must describe the same rows."""
    anchor = date(2026, 10, 24)
    start, _end, _ = revenue.period_bounds("month", anchor)
    cid, crid = client_user["user"].id, creator_user["user"].id
    _pay(db, order_for_payments, cid, crid, 300, "completed", start + timedelta(days=1))
    _pay(db, order_for_payments, cid, crid, 700, "completed", start + timedelta(days=2))
    _pay(db, order_for_payments, cid, crid, 5000, "completed", start - timedelta(days=40))

    r = client.get(
        f"/api/admin/payments?period=month&anchor={anchor.isoformat()}",
        headers=admin_user["headers"],
    )
    assert r.status_code == 200
    body = r.json()
    listed = [p for p in body["payments"] if p["status"] == "completed"]
    assert sum(p["amount"] for p in listed) == body["summary"]["turnover"] == 1000.0

def test_payment_payload_exposes_platform_fee_and_names(
    client, admin_user, db, order_for_payments, client_user, creator_user
):
    """Regression guard for the Issue 6 field-name mismatch that produced NaN."""
    cid, crid = client_user["user"].id, creator_user["user"].id
    _pay(db, order_for_payments, cid, crid, 1000, "completed", datetime(2026, 10, 20, 12, 0))

    r = client.get("/api/admin/payments", headers=admin_user["headers"])
    assert r.status_code == 200
    p = r.json()["payments"][0]
    assert p["platform_fee"] == 200.0
    assert p["commission"] == 200.0          # legacy name kept
    assert p["creator_earnings"] == 800.0
    assert p["client_name"] == "Client Test"
    assert p["creator_name"] == "Creator Test"
    assert all(p[k] is not None for k in ("platform_fee", "client_name", "creator_name"))

def test_turnover_series_returns_consecutive_periods_oldest_first(client, admin_user):
    r = client.get(
        "/api/admin/turnover/series?period=month&count=3&anchor=2026-10-24",
        headers=admin_user["headers"],
    )
    assert r.status_code == 200
    series = r.json()
    assert [s["period_label"] for s in series] == ["August 2026", "September 2026", "October 2026"]
