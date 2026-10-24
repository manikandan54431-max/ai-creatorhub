"""
Shared authorization helpers for orders and chats.

Every route that reads or mutates an order or chat on behalf of a user should
load it through one of these helpers so ownership is checked in one place.
"""
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.order import Order, Chat

ORDER_STATUSES = {
    "pending", "accepted", "in_progress", "delivered",
    "revision_requested", "completed", "cancelled",
}

ORDER_STATUS_TRANSITIONS = {
    "creator": {
        "pending": {"accepted", "cancelled"},   # accept or decline a new order
        "accepted": {"in_progress"},            # start work
    },
    "client": {
        "pending": {"cancelled"},               # cancel before work starts
    },
}

def get_order_for_participant(db: Session, order_id: int, user, allow_admin: bool = True) -> Order:
    """Return the order if `user` is its client or creator (or an admin). 404/403 otherwise."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if allow_admin and user.role == "admin":
        return order
    if user.id not in (order.client_id, order.creator_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return order

def check_order_status_transition(user, order: Order, new_status: str) -> None:
    """Raise 400/403 unless `user` may move `order` to `new_status`."""
    if new_status not in ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    if user.role == "admin":
        return
    if user.role == "creator" and order.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    if user.role == "client" and order.client_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    allowed = ORDER_STATUS_TRANSITIONS.get(user.role, {}).get(order.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot change order status from '{order.status}' to '{new_status}'",
        )

def is_chat_participant(chat: Chat, user_id: int) -> bool:
    return user_id in (chat.client_id, chat.creator_id)

def get_chat_for_participant(db: Session, chat_id: int, user, allow_admin: bool = False) -> Chat:
    """Return the chat if `user` is one of its two participants (or an admin when allowed)."""
    chat = db.query(Chat).filter(Chat.id == chat_id).first()
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    if allow_admin and user.role == "admin":
        return chat
    if not is_chat_participant(chat, user.id):
        raise HTTPException(status_code=403, detail="Access denied")
    return chat
