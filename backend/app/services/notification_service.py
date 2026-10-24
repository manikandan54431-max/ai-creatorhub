from sqlalchemy.orm import Session
from app.models.order import Notification

def create_notification(db: Session, user_id: int, title: str, message: str, type: str = "info"):
    notif = Notification(user_id=user_id, title=title, message=message, type=type)
    db.add(notif)
    db.commit()
    return notif
