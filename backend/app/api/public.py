from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.models.user import User
from app.models.creator import CreatorProfile
from app.models.order import Order, Review, Payment

router = APIRouter(prefix="/api/public", tags=["public"])


@router.get("/stats")
def get_public_stats(db: Session = Depends(get_db)):
    """Real platform statistics for the public homepage."""
    approved_creators = db.query(CreatorProfile).join(User, CreatorProfile.user_id == User.id).filter(
        CreatorProfile.approval_status == "approved",
        User.is_active == True,
        User.is_blocked == False
    ).count()

    total_clients = db.query(User).filter(
        User.role == "client",
        User.is_active == True
    ).count()

    completed_orders = db.query(Order).filter(
        Order.status == "completed"
    ).count()

    avg_rating_row = db.query(func.avg(Review.rating)).filter(
        Review.is_hidden == False
    ).scalar()
    avg_rating = round(float(avg_rating_row), 1) if avg_rating_row else 0.0

    return {
        "approved_creators": approved_creators,
        "total_clients": total_clients,
        "completed_orders": completed_orders,
        "avg_rating": avg_rating,
    }
