from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import enum
from app.core.database import Base

class UserRole(str, enum.Enum):
    client = "client"
    creator = "creator"
    admin = "admin"

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), default="client", nullable=False)
    avatar = Column(Text, nullable=True)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    creator_profile = relationship("CreatorProfile", back_populates="user", uselist=False,
                                   foreign_keys="CreatorProfile.user_id")
    client_orders = relationship("Order", foreign_keys="Order.client_id", back_populates="client")
    creator_orders = relationship("Order", foreign_keys="Order.creator_id", back_populates="creator")
    sent_messages = relationship("Message", foreign_keys="Message.sender_id", back_populates="sender")
    received_messages = relationship("Message", foreign_keys="Message.receiver_id", back_populates="receiver")
    notifications = relationship("Notification", back_populates="user")
    client_reviews = relationship("Review", foreign_keys="Review.client_id", back_populates="client")
    creator_reviews = relationship("Review", foreign_keys="Review.creator_id", back_populates="creator")
    client_payments = relationship("Payment", foreign_keys="Payment.client_id", back_populates="client")
    creator_payments = relationship("Payment", foreign_keys="Payment.creator_id", back_populates="creator")
    disputes_raised = relationship("Dispute", foreign_keys="Dispute.raised_by", back_populates="raiser")
    support_tickets = relationship("SupportTicket", foreign_keys="SupportTicket.user_id", back_populates="user")
