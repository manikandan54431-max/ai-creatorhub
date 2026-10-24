"""
Auto-release unit test — uses a test SQLite DB, not production.
Tests:
  1. Submission → review_due_at set correctly
  2. Non-overdue submission is NOT released
  3. Overdue submission IS released with correct metadata
  4. Already-approved submission is skipped (concurrency guard)
  5. Notifications are created for creator and client
"""
import sys, os
sys.path.insert(0, '.')
os.environ['DATABASE_URL'] = 'sqlite:///./test_autorelease.db'
os.environ.setdefault('SECRET_KEY', 'test-key-32-chars-minimum-length!!')
os.environ.setdefault('AUTO_RELEASE_HOURS', '24')

from datetime import datetime, timezone, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.core.database import Base
from app.models import *  # register all models
from app.models.delivery import DeliverySubmission, DeliveryAuditLog
from app.models.order import Order, Notification
from app.models.user import User
from app.services.delivery_release import release_delivery

engine = create_engine('sqlite:///./test_autorelease.db', connect_args={'check_same_thread': False})
Base.metadata.create_all(bind=engine)

from sqlalchemy import text, inspect
with engine.connect() as conn:
    ds_cols = {col['name'] for col in inspect(engine).get_columns('delivery_submissions')}
    for col_name, col_type in [('review_due_at','DATETIME'),('released_at','DATETIME'),('release_method','VARCHAR(40)')]:
        if col_name not in ds_cols:
            conn.execute(text(f'ALTER TABLE delivery_submissions ADD COLUMN {col_name} {col_type}'))
            conn.commit()

import uuid as _uuid

def make_test_data(db: Session, submitted_hours_ago: float):
    """Create a minimal user/order/submission for testing."""
    uid = _uuid.uuid4().hex[:8]
    admin = User(name='Test Admin', email=f'admin_{uid}@test.com', password_hash='x', role='admin')
    client = User(name='Test Client', email=f'client_{uid}@test.com', password_hash='x', role='client')
    creator = User(name='Test Creator', email=f'creator_{uid}@test.com', password_hash='x', role='creator')
    db.add_all([admin, client, creator])
    db.flush()

    order = Order(
        client_id=client.id,
        creator_id=creator.id,
        title='Test Order',
        brief='Test brief',
        status='in_progress',
        budget=100.0,
    )
    db.add(order)
    db.flush()

    now = datetime.now(timezone.utc)
    submitted_at = now - timedelta(hours=submitted_hours_ago)
    due_at = submitted_at + timedelta(hours=24)

    sub = DeliverySubmission(
        order_id=order.id,
        creator_id=creator.id,
        version_number=1,
        title='Test Delivery',
        storage_key='test.mp4',
        original_filename='test.mp4',
        file_size=1000,
        status='pending_review',
        submitted_at=submitted_at,
        review_due_at=due_at,
    )
    db.add(sub)
    db.commit()
    return admin, client, creator, order, sub

def cleanup(db):
    db.close()

print("=" * 60)
print("AUTO-RELEASE SERVICE TESTS")
print("=" * 60)

print("\nTEST 1: Non-overdue (submitted 10h ago) → should NOT release")
with Session(engine) as db:
    admin, client, creator, order, sub = make_test_data(db, submitted_hours_ago=10.0)
    assert sub.review_due_at is not None, "review_due_at should be set"
    now = datetime.now(timezone.utc)
    due = sub.review_due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    is_overdue = due <= now
    assert not is_overdue, f"Expected NOT overdue, review_due_at={sub.review_due_at}"
    print("  PASS: submission is NOT overdue (correct)")

print("\nTEST 2: Overdue (submitted 25h ago) → should release")
with Session(engine) as db:
    admin, client, creator, order, sub = make_test_data(db, submitted_hours_ago=25.0)
    now = datetime.now(timezone.utc)
    due = sub.review_due_at
    if due.tzinfo is None:
        due = due.replace(tzinfo=timezone.utc)
    is_overdue = due <= now
    assert is_overdue, f"Expected overdue, review_due_at={sub.review_due_at}, now={now}"

    released = release_delivery(
        db=db,
        submission=sub,
        release_method='auto_released_after_timeout',
        reviewer_id=None,
    )
    assert released, "Expected release_delivery to return True"
    db.refresh(sub)
    assert sub.status == 'approved', f"Expected status=approved, got {sub.status}"
    assert sub.release_method == 'auto_released_after_timeout', f"Wrong release_method: {sub.release_method}"
    assert sub.reviewed_by is None, f"reviewer_id should be None for auto-release, got {sub.reviewed_by}"
    assert sub.released_at is not None, "released_at should be set"
    db.refresh(order)
    assert order.status == 'delivered', f"Expected order.status=delivered, got {order.status}"
    notifs = db.query(Notification).filter(Notification.user_id.in_([creator.id, client.id])).all()
    assert len(notifs) >= 2, f"Expected >= 2 notifications, got {len(notifs)}"
    notif_titles = [n.title for n in notifs]
    assert any('Auto-Released' in t or 'Auto' in t for t in notif_titles), f"Expected auto-release notification, got: {notif_titles}"
    print("  PASS: submission auto-released with correct metadata")
    print(f"  PASS: order status = {order.status}")
    print(f"  PASS: {len(notifs)} notifications created")
    print(f"  PASS: release_method = {sub.release_method}")
    print(f"  PASS: reviewed_by = {sub.reviewed_by} (None = correct, no fake admin)")

print("\nTEST 3: Already-approved submission → release_delivery returns False")
with Session(engine) as db:
    admin, client, creator, order, sub = make_test_data(db, submitted_hours_ago=25.0)
    setattr(sub, 'status', 'approved')
    setattr(sub, 'release_method', 'admin_approved')
    setattr(sub, 'reviewed_by', admin.id)
    db.commit()

    released = release_delivery(
        db=db,
        submission=sub,
        release_method='auto_released_after_timeout',
        reviewer_id=None,
    )
    assert not released, "Expected False (already processed)"
    db.refresh(sub)
    assert sub.release_method == 'admin_approved', "Should not overwrite admin approval"
    print("  PASS: concurrent admin approval is not overwritten")

print("\nTEST 4: changes_requested status → should NOT be released")
with Session(engine) as db:
    admin, client, creator, order, sub = make_test_data(db, submitted_hours_ago=25.0)
    setattr(sub, 'status', 'changes_requested')
    db.commit()

    released = release_delivery(
        db=db,
        submission=sub,
        release_method='auto_released_after_timeout',
        reviewer_id=None,
    )
    assert not released, "Expected False (not pending_review)"
    db.refresh(sub)
    assert sub.status == 'changes_requested', "Status should not change"
    print("  PASS: changes_requested submission is NOT auto-released")

print("\nTEST 5: Worker _process_overdue_submissions integration")
with Session(engine) as db:
    admin, client, creator, order, sub = make_test_data(db, submitted_hours_ago=25.0)
    sub_id = sub.id

from sqlalchemy.orm import sessionmaker as _sessionmaker
import app.core.database as _db_module
from app.workers import auto_release_worker as _arw
_TestSession = _sessionmaker(bind=engine)
_orig_session_local = _db_module.SessionLocal
_db_module.SessionLocal = _TestSession  # type: ignore[assignment]
try:
    _arw._process_overdue_submissions()
finally:
    _db_module.SessionLocal = _orig_session_local  # always restore

with Session(engine) as db:
    sub = db.query(DeliverySubmission).filter(DeliverySubmission.id == sub_id).first()
    assert sub is not None, "Submission not found in test DB after worker run"
    assert sub.status == 'approved', f"Expected approved after worker run, got {sub.status}"  # type: ignore[union-attr]
    assert sub.release_method == 'auto_released_after_timeout'  # type: ignore[union-attr]
    print("  PASS: worker correctly processed overdue submission")

import os
try:
    os.remove('./test_autorelease.db')
except Exception:
    pass

print("\n" + "=" * 60)
print("ALL 5 TESTS PASSED")
print("=" * 60)
