import os
import json
from fastapi import APIRouter, Depends, HTTPException, Query, Body
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Optional
from datetime import datetime, timedelta, timezone, date
from app.core.config import settings
from app.core.database import get_db, engine, safe_db_descriptor
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.creator import CreatorProfile, PortfolioItem
from app.models.order import Order, Assignment, Chat, Message, Payment, Review, Dispute, Notification
from app.schemas.schemas import AssignmentCreate, AdminUserUpdate
from app.services.notification_service import create_notification
from app.services import revenue

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/dashboard")
def get_dashboard(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    total_users = db.query(User).count()
    total_creators = db.query(User).filter(User.role == "creator").count()
    total_clients = db.query(User).filter(User.role == "client").count()
    total_orders = db.query(Order).count()
    pending_orders = db.query(Order).filter(Order.status == "pending").count()
    completed_orders = db.query(Order).filter(Order.status == "completed").count()
    total_revenue = db.query(func.sum(Payment.amount)).filter(Payment.status == "completed").scalar() or 0
    active_chats = db.query(Chat).filter(Chat.is_blocked == False).count()
    
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    new_registrations = db.query(User).filter(User.created_at >= thirty_days_ago).count()
    
    recent_orders = db.query(Order).order_by(Order.created_at.desc()).limit(5).all()
    
    revenue_data = []
    cursor = datetime.now(revenue.reporting_tz()).date()
    for _ in range(6):
        summary = revenue.turnover_summary(db, "month", cursor)
        revenue_data.append({
            "month": summary["period_label"],
            "revenue": summary["turnover"],
        })
        cursor = cursor.replace(day=1) - timedelta(days=1)
    
    top_creators = db.query(CreatorProfile).order_by(CreatorProfile.total_orders.desc()).limit(5).all()
    
    return {
        "stats": {
            "total_users": total_users,
            "total_creators": total_creators,
            "total_clients": total_clients,
            "total_orders": total_orders,
            "pending_orders": pending_orders,
            "completed_orders": completed_orders,
            "total_revenue": round(total_revenue, 2),
            "active_chats": active_chats,
            "new_registrations": new_registrations,
        },
        "revenue_chart": list(reversed(revenue_data)),
        "recent_orders": [_format_order_basic(o) for o in recent_orders],
        "top_creators": [{"name": c.user.name, "orders": c.total_orders, "rating": c.rating} for c in top_creators if c.user],
    }

@router.get("/users")
def get_users(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    role: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(User)
    if search:
        query = query.filter(
            User.name.ilike(f"%{search}%") | User.email.ilike(f"%{search}%")
        )
    if role:
        query = query.filter(User.role == role)
    users = query.offset(skip).limit(limit).all()
    return [_format_user(u) for u in users]

@router.get("/users/{user_id}")
def get_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _format_user(user)

@router.put("/users/{user_id}/block")
def block_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    setattr(user, "is_blocked", True)
    db.commit()
    return {"message": f"User {user.name} blocked"}

@router.put("/users/{user_id}/unblock")
def unblock_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    setattr(user, "is_blocked", False)
    db.commit()
    return {"message": f"User {user.name} unblocked"}

@router.delete("/users/{user_id}")
def delete_user(user_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"message": "User deleted"}

@router.put("/users/{user_id}/role")
def change_role(user_id: int, data: AdminUserUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if data.role:
        setattr(user, "role", data.role)
    if data.is_blocked is not None:
        setattr(user, "is_blocked", data.is_blocked)
    db.commit()
    return _format_user(user)

@router.get("/creators")
def get_all_creators(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(CreatorProfile)
    if status:
        query = query.filter(CreatorProfile.approval_status == status)
    creators = query.offset(skip).limit(limit).all()
    return [_format_creator_admin(c) for c in creators]

@router.put("/creators/{creator_id}/approve")
def approve_creator(creator_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    if creator.approval_status == "approved":
        return {"id": creator.id, "approval_status": "approved", "changed": False,
                "message": "Creator is already approved"}
    setattr(creator, "approval_status", "approved")
    db.commit()
    db.refresh(creator)
    create_notification(db=db, user_id=creator.user_id, title="Profile Approved! 🎉",
                       message="Your creator profile has been approved. You can now receive orders!", type="success")
    return {"id": creator.id, "approval_status": creator.approval_status, "changed": True,
            "message": "Creator approved"}

@router.put("/creators/{creator_id}/reject")
def reject_creator(creator_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    if creator.approval_status == "rejected":
        return {"id": creator.id, "approval_status": "rejected", "changed": False,
                "message": "Creator is already rejected"}
    setattr(creator, "approval_status", "rejected")
    db.commit()
    db.refresh(creator)
    create_notification(db=db, user_id=creator.user_id, title="Profile Review Update",
                       message="Your creator profile needs some updates. Please contact support.", type="warning")
    return {"id": creator.id, "approval_status": creator.approval_status, "changed": True,
            "message": "Creator rejected"}

@router.put("/creators/{creator_id}/verify")
def verify_creator(
    creator_id: int,
    data: Optional[dict] = Body(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Set a creator's **identity/profile verification** badge.

    This is NOT creator approval (`approval_status`), NOT email verification and
    NOT delivery approval. It controls only the "Verified" badge shown in the
    marketplace, backed by `creator_profiles.is_verified`.

    Pass {"verified": true} or {"verified": false} to state the intended result.
    The request is then idempotent: repeating it leaves the same state, so a
    double click or a retry can no longer silently flip the badge back. Omitting
    the body falls back to a toggle, for backward compatibility.
    """
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    current = bool(creator.is_verified)
    if data is not None and "verified" in data:
        desired = data.get("verified")
        if not isinstance(desired, bool):
            raise HTTPException(status_code=400, detail="'verified' must be true or false")
    else:
        desired = not current

    if desired == current:
        return {
            "id": creator.id,
            "is_verified": current,
            "verified_at": creator.verified_at.isoformat() if creator.verified_at else None,
            "verified_by": creator.verified_by,
            "changed": False,
            "message": f"Creator is already {'verified' if current else 'unverified'}",
        }

    setattr(creator, "is_verified", desired)
    setattr(creator, "verified_at", datetime.now(timezone.utc) if desired else None)
    setattr(creator, "verified_by", admin.id if desired else None)
    db.commit()
    db.refresh(creator)

    if desired:
        create_notification(
            db=db, user_id=creator.user_id, title="Profile Verified",
            message="Your creator profile has been verified. The verified badge now appears on your marketplace profile.",
            type="success",
        )

    return {
        "id": creator.id,
        "is_verified": creator.is_verified,
        "verified_at": creator.verified_at.isoformat() if creator.verified_at else None,
        "verified_by": creator.verified_by,
        "changed": True,
        "message": f"Creator {'verified' if creator.is_verified else 'unverified'}",
    }

@router.put("/creators/{creator_id}/suspend")
def suspend_creator(creator_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    if creator.approval_status == "suspended":
        return {"id": creator.id, "approval_status": "suspended", "changed": False,
                "message": "Creator is already suspended"}
    setattr(creator, "approval_status", "suspended")
    db.commit()
    db.refresh(creator)
    create_notification(db=db, user_id=creator.user_id, title="Account Suspended",
                       message="Your creator profile has been suspended and is hidden from the marketplace. Please contact support.", type="warning")
    return {"id": creator.id, "approval_status": creator.approval_status, "changed": True,
            "message": "Creator suspended"}

@router.put("/creators/{creator_id}/unsuspend")
def unsuspend_creator(creator_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    if creator.approval_status != "suspended":
        raise HTTPException(status_code=400, detail="Creator is not suspended")
    setattr(creator, "approval_status", "approved")
    db.commit()
    create_notification(db=db, user_id=creator.user_id, title="Suspension Lifted 🎉",
                       message="Your creator profile is active again and visible in the marketplace. You can receive orders.", type="success")
    return {"id": creator.id, "approval_status": creator.approval_status, "changed": True,
            "message": "Creator unsuspended"}

@router.put("/creators/{creator_id}/feature")
def feature_creator(creator_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.id == creator_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    setattr(creator, "is_featured", not creator.is_featured)
    db.commit()
    db.refresh(creator)
    return {
        "id": creator.id,
        "is_featured": creator.is_featured,
        "message": f"Creator {'featured' if creator.is_featured else 'unfeatured'}",
    }

@router.get("/orders")
def get_all_orders(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    query = db.query(Order)
    if status:
        query = query.filter(Order.status == status)
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return [_format_order_basic(o) for o in orders]

@router.put("/orders/{order_id}/status")
def update_order_status(
    order_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    setattr(order, "status", data.get("status", order.status))
    db.commit()
    return _format_order_basic(order)

@router.post("/assignments")
def create_assignment(
    data: AssignmentCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    order = Order(
        client_id=data.client_id,
        creator_id=data.creator_id,
        title=data.project_title,
        brief=data.project_description,
        budget=data.budget or 0,
        deadline=data.deadline,
        status="assigned"
    )
    db.add(order)
    db.flush()
    
    assignment = Assignment(
        client_id=data.client_id,
        creator_id=data.creator_id,
        admin_id=admin.id,
        project_title=data.project_title,
        project_description=data.project_description,
        required_category=data.required_category,
        required_ai_tools=data.required_ai_tools,
        budget=data.budget,
        deadline=data.deadline,
        admin_notes=data.admin_notes,
        order_id=order.id
    )
    db.add(assignment)
    
    existing_chat = db.query(Chat).filter(
        Chat.client_id == data.client_id,
        Chat.creator_id == data.creator_id
    ).first()
    if not existing_chat:
        chat = Chat(
            client_id=data.client_id,
            creator_id=data.creator_id,
            order_id=order.id,
            last_message=f"Admin assigned project: {data.project_title}"
        )
        db.add(chat)
    
    db.commit()
    db.refresh(assignment)
    
    create_notification(db=db, user_id=data.client_id, title="Creator Assigned! 🎯",
                       message=f"Admin has assigned a creator for your project: {data.project_title}", type="info")
    create_notification(db=db, user_id=data.creator_id, title="New Project Assigned! 📋",
                       message=f"You have been assigned to: {data.project_title}. Open the order to review the client's brief and requirements.", type="order")
    
    return _format_assignment(assignment)

@router.get("/assignments")
def get_assignments(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    assignments = db.query(Assignment).order_by(Assignment.created_at.desc()).all()
    return [_format_assignment(a) for a in assignments]

@router.get("/assignments/{assignment_id}")
def get_assignment(assignment_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    return _format_assignment(a)

@router.put("/assignments/{assignment_id}/status")
def update_assignment_status(
    assignment_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    a = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Assignment not found")
    setattr(a, "status", data.get("status", a.status))
    db.commit()
    return _format_assignment(a)

@router.get("/chats")
def get_all_chats(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    chats = db.query(Chat).order_by(Chat.updated_at.desc()).all()
    return [_format_chat_admin(c) for c in chats]

@router.get("/chats/{chat_id}/messages")
def get_chat_messages(chat_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    return [_format_message(m) for m in messages]

@router.put("/chats/{chat_id}/block")
def block_chat(chat_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    setattr(chat, "is_blocked", not chat.is_blocked)
    db.commit()
    db.refresh(chat)
    return {"is_blocked": chat.is_blocked, "message": f"Chat blocked: {chat.is_blocked}"}

@router.post("/chats/{chat_id}/flag/{message_id}")
def flag_message(chat_id: int, message_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    msg = db.query(Message).filter(Message.id == message_id, Message.chat_id == chat_id).first()
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    setattr(msg, "is_flagged", not msg.is_flagged)
    db.commit()
    return {"flagged": msg.is_flagged}

def _parse_anchor(anchor: Optional[str]) -> Optional[date]:
    """Parse a YYYY-MM-DD period anchor. None means 'the current period'."""
    if not anchor:
        return None
    try:
        return date.fromisoformat(anchor)
    except ValueError:
        raise HTTPException(status_code=400, detail="anchor must be an ISO date (YYYY-MM-DD)")

@router.get("/payments")
def get_all_payments(
    period: str = Query("all", pattern="^(week|month|year|all)$"),
    anchor: Optional[str] = Query(None, description="ISO date selecting which week/month/year"),
    status: Optional[str] = Query(None, description="Filter the listed rows by payment status"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Payment list plus the turnover summary for the same period.

    Both come from app.services.revenue, so the summary cards and the rows below
    them always describe the same set of payments.
    """
    anchor_date = _parse_anchor(anchor)
    start_utc, end_utc, _label = revenue.period_bounds(period, anchor_date)

    q = revenue.payments_query(db, start_utc, end_utc, status=status)
    payments = q.order_by(Payment.created_at.desc()).all()

    summary = revenue.turnover_summary(db, period, anchor_date)

    return {
        "payments": [_format_payment(p) for p in payments],
        "summary": summary,
        "total_revenue": summary["turnover"],
    }

@router.get("/turnover")
def get_turnover(
    period: str = Query("month", pattern="^(week|month|year|all)$"),
    anchor: Optional[str] = Query(None, description="ISO date selecting which week/month/year"),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Turnover summary for one period. See app/services/revenue.py for the definition."""
    return revenue.turnover_summary(db, period, _parse_anchor(anchor))

@router.get("/turnover/series")
def get_turnover_series(
    period: str = Query("month", pattern="^(week|month|year)$"),
    count: int = Query(6, ge=1, le=36, description="How many consecutive periods, ending with the anchor period"),
    anchor: Optional[str] = Query(None),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """
    Turnover for `count` consecutive periods, oldest first — for the chart.

    Each period is resolved with the same calendar-correct boundary logic as the
    summary, so the chart and the cards cannot disagree.
    """
    anchor_date = _parse_anchor(anchor) or datetime.now(revenue.reporting_tz()).date()

    anchors: List[date] = []
    cursor = anchor_date
    for _ in range(count):
        anchors.append(cursor)
        start_utc, _end, _label = revenue.period_bounds(period, cursor)
        local_start = start_utc.replace(tzinfo=timezone.utc).astimezone(revenue.reporting_tz()).date()
        cursor = local_start - timedelta(days=1)

    return [revenue.turnover_summary(db, period, a) for a in reversed(anchors)]

@router.get("/reviews")
def get_all_reviews(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    reviews = db.query(Review).order_by(Review.created_at.desc()).all()
    return [_format_review(r) for r in reviews]

@router.put("/reviews/{review_id}/hide")
def hide_review(review_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    setattr(review, "is_hidden", not review.is_hidden)
    db.commit()
    return {"hidden": review.is_hidden}

@router.delete("/reviews/{review_id}")
def delete_review(review_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    db.delete(review)
    db.commit()
    return {"message": "Review deleted"}

@router.get("/disputes")
def get_all_disputes(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    disputes = db.query(Dispute).order_by(Dispute.created_at.desc()).all()
    return [_format_dispute(d) for d in disputes]

@router.put("/disputes/{dispute_id}/resolve")
def resolve_dispute(
    dispute_id: int,
    data: dict,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    dispute = db.query(Dispute).filter(Dispute.id == dispute_id).first()
    if not dispute:
        raise HTTPException(status_code=404, detail="Dispute not found")
    setattr(dispute, "status", "resolved")
    setattr(dispute, "admin_decision", data.get("admin_decision", ""))
    db.commit()
    
    order = db.query(Order).filter(Order.id == dispute.order_id).first()
    if order:
        for uid in [order.client_id, order.creator_id]:
            create_notification(db=db, user_id=uid, title="Dispute Resolved",
                               message=f"Admin has resolved the dispute. Decision: {dispute.admin_decision}", type="info")
    
    return _format_dispute(dispute)

def _format_user(u: User) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "avatar": u.avatar,
        "phone": u.phone,
        "is_active": u.is_active,
        "is_blocked": u.is_blocked,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }

def _format_creator_admin(c: CreatorProfile) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.user.name if c.user else "",
        "email": c.user.email if c.user else "",
        "avatar": c.user.avatar if c.user else None,
        "headline": c.headline,
        "category": c.category,
        "rating": c.rating,
        "total_orders": c.total_orders,
        "is_verified": c.is_verified,
        "verified_at": c.verified_at.isoformat() if c.verified_at else None,
        "verified_by": c.verified_by,
        "verified_by_name": c.verifier.name if c.verifier else None,
        "is_featured": c.is_featured,
        "approval_status": c.approval_status,
        "starting_price": c.starting_price,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

def _format_order_basic(o: Order) -> dict:
    return {
        "id": o.id,
        "title": o.title,
        "status": o.status,
        "budget": o.budget,
        "client_name": o.client.name if o.client else "",
        "creator_name": o.creator.name if o.creator else "",
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }

def _format_assignment(a: Assignment) -> dict:
    return {
        "id": a.id,
        "client_id": a.client_id,
        "creator_id": a.creator_id,
        "admin_id": a.admin_id,
        "project_title": a.project_title,
        "project_description": a.project_description,
        "required_category": a.required_category,
        "required_ai_tools": a.required_ai_tools or [],
        "budget": a.budget,
        "deadline": a.deadline.isoformat() if a.deadline else None,
        "status": a.status,
        "admin_notes": a.admin_notes,
        "order_id": a.order_id,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "client": {"id": a.client.id, "name": a.client.name} if a.client else None,
        "creator": {"id": a.creator.id, "name": a.creator.name} if a.creator else None,
    }

def _format_chat_admin(c: Chat) -> dict:
    return {
        "id": c.id,
        "client_id": c.client_id,
        "creator_id": c.creator_id,
        "order_id": c.order_id,
        "last_message": c.last_message,
        "is_blocked": c.is_blocked,
        "client_name": c.client.name if c.client else "",
        "creator_name": c.creator.name if c.creator else "",
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

def _format_message(m: Message) -> dict:
    return {
        "id": m.id,
        "chat_id": m.chat_id,
        "sender_id": m.sender_id,
        "message": m.message,
        "is_flagged": m.is_flagged,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "sender_name": m.sender.name if m.sender else "",
    }

def _format_payment(p: Payment) -> dict:
    return {
        "id": p.id,
        "order_id": p.order_id,
        "client_id": p.client_id,
        "creator_id": p.creator_id,
        "client_name": p.client.name if p.client else None,
        "creator_name": p.creator.name if p.creator else None,
        "amount": p.amount,
        "commission": p.commission,
        "platform_fee": p.commission,
        "creator_earnings": p.creator_earnings,
        "status": p.status,
        "payment_gateway": p.payment_gateway,
        "refund_status": p.refund_status,
        "transaction_id": p.transaction_id,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }

def _format_review(r: Review) -> dict:
    return {
        "id": r.id,
        "order_id": r.order_id,
        "client_id": r.client_id,
        "creator_id": r.creator_id,
        "rating": r.rating,
        "comment": r.comment,
        "is_hidden": r.is_hidden,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "client_name": r.client.name if r.client else "",
        "creator_name": r.creator.name if r.creator else "",
    }

def _format_dispute(d: Dispute) -> dict:
    return {
        "id": d.id,
        "order_id": d.order_id,
        "raised_by": d.raised_by,
        "reason": d.reason,
        "status": d.status,
        "admin_decision": d.admin_decision,
        "created_at": d.created_at.isoformat() if d.created_at else None,
    }

SETTINGS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "platform_settings.json")

DEFAULT_SETTINGS = {
    "general": {
        "platform_name": "AI CreatorHub",
        "tagline": "The Premier Marketplace for AI-Powered Content Creators & Brands",
        "support_email": "support@aicreatorhub.com",
        "contact_phone": "+91 98765 43210",
        "currency": "INR",
        "currency_symbol": "₹",
        "timezone": "Asia/Kolkata (IST)",
        "maintenance_mode": False,
        "maintenance_message": "AI CreatorHub is undergoing scheduled maintenance. We'll be back shortly!"
    },
    "financial": {
        "commission_percentage": 20,
        "min_order_budget": 500,
        "max_order_budget": 500000,
        "creator_payout_threshold": 2000,
        "escrow_hold_days": 7,
        "payment_gateway": "Razorpay / Stripe (Sandbox Active)",
        "auto_refund_on_cancel": True,
        "allow_crypto_payouts": False
    },
    "creator_rules": {
        "auto_approve_creators": False,
        "require_portfolio_approval": True,
        "auto_verify_min_orders": 10,
        "auto_verify_min_rating": 4.8,
        "max_concurrent_orders": 5,
        "allow_direct_messaging": True,
        "featured_creator_slots": 6,
        "supported_ai_tools": [
            "Midjourney", "Runway Gen-2", "ElevenLabs", "Stable Diffusion",
            "Sora", "ChatGPT", "Claude 3.5 Sonnet", "Suno AI", "Pika", "Flux.1", "HeyGen"
        ]
    },
    "moderation": {
        "chat_auto_moderation": True,
        "moderation_sensitivity": "medium",
        "flagged_keywords": ["whatsapp", "telegram", "gpay", "phonepe", "paypal direct", "pay off platform", "call me at"]
    },
    "security": {
        "enforce_strong_passwords": True,
        "session_timeout_minutes": 10080,
        "admin_email_alerts": True,
        "dispute_immediate_alert": True,
        "high_value_order_alert_threshold": 50000,
        "rate_limiting_enabled": True,
        "max_login_attempts": 5
    }
}

def _get_platform_settings() -> dict:
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                merged = json.loads(json.dumps(DEFAULT_SETTINGS))
                for section, vals in data.items():
                    if section in merged and isinstance(vals, dict):
                        merged[section].update(vals)
                    else:
                        merged[section] = vals
                return merged
        except Exception:
            pass
    return json.loads(json.dumps(DEFAULT_SETTINGS))

def _save_platform_settings(new_settings: dict) -> dict:
    merged = _get_platform_settings()
    for section, vals in new_settings.items():
        if section in merged and isinstance(vals, dict) and isinstance(merged[section], dict):
            merged[section].update(vals)
        else:
            merged[section] = vals
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(merged, f, indent=2)
    if "financial" in merged and "commission_percentage" in merged["financial"]:
        try:
            settings.PLATFORM_COMMISSION_PERCENT = int(merged["financial"]["commission_percentage"])
        except Exception:
            pass
    return merged

@router.get("/settings")
def get_settings(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    config_data = _get_platform_settings()
    total_users = db.query(User).count()
    total_orders = db.query(Order).count()
    total_creators = db.query(User).filter(User.role == "creator").count()
    total_clients = db.query(User).filter(User.role == "client").count()
    db_type = engine.dialect.name  # 'sqlite' | 'mysql' | 'postgresql' | ...

    return {
        "settings": config_data,
        "diagnostics": {
            "database_type": db_type,
            "database_url_masked": safe_db_descriptor(),
            "server_time": datetime.now(timezone.utc).isoformat(),
            "total_users": total_users,
            "total_creators": total_creators,
            "total_clients": total_clients,
            "total_orders": total_orders,
            "frontend_url": settings.FRONTEND_URL,
            "access_token_expire_minutes": settings.ACCESS_TOKEN_EXPIRE_MINUTES,
            "admin_email": admin.email,
        }
    }

@router.put("/settings")
def update_settings(payload: dict, admin: User = Depends(require_admin)):
    updated = _save_platform_settings(payload)
    return {
        "message": "Platform settings updated successfully",
        "settings": updated
    }

@router.post("/settings/reset")
def reset_settings(admin: User = Depends(require_admin)):
    with open(SETTINGS_FILE, "w", encoding="utf-8") as f:
        json.dump(DEFAULT_SETTINGS, f, indent=2)
    settings.PLATFORM_COMMISSION_PERCENT = DEFAULT_SETTINGS["financial"]["commission_percentage"]
    return {
        "message": "Platform settings restored to defaults",
        "settings": DEFAULT_SETTINGS
    }
