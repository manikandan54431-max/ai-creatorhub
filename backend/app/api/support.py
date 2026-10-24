"""
Support Tickets API
===================
- Public: create ticket (contact form)
- Authenticated users: view own tickets, reply
- Admin: view all tickets, filter, reply, update status
"""

from typing import Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import get_current_user, require_admin
from app.models.user import User
from app.models.delivery import SupportTicket, SupportTicketReply

router = APIRouter(prefix="/api/support", tags=["support"])

class TicketCreate(BaseModel):
    name: str
    email: str
    subject: str
    message: str
    category: Optional[str] = None
    order_id: Optional[int] = None

class AuthenticatedTicketCreate(BaseModel):
    """For authenticated users — name and email are optional (pulled from user profile)."""
    name: Optional[str] = None
    email: Optional[str] = None
    subject: str
    message: str
    category: Optional[str] = None
    order_id: Optional[int] = None

class TicketReplyCreate(BaseModel):
    message: str

class TicketStatusUpdate(BaseModel):
    status: str  # open, in_progress, waiting_for_user, resolved

def _fmt_ticket(t: SupportTicket) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "email": t.email,
        "subject": t.subject,
        "message": t.message,
        "category": t.category,
        "status": t.status,
        "order_id": t.order_id,
        "user_id": t.user_id,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
        "replies": [_fmt_reply(r) for r in (t.replies or [])],
    }

def _fmt_reply(r: SupportTicketReply) -> dict:
    return {
        "id": r.id,
        "ticket_id": r.ticket_id,
        "author_id": r.author_id,
        "message": r.message,
        "is_admin_reply": r.is_admin_reply,
        "author_name": r.author.name if r.author else "System",
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }

@router.post("/tickets")
def create_ticket(
    data: TicketCreate,
    db: Session = Depends(get_db),
):
    """
    Submit a support request.
    No authentication required — also handles public contact form.
    If outbound email is not configured, the ticket is saved and
    the user is told their request was received (no fake email claim).
    """
    ticket = SupportTicket(
        name=data.name,
        email=data.email,
        subject=data.subject,
        message=data.message,
        category=data.category,
        order_id=data.order_id,
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return {
        "id": ticket.id,
        "status": "open",
        "message": "Your support request has been received. Our team will respond as soon as possible. You can also reach us directly at manikandan54431@gmail.com or +91 6380994709.",
    }

@router.post("/tickets/authenticated")
def create_ticket_authenticated(
    data: AuthenticatedTicketCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a ticket linked to the authenticated user. Name/email auto-filled from profile."""
    ticket = SupportTicket(
        user_id=current_user.id,
        name=data.name or current_user.name,
        email=data.email or current_user.email,
        subject=data.subject,
        message=data.message,
        category=data.category,
        order_id=data.order_id,
        status="open",
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    return {
        "id": ticket.id,
        "status": "open",
        "message": "Your support request has been received and is linked to your account.",
    }

@router.get("/tickets/my")
def get_my_tickets(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logged-in users can view their own tickets."""
    tickets = db.query(SupportTicket).filter(
        SupportTicket.user_id == current_user.id
    ).order_by(SupportTicket.created_at.desc()).all()
    return [_fmt_ticket(t) for t in tickets]

@router.get("/tickets/my/{ticket_id}")
def get_my_ticket_detail(
    ticket_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _fmt_ticket(ticket)

@router.post("/tickets/my/{ticket_id}/reply")
def reply_to_my_ticket(
    ticket_id: int,
    data: TicketReplyCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(
        SupportTicket.id == ticket_id,
        SupportTicket.user_id == current_user.id
    ).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket.status == "resolved":
        raise HTTPException(status_code=400, detail="This ticket is already resolved. Please open a new ticket.")

    reply = SupportTicketReply(
        ticket_id=ticket_id,
        author_id=current_user.id,
        message=data.message,
        is_admin_reply=False,
    )
    db.add(reply)
    setattr(ticket, "status", "open")  # reopen if waiting_for_user
    db.commit()
    db.refresh(reply)
    return _fmt_reply(reply)

@router.get("/admin/tickets")
def admin_list_tickets(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, le=200),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    query = db.query(SupportTicket)
    if status:
        query = query.filter(SupportTicket.status == status)
    if category:
        query = query.filter(SupportTicket.category == category)
    if search:
        query = query.filter(
            SupportTicket.subject.ilike(f"%{search}%") |
            SupportTicket.name.ilike(f"%{search}%") |
            SupportTicket.email.ilike(f"%{search}%")
        )
    tickets = query.order_by(SupportTicket.created_at.desc()).offset(skip).limit(limit).all()
    return [_fmt_ticket(t) for t in tickets]

@router.get("/admin/tickets/{ticket_id}")
def admin_get_ticket(
    ticket_id: int,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return _fmt_ticket(ticket)

@router.post("/admin/tickets/{ticket_id}/reply")
def admin_reply_ticket(
    ticket_id: int,
    data: TicketReplyCreate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    reply = SupportTicketReply(
        ticket_id=ticket_id,
        author_id=admin.id,
        message=data.message,
        is_admin_reply=True,
    )
    db.add(reply)
    setattr(ticket, "status", "waiting_for_user")
    db.commit()
    db.refresh(reply)
    return _fmt_reply(reply)

@router.put("/admin/tickets/{ticket_id}/status")
def admin_update_ticket_status(
    ticket_id: int,
    data: TicketStatusUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    allowed = ["open", "in_progress", "waiting_for_user", "resolved"]
    if data.status not in allowed:
        raise HTTPException(status_code=400, detail=f"Status must be one of: {', '.join(allowed)}")

    ticket = db.query(SupportTicket).filter(SupportTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    setattr(ticket, "status", data.status)
    db.commit()
    return {"id": ticket.id, "status": ticket.status}
