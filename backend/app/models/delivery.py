from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, UniqueConstraint, BigInteger
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class DeliverySubmission(Base):
    """
    Tracks creator video deliveries for each order.
    Videos go through admin review before being delivered to the client.
    """
    __tablename__ = "delivery_submissions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    version_number = Column(Integer, nullable=False, default=1)

    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    storage_key = Column(Text, nullable=True)          # e.g. "deliveries/order_5/v1_abc123.mp4"
    thumbnail_storage_key = Column(Text, nullable=True)

    original_filename = Column(String(255), nullable=True)
    file_size = Column(BigInteger, nullable=True)       # bytes
    detected_content_type = Column(String(100), nullable=True)

    status = Column(String(30), default="draft", nullable=False)

    creator_visible_feedback = Column(Text, nullable=True)

    internal_admin_notes = Column(Text, nullable=True)

    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    submitted_at = Column(DateTime(timezone=True), nullable=True)   # when moved to pending_review
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)   # when made available to client

    review_due_at = Column(DateTime(timezone=True), nullable=True)
    released_at = Column(DateTime(timezone=True), nullable=True)
    release_method = Column(String(40), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("Order", back_populates="delivery_submissions")
    creator = relationship("User", foreign_keys=[creator_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])

    __table_args__ = (
        UniqueConstraint("order_id", "version_number", name="uq_order_version"),
    )

class DeliveryAuditLog(Base):
    """
    Immutable audit trail for all delivery-related actions.
    """
    __tablename__ = "delivery_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    delivery_id = Column(Integer, ForeignKey("delivery_submissions.id"), nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    actor_role = Column(String(20), nullable=False)
    action = Column(String(50), nullable=False)
    details = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    delivery = relationship("DeliverySubmission")
    actor = relationship("User", foreign_keys=[actor_id])

class SupportTicket(Base):
    """
    Support tickets created via the contact/support pages.
    """
    __tablename__ = "support_tickets"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # nullable for public
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False)
    subject = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    category = Column(String(100), nullable=True)
    status = Column(String(30), default="open", nullable=False)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", foreign_keys=[user_id], back_populates="support_tickets")
    replies = relationship("SupportTicketReply", back_populates="ticket")

class SupportTicketReply(Base):
    """
    Threaded replies on support tickets.
    """
    __tablename__ = "support_ticket_replies"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("support_tickets.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    message = Column(Text, nullable=False)
    is_admin_reply = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    ticket = relationship("SupportTicket", back_populates="replies")
    author = relationship("User", foreign_keys=[author_id])

class BlogPost(Base):
    """
    Blog articles stored in the database.
    """
    __tablename__ = "blog_posts"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text, nullable=False)
    excerpt = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    author_label = Column(String(255), default="AI CreatorHub Editorial")
    reading_time_minutes = Column(Integer, default=5)
    is_published = Column(Boolean, default=True)
    cover_image_url = Column(Text, nullable=True)
    tags = Column(Text, nullable=True)  # JSON string list
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
