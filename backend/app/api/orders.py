from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime, timezone
import uuid
from urllib.parse import urlparse
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.core.access import get_order_for_participant, check_order_status_transition
from app.models.user import User
from app.models.order import Order, Chat, Payment, Dispute
from app.models.creator import CreatorProfile
from app.schemas.schemas import (
    OrderCreate, OrderResponse, OrderStatusUpdate,
    DeliveryCreate, RevisionRequest, DisputeCreate, DisputeResponse
)
from app.services.notification_service import create_notification

router = APIRouter(prefix="/api/orders", tags=["orders"])

LINK_DELIVERY_STATUSES = {"accepted", "in_progress", "revision_requested"}

@router.post("", response_model=dict)
def create_order(
    data: OrderCreate,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db)
):
    creator = db.query(User).filter(User.id == data.creator_id, User.role == "creator").first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    
    order = Order(
        client_id=current_user.id,
        creator_id=data.creator_id,
        service_id=data.service_id,
        title=data.title,
        brief=data.brief,
        requirements=data.requirements,
        budget=data.budget,
        deadline=data.deadline,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    
    existing_chat = db.query(Chat).filter(
        Chat.client_id == current_user.id,
        Chat.creator_id == data.creator_id
    ).first()
    
    if not existing_chat:
        chat = Chat(
            client_id=current_user.id,
            creator_id=data.creator_id,
            order_id=order.id,
            last_message=f"New order: {data.title}"
        )
        db.add(chat)
        db.commit()
    else:
        setattr(existing_chat, "order_id", order.id)
        db.commit()
    
    create_notification(
        db=db,
        user_id=data.creator_id,
        title="New Order Received! 🎉",
        message=f"{current_user.name} placed an order: {data.title}",
        type="order"
    )
    
    return _format_order(order)

@router.get("/my-orders")
def get_my_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if current_user.role == "client":
        orders = db.query(Order).filter(Order.client_id == current_user.id).order_by(Order.created_at.desc()).all()
    elif current_user.role == "creator":
        orders = db.query(Order).filter(Order.creator_id == current_user.id).order_by(Order.created_at.desc()).all()
    else:
        orders = db.query(Order).order_by(Order.created_at.desc()).all()
    return [_format_order(o) for o in orders]

@router.get("/{order_id}")
def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = get_order_for_participant(db, order_id, current_user)
    return _format_order(order)

@router.put("/{order_id}/status")
def update_order_status(
    order_id: int,
    data: OrderStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = get_order_for_participant(db, order_id, current_user)
    check_order_status_transition(current_user, order, data.status)

    if data.status == "completed":
        _mark_completed(order, db)
    else:
        setattr(order, "status", data.status)

    db.commit()
    
    notify_user = order.client_id if current_user.role == "creator" else order.creator_id
    create_notification(
        db=db,
        user_id=notify_user,
        title=f"Order Status Updated",
        message=f"Order '{order.title}' status changed to {data.status}",
        type="order"
    )
    
    return _format_order(order)

@router.post("/{order_id}/delivery")
def upload_delivery(
    order_id: int,
    data: DeliveryCreate,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id, Order.creator_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in LINK_DELIVERY_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deliver an order with status '{order.status}'"
        )
    if urlparse(data.delivery_url.strip()).scheme.lower() not in ("http", "https"):
        raise HTTPException(status_code=400, detail="Delivery URL must start with http:// or https://")

    setattr(order, "delivery_url", data.delivery_url.strip())
    setattr(order, "delivery_notes", data.delivery_notes)
    setattr(order, "status", "delivered")
    db.commit()
    
    create_notification(
        db=db,
        user_id=order.client_id,
        title="Delivery Ready! 📦",
        message=f"Your order '{order.title}' has been delivered. Please review it.",
        type="order"
    )
    
    return _format_order(order)

@router.post("/{order_id}/revision")
def request_revision(
    order_id: int,
    data: RevisionRequest,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id, Order.client_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    setattr(order, "status", "revision_requested")
    setattr(order, "revision_count", order.revision_count + 1)
    db.commit()
    
    create_notification(
        db=db,
        user_id=order.creator_id,
        title="Revision Requested",
        message=f"Client requested a revision for '{order.title}'. Reason: {data.reason}",
        type="order"
    )
    
    return _format_order(order)

@router.post("/{order_id}/approve")
def approve_delivery(
    order_id: int,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id, Order.client_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status != "delivered":
        raise HTTPException(
            status_code=400,
            detail=f"Only delivered orders can be approved. Current status: {order.status}"
        )

    _mark_completed(order, db)
    db.commit()
    
    payment = db.query(Payment).filter(Payment.order_id == order_id).first()
    if payment:
        setattr(payment, "status", "completed")
        db.commit()
    
    create_notification(
        db=db,
        user_id=order.creator_id,
        title="Delivery Approved! 🎉",
        message=f"Your delivery for '{order.title}' has been approved. Payment released.",
        type="success"
    )
    
    return _format_order(order)

@router.post("/{order_id}/dispute")
def raise_dispute(
    order_id: int,
    data: DisputeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.client_id != current_user.id and order.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    from app.models.order import Dispute
    dispute = Dispute(order_id=order_id, raised_by=current_user.id, reason=data.reason)
    db.add(dispute)
    db.commit()
    db.refresh(dispute)
    return {"id": dispute.id, "status": dispute.status, "message": "Dispute raised successfully"}

def _mark_completed(order: Order, db: Session) -> None:
    """Complete an order and bump the creator's order count exactly once."""
    if order.status == "completed":
        return
    setattr(order, "status", "completed")
    setattr(order, "completed_at", datetime.now(timezone.utc))
    creator_profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == order.creator_id).first()
    if creator_profile:
        setattr(creator_profile, "total_orders", (creator_profile.total_orders or 0) + 1)

def _format_order(o: Order) -> dict:
    return {
        "id": o.id,
        "client_id": o.client_id,
        "creator_id": o.creator_id,
        "service_id": o.service_id,
        "title": o.title,
        "brief": o.brief,
        "requirements": o.requirements,
        "budget": o.budget,
        "deadline": o.deadline.isoformat() if o.deadline else None,
        "status": o.status,
        "delivery_url": o.delivery_url,
        "delivery_notes": o.delivery_notes,
        "revision_count": o.revision_count,
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        "client": {"id": o.client.id, "name": o.client.name, "avatar": o.client.avatar} if o.client else None,
        "creator": {"id": o.creator.id, "name": o.creator.name, "avatar": o.creator.avatar} if o.creator else None,
    }
