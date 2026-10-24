"""
AI CreatorHub - Demo Data Cleanup Script
Removes seed/demo accounts and fabricated marketplace data.
Idempotent: safe to run multiple times.
Run: python cleanup_demo_data.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.creator import CreatorProfile, Service, PortfolioItem
from app.models.order import (
    Order, Chat, Message, Payment, Review,
    Assignment, Dispute, Notification, SavedCreator
)

DEMO_EMAILS = {
    "aisha@example.com", "rohan@example.com", "neha@example.com",
    "kunal@example.com", "priyanka@example.com",
    "priya@example.com", "arjun@example.com", "divya@example.com",
    "karthik@example.com", "sneha@example.com", "vikram@example.com",
    "meera@example.com", "rahul@example.com", "ananya@example.com",
    "sanjay@example.com",
}

REAL_OWNER_EMAIL = "manikandan54431@gmail.com"
NEW_ADMIN_PASSWORD = "P3ReJ2eV0%j@GhSf"

db = SessionLocal()

print("=" * 60)
print("AI CreatorHub — Demo Data Cleanup")
print("=" * 60)

demo_users = db.query(User).filter(User.email.in_(DEMO_EMAILS)).all()
demo_ids = {u.id for u in demo_users}
print(f"\nDemo user IDs found: {sorted(demo_ids)}")

if not demo_ids:
    print("No demo users found — cleanup already done or seed was never run.")
else:
    saved = db.query(SavedCreator).filter(
        SavedCreator.client_id.in_(demo_ids) | SavedCreator.creator_id.in_(demo_ids)
    ).all()
    sc_count = len(saved)
    for s in saved:
        db.delete(s)
    db.commit()
    print(f"  Deleted {sc_count} saved-creator records")

    notif_count = db.query(Notification).filter(Notification.user_id.in_(demo_ids)).count()
    db.query(Notification).filter(Notification.user_id.in_(demo_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {notif_count} notifications")

    demo_orders = db.query(Order).filter(
        Order.client_id.in_(demo_ids) | Order.creator_id.in_(demo_ids)
    ).all()
    demo_order_ids = {o.id for o in demo_orders}

    dispute_count = db.query(Dispute).filter(Dispute.order_id.in_(demo_order_ids)).count()
    db.query(Dispute).filter(Dispute.order_id.in_(demo_order_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {dispute_count} disputes")

    review_count = db.query(Review).filter(
        Review.client_id.in_(demo_ids) | Review.creator_id.in_(demo_ids)
    ).count()
    db.query(Review).filter(
        Review.client_id.in_(demo_ids) | Review.creator_id.in_(demo_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {review_count} reviews")

    payment_count = db.query(Payment).filter(
        Payment.client_id.in_(demo_ids) | Payment.creator_id.in_(demo_ids)
    ).count()
    db.query(Payment).filter(
        Payment.client_id.in_(demo_ids) | Payment.creator_id.in_(demo_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {payment_count} payments")

    assignment_count = db.query(Assignment).filter(
        Assignment.client_id.in_(demo_ids) | Assignment.creator_id.in_(demo_ids)
    ).count()
    db.query(Assignment).filter(
        Assignment.client_id.in_(demo_ids) | Assignment.creator_id.in_(demo_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {assignment_count} assignments")

    demo_chats = db.query(Chat).filter(
        Chat.client_id.in_(demo_ids) | Chat.creator_id.in_(demo_ids)
    ).all()
    demo_chat_ids = {c.id for c in demo_chats}

    msg_count = db.query(Message).filter(Message.chat_id.in_(demo_chat_ids)).count()
    db.query(Message).filter(Message.chat_id.in_(demo_chat_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {msg_count} messages")

    chat_count = len(demo_chat_ids)
    db.query(Chat).filter(Chat.id.in_(demo_chat_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {chat_count} chats")

    order_count = len(demo_order_ids)
    db.query(Order).filter(Order.id.in_(demo_order_ids)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {order_count} orders")

    demo_profiles = db.query(CreatorProfile).filter(
        CreatorProfile.user_id.in_(demo_ids)
    ).all()
    demo_profile_ids = {p.id for p in demo_profiles}

    portfolio_count = db.query(PortfolioItem).filter(
        PortfolioItem.creator_id.in_(demo_profile_ids)
    ).count()
    db.query(PortfolioItem).filter(
        PortfolioItem.creator_id.in_(demo_profile_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {portfolio_count} portfolio items")

    service_count = db.query(Service).filter(
        Service.creator_id.in_(demo_profile_ids)
    ).count()
    db.query(Service).filter(
        Service.creator_id.in_(demo_profile_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {service_count} services")

    db.query(CreatorProfile).filter(
        CreatorProfile.user_id.in_(demo_ids)
    ).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {len(demo_profile_ids)} creator profiles")

    db.query(User).filter(User.email.in_(DEMO_EMAILS)).delete(synchronize_session=False)
    db.commit()
    print(f"  Deleted {len(demo_ids)} demo users")

real_owner = db.query(User).filter(User.email == REAL_OWNER_EMAIL).first()
if real_owner:
    profile = db.query(CreatorProfile).filter(
        CreatorProfile.user_id == real_owner.id
    ).first()
    if profile:
        real_reviews = db.query(Review).filter(
            Review.creator_id == real_owner.id,
            Review.is_hidden == False
        ).all()
        profile.total_orders = 0
        profile.total_reviews = len(real_reviews)
        profile.rating = round(
            sum(r.rating for r in real_reviews) / len(real_reviews), 2
        ) if real_reviews else 0.0
        db.commit()
        print(f"\nReset creator profile for {REAL_OWNER_EMAIL}:")
        print(f"  total_orders=0, total_reviews={profile.total_reviews}, rating={profile.rating}")

admin = db.query(User).filter(User.role == "admin").first()
if admin:
    admin.password_hash = hash_password(NEW_ADMIN_PASSWORD)
    db.commit()
    print(f"\nAdmin password updated in DB for: {admin.email}")

remaining_demo = db.query(User).filter(User.email.in_(DEMO_EMAILS)).count()
remaining_users = db.query(User).count()
remaining_profiles = db.query(CreatorProfile).count()
remaining_orders = db.query(Order).count()
remaining_reviews = db.query(Review).count()

print("\n" + "=" * 60)
print("Cleanup complete. Final state:")
print(f"  Remaining demo users:      {remaining_demo}  (should be 0)")
print(f"  Total users:               {remaining_users}  (admin + real users only)")
print(f"  Creator profiles:          {remaining_profiles}")
print(f"  Orders:                    {remaining_orders}")
print(f"  Reviews:                   {remaining_reviews}")
print("=" * 60)

db.close()
