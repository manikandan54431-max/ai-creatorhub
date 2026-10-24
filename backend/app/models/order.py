from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class Order(Base):
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    title = Column(String(255), nullable=False)
    brief = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    budget = Column(Float, nullable=False)
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), default="pending")
    delivery_url = Column(Text, nullable=True)
    delivery_notes = Column(Text, nullable=True)
    revision_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)
    
    client = relationship("User", foreign_keys=[client_id], back_populates="client_orders")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="creator_orders")
    service = relationship("Service", back_populates="orders")
    payment = relationship("Payment", back_populates="order", uselist=False)
    review = relationship("Review", back_populates="order", uselist=False)
    chat = relationship("Chat", back_populates="order", uselist=False)
    dispute = relationship("Dispute", back_populates="order", uselist=False)
    delivery_submissions = relationship("DeliverySubmission", back_populates="order", order_by="DeliverySubmission.version_number")

class Assignment(Base):
    __tablename__ = "assignments"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_title = Column(String(255), nullable=False)
    project_description = Column(Text, nullable=True)
    required_category = Column(String(100), nullable=True)
    required_ai_tools = Column(JSON, default=list)
    budget = Column(Float, nullable=True)
    deadline = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(30), default="assigned")
    admin_notes = Column(Text, nullable=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    client = relationship("User", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[creator_id])
    admin = relationship("User", foreign_keys=[admin_id])

class Chat(Base):
    __tablename__ = "chats"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    last_message = Column(Text, nullable=True)
    is_blocked = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    client = relationship("User", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[creator_id])
    order = relationship("Order", back_populates="chat")
    messages = relationship("Message", back_populates="chat")

class Message(Base):
    __tablename__ = "messages"
    
    id = Column(Integer, primary_key=True, index=True)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=True)
    attachment_url = Column(Text, nullable=True)
    is_read = Column(Boolean, default=False)
    is_flagged = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    chat = relationship("Chat", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id], back_populates="sent_messages")
    receiver = relationship("User", foreign_keys=[receiver_id], back_populates="received_messages")

class Payment(Base):
    __tablename__ = "payments"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    amount = Column(Float, nullable=False)
    commission = Column(Float, default=0.0)
    creator_earnings = Column(Float, default=0.0)
    status = Column(String(30), default="pending")  # pending, completed, failed, refunded
    payment_gateway = Column(String(50), default="simulated")
    transaction_id = Column(String(255), nullable=True)
    refund_status = Column(String(30), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="payment")
    client = relationship("User", foreign_keys=[client_id], back_populates="client_payments")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="creator_payments")

class Review(Base):
    __tablename__ = "reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    rating = Column(Float, nullable=False)
    comment = Column(Text, nullable=True)
    is_hidden = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="review")
    client = relationship("User", foreign_keys=[client_id], back_populates="client_reviews")
    creator = relationship("User", foreign_keys=[creator_id], back_populates="creator_reviews")

class Notification(Base):
    __tablename__ = "notifications"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)
    type = Column(String(50), default="info")  # info, success, warning, error, order, chat
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", back_populates="notifications")

class Dispute(Base):
    __tablename__ = "disputes"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    raised_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reason = Column(Text, nullable=False)
    status = Column(String(30), default="open")  # open, under_review, resolved
    admin_decision = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    order = relationship("Order", back_populates="dispute")
    raiser = relationship("User", foreign_keys=[raised_by], back_populates="disputes_raised")

class SavedCreator(Base):
    __tablename__ = "saved_creators"
    
    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
