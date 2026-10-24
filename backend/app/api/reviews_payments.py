from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.order import Review, Order, Payment
from app.models.creator import CreatorProfile
from app.schemas.schemas import ReviewCreate, PaymentCreate, PaymentVerify
from app.services.notification_service import create_notification
import uuid
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

review_router = APIRouter(prefix="/api/reviews", tags=["reviews"])
payment_router = APIRouter(prefix="/api/payments", tags=["payments"])

@review_router.post("")
def create_review(
    data: ReviewCreate,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(
        Order.id == data.order_id,
        Order.client_id == current_user.id,
        Order.status == "completed"
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found or not completed")
    
    existing = db.query(Review).filter(Review.order_id == data.order_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="Review already submitted")
    
    review = Review(
        order_id=data.order_id,
        client_id=current_user.id,
        creator_id=order.creator_id,
        rating=data.rating,
        comment=data.comment
    )
    db.add(review)
    db.commit()
    
    creator_reviews = db.query(Review).filter(
        Review.creator_id == order.creator_id,
        Review.is_hidden == False
    ).all()
    if creator_reviews:
        avg_rating = sum(r.rating for r in creator_reviews) / len(creator_reviews)
        profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == order.creator_id).first()
        if profile:
            setattr(profile, "rating", round(avg_rating, 2))
            setattr(profile, "total_reviews", len(creator_reviews))
            db.commit()
    
    create_notification(
        db=db,
        user_id=order.creator_id,
        title="New Review Received! ⭐",
        message=f"{current_user.name} left you a {data.rating}★ review",
        type="info"
    )
    
    db.refresh(review)
    return _format_review(review)

@review_router.get("/creator/{creator_id}")
def get_creator_reviews(creator_id: int, db: Session = Depends(get_db)):
    reviews = db.query(Review).filter(
        Review.creator_id == creator_id,
        Review.is_hidden == False
    ).order_by(Review.created_at.desc()).all()
    return [_format_review(r) for r in reviews]

@review_router.get("/my-reviews")
def get_my_reviews(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "creator":
        reviews = db.query(Review).filter(
            Review.creator_id == current_user.id,
            Review.is_hidden == False
        ).order_by(Review.created_at.desc()).all()
        result = []
        for r in reviews:
            d = _format_review(r)
            d["client_name"] = r.client.name if r.client else "Client"
            result.append(d)
        return result
    else:
        reviews = db.query(Review).filter(Review.client_id == current_user.id).all()
        return [_format_review(r) for r in reviews]

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
        "client": {"id": r.client.id, "name": r.client.name, "avatar": r.client.avatar} if r.client else None,
    }

def require_role(role: str):
    from app.core.security import get_current_user as _get_current_user
    def checker(current_user: User = Depends(_get_current_user)):
        if current_user.role not in [role, "admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user
    return checker

SUPPORTED_GATEWAYS = {"razorpay", "simulated"}
UNPAYABLE_ORDER_STATUSES = {"completed", "cancelled"}

def _razorpay_configured() -> bool:
    return bool(settings.RAZORPAY_KEY_ID and settings.RAZORPAY_KEY_SECRET)

def _accept_paid_order(order: Order) -> None:
    if order.status == "pending":
        setattr(order, "status", "accepted")

@payment_router.get("/config")
def get_payment_config():
    return {
        "razorpay_key_id": settings.RAZORPAY_KEY_ID or None,
        "has_razorpay": _razorpay_configured(),
    }

@payment_router.post("/create")
def create_payment(
    data: PaymentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    order = db.query(Order).filter(Order.id == data.order_id, Order.client_id == current_user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in UNPAYABLE_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail=f"Cannot pay for an order with status '{order.status}'")

    payment = db.query(Payment).filter(Payment.order_id == data.order_id).first()
    if payment and payment.status == "completed":
        raise HTTPException(status_code=409, detail="This order has already been paid")

    amount = float(order.budget)
    if data.amount is not None and abs(float(data.amount) - amount) > 0.01:
        raise HTTPException(status_code=400, detail="Payment amount must match the order budget")

    gateway = (data.payment_gateway or data.payment_method or "simulated").strip().lower()
    if gateway not in SUPPORTED_GATEWAYS:
        raise HTTPException(status_code=400, detail=f"Unsupported payment gateway '{gateway}'")

    commission_pct = settings.PLATFORM_COMMISSION_PERCENT / 100
    commission = amount * commission_pct
    creator_earnings = amount - commission

    if gateway == "razorpay" and _razorpay_configured():
        try:
            import razorpay
            rp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            rp_order = rp_client.order.create({  # type: ignore[attr-defined]
                "amount": round(amount * 100),
                "currency": "INR",
                "receipt": f"order_{order.id}",
                "notes": {"order_id": str(order.id), "client_id": str(current_user.id)}
            })
        except Exception:
            logger.exception("Razorpay order creation failed for order #%s", order.id)
            raise HTTPException(status_code=502, detail="Payment gateway is unavailable. Please try again.")

        if not payment:
            payment = Payment(order_id=data.order_id, client_id=current_user.id)
            db.add(payment)
        setattr(payment, "creator_id", order.creator_id)
        setattr(payment, "amount", amount)
        setattr(payment, "commission", commission)
        setattr(payment, "creator_earnings", creator_earnings)
        setattr(payment, "status", "pending")
        setattr(payment, "payment_gateway", "razorpay")
        setattr(payment, "transaction_id", rp_order["id"])
        db.commit()
        db.refresh(payment)

        return {
            "id": payment.id,
            "payment_id": payment.id,
            "order_id": order.id,
            "amount": amount,
            "currency": "INR",
            "razorpay_order_id": rp_order["id"],
            "razorpay_key_id": settings.RAZORPAY_KEY_ID,
            "payment_gateway": "razorpay",
            "status": "pending",
            "transaction_id": rp_order["id"],
            "created_at": payment.created_at.isoformat() if payment.created_at else None
        }

    if not settings.ALLOW_SIMULATED_PAYMENTS:
        raise HTTPException(status_code=400, detail="Online payment is not configured on this server")

    transaction_id = f"TXN_{uuid.uuid4().hex[:12].upper()}"
    if not payment:
        payment = Payment(order_id=data.order_id, client_id=current_user.id)
        db.add(payment)
    setattr(payment, "creator_id", order.creator_id)
    setattr(payment, "amount", amount)
    setattr(payment, "commission", commission)
    setattr(payment, "creator_earnings", creator_earnings)
    setattr(payment, "status", "completed")
    setattr(payment, "payment_gateway", "simulated")
    setattr(payment, "transaction_id", transaction_id)

    _accept_paid_order(order)
    db.commit()
    db.refresh(payment)

    create_notification(
        db=db,
        user_id=order.creator_id,
        title="Payment Received! 💰",
        message=f"Payment of ₹{amount} received for order '{order.title}'",
        type="success"
    )

    return _format_payment(payment)

@payment_router.post("/verify")
def verify_payment(data: PaymentVerify, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    payment = db.query(Payment).filter(Payment.order_id == data.order_id).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    if current_user.role != "admin" and payment.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    if payment.status == "completed":
        return {"verified": True, "payment": _format_payment(payment)}

    order = db.query(Order).filter(Order.id == data.order_id).first()
    has_signature = bool(data.razorpay_signature and data.razorpay_payment_id and data.razorpay_order_id)

    if payment.payment_gateway == "razorpay":
        if not has_signature:
            raise HTTPException(status_code=400, detail="Razorpay payments require a valid payment signature")
        if not _razorpay_configured():
            raise HTTPException(status_code=503, detail="Payment gateway is not configured")
        if data.razorpay_order_id != payment.transaction_id:
            raise HTTPException(status_code=400, detail="Razorpay order does not match this payment")
        try:
            import razorpay
            rp_client = razorpay.Client(auth=(settings.RAZORPAY_KEY_ID, settings.RAZORPAY_KEY_SECRET))
            rp_client.utility.verify_payment_signature({  # type: ignore[attr-defined]
                'razorpay_order_id': data.razorpay_order_id,
                'razorpay_payment_id': data.razorpay_payment_id,
                'razorpay_signature': data.razorpay_signature
            })
        except Exception:
            logger.warning("Invalid Razorpay signature for order #%s", data.order_id)
            raise HTTPException(status_code=400, detail="Invalid Razorpay signature")
        setattr(payment, "transaction_id", data.razorpay_payment_id)
        setattr(payment, "status", "completed")
    else:
        if not settings.ALLOW_SIMULATED_PAYMENTS:
            raise HTTPException(status_code=400, detail="This payment cannot be verified")
        setattr(payment, "status", "completed")

    if order:
        _accept_paid_order(order)
        create_notification(
            db=db,
            user_id=order.creator_id,
            title="Payment Verified! 💰",
            message=f"Payment of ₹{payment.amount} verified for order '{order.title}'",
            type="success"
        )

    db.commit()
    db.refresh(payment)
    return {"verified": True, "payment": _format_payment(payment)}

@payment_router.get("/my-payments")
def get_my_payments(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "client":
        payments = db.query(Payment).filter(Payment.client_id == current_user.id).order_by(Payment.created_at.desc()).all()
    elif current_user.role == "creator":
        payments = db.query(Payment).filter(Payment.creator_id == current_user.id).order_by(Payment.created_at.desc()).all()
    else:
        payments = db.query(Payment).order_by(Payment.created_at.desc()).all()
    return [_format_payment(p) for p in payments]

def _format_payment(p: Payment) -> dict:
    return {
        "id": p.id,
        "payment_id": p.id,
        "order_id": p.order_id,
        "client_id": p.client_id,
        "creator_id": p.creator_id,
        "amount": p.amount,
        "commission": p.commission,
        "creator_earnings": p.creator_earnings,
        "status": p.status,
        "payment_gateway": p.payment_gateway,
        "transaction_id": p.transaction_id,
        "refund_status": p.refund_status,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
