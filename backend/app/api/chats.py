from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from typing import List, Dict
import json
from datetime import datetime
from app.core.database import get_db, SessionLocal
from app.core.security import get_current_user, decode_token, require_role
from app.core.access import get_chat_for_participant, is_chat_participant
from app.models.user import User
from app.models.order import Chat, Message
from app.schemas.schemas import MessageCreate, MessageResponse, ChatResponse

router = APIRouter(prefix="/api/chats", tags=["chats"])

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, chat_id: int):
        await websocket.accept()
        if chat_id not in self.active_connections:
            self.active_connections[chat_id] = []
        self.active_connections[chat_id].append(websocket)

    def disconnect(self, websocket: WebSocket, chat_id: int):
        if chat_id in self.active_connections and websocket in self.active_connections[chat_id]:
            self.active_connections[chat_id].remove(websocket)

    async def broadcast(self, message: dict, chat_id: int):
        if chat_id in self.active_connections:
            for connection in self.active_connections[chat_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except:
                    pass

manager = ConnectionManager()

@router.websocket("/ws/{chat_id}")
async def websocket_endpoint(websocket: WebSocket, chat_id: int, token: str | None = None):
    if not token:
        await websocket.close(code=4001)
        return
    
    payload = decode_token(token)
    if not payload or not payload.get("sub"):
        await websocket.close(code=4001)
        return

    user_id = int(payload["sub"])

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        chat = db.query(Chat).filter(Chat.id == chat_id).first()
        authorized = bool(user and not user.is_blocked and chat and is_chat_participant(chat, user_id))
    finally:
        db.close()
    if not authorized:
        await websocket.close(code=4003)
        return

    await manager.connect(websocket, chat_id)

    try:
        while True:
            data = await websocket.receive_text()
            try:
                message_data = json.loads(data)
            except ValueError:
                continue
            if not isinstance(message_data, dict):
                continue

            db = SessionLocal()
            try:
                chat = db.query(Chat).filter(Chat.id == chat_id).first()
                sender = db.query(User).filter(User.id == user_id).first()
                if not sender or sender.is_blocked:
                    await websocket.close(code=4003)
                    return
                if not chat:
                    continue
                if chat.is_blocked:
                    await websocket.send_text(json.dumps({"error": "Chat is blocked"}))
                    continue

                receiver_id = chat.creator_id if user_id == chat.client_id else chat.client_id

                msg = Message(
                    chat_id=chat_id,
                    sender_id=user_id,
                    receiver_id=receiver_id,
                    message=message_data.get("message"),
                    attachment_url=message_data.get("attachment_url")
                )
                db.add(msg)

                setattr(chat, "last_message", (message_data.get("message") or "")[:100])
                db.commit()
                db.refresh(msg)

                broadcast_data = {
                    "id": msg.id,
                    "chat_id": msg.chat_id,
                    "sender_id": msg.sender_id,
                    "receiver_id": msg.receiver_id,
                    "message": msg.message,
                    "attachment_url": msg.attachment_url,
                    "is_read": msg.is_read,
                    "created_at": msg.created_at.isoformat(),
                    "sender": {
                        "id": sender.id,
                        "name": sender.name,
                        "avatar": sender.avatar
                    } if sender else None
                }
            finally:
                db.close()
            
            await manager.broadcast(broadcast_data, chat_id)
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, chat_id)

@router.get("")
def get_chats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.role == "client":
        chats = db.query(Chat).filter(Chat.client_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    elif current_user.role == "creator":
        chats = db.query(Chat).filter(Chat.creator_id == current_user.id).order_by(Chat.updated_at.desc()).all()
    else:
        chats = db.query(Chat).order_by(Chat.updated_at.desc()).all()
    
    return [_format_chat(c, current_user.id) for c in chats]

@router.get("/{chat_id}/messages")
def get_messages(
    chat_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = get_chat_for_participant(db, chat_id, current_user, allow_admin=True)

    messages = db.query(Message).filter(Message.chat_id == chat_id).order_by(Message.created_at.asc()).all()
    
    for msg in messages:
        if msg.receiver_id == current_user.id and not msg.is_read:
            setattr(msg, "is_read", True)
    db.commit()
    
    return [_format_message(m) for m in messages]

@router.post("/{chat_id}/messages")
def send_message(
    chat_id: int,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    chat = get_chat_for_participant(db, chat_id, current_user)
    if chat.is_blocked:
        raise HTTPException(status_code=403, detail="Chat is blocked")
    
    receiver_id = chat.creator_id if current_user.id == chat.client_id else chat.client_id
    
    msg = Message(
        chat_id=chat_id,
        sender_id=current_user.id,
        receiver_id=receiver_id,
        message=data.message,
        attachment_url=data.attachment_url
    )
    db.add(msg)
    setattr(chat, "last_message", (data.message or "")[:100])
    db.commit()
    db.refresh(msg)
    return _format_message(msg)

@router.post("/create/{creator_id}")
def create_chat(
    creator_id: int,
    current_user: User = Depends(require_role("client")),
    db: Session = Depends(get_db)
):
    existing = db.query(Chat).filter(
        Chat.client_id == current_user.id,
        Chat.creator_id == creator_id
    ).first()
    if existing:
        return _format_chat(existing, current_user.id)

    creator = db.query(User).filter(User.id == creator_id, User.role == "creator").first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")

    chat = Chat(client_id=current_user.id, creator_id=creator_id)
    db.add(chat)
    db.commit()
    db.refresh(chat)
    return _format_chat(chat, current_user.id)

def require_role(role: str):
    def checker(current_user: User = Depends(get_current_user)):
        if current_user.role not in [role, "admin"]:
            raise HTTPException(status_code=403, detail="Access denied")
        return current_user
    return checker

def _format_chat(c: Chat, user_id: int) -> dict:
    unread = 0
    if hasattr(c, 'messages'):
        unread = sum(1 for m in c.messages if m.receiver_id == user_id and not m.is_read)
    
    return {
        "id": c.id,
        "client_id": c.client_id,
        "creator_id": c.creator_id,
        "order_id": c.order_id,
        "last_message": c.last_message,
        "is_blocked": c.is_blocked,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "client": {"id": c.client.id, "name": c.client.name, "avatar": c.client.avatar} if c.client else None,
        "creator": {"id": c.creator.id, "name": c.creator.name, "avatar": c.creator.avatar} if c.creator else None,
        "unread_count": unread,
    }

def _format_message(m: Message) -> dict:
    return {
        "id": m.id,
        "chat_id": m.chat_id,
        "sender_id": m.sender_id,
        "receiver_id": m.receiver_id,
        "message": m.message,
        "attachment_url": m.attachment_url,
        "is_read": m.is_read,
        "is_flagged": m.is_flagged,
        "created_at": m.created_at.isoformat() if m.created_at else None,
        "sender": {
            "id": m.sender.id,
            "name": m.sender.name,
            "avatar": m.sender.avatar
        } if m.sender else None,
    }
