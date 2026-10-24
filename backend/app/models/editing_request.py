"""
Client media editing requests (Issue 5).

A client uploads their own photos/videos and asks a chosen creator to edit them.

This is deliberately **not** a parallel delivery system. Each request owns an
`Order`, so everything downstream — creator acceptance, delivery submissions,
version history, revision requests, admin review, the eligible-release policy,
auto-release and final client acceptance — is the existing workflow, unchanged.
The request rows add only what the existing schema has no place for: the client's
source media and the editing brief.
"""

from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text, ForeignKey, BigInteger, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base

class EditingRequest(Base):
    """A client's request for a creator to edit media the client supplied."""

    __tablename__ = "editing_requests"

    id = Column(Integer, primary_key=True, index=True)

    order_id = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)

    client_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    title = Column(String(255), nullable=False)

    instructions = Column(Text, nullable=False)
    preferred_style = Column(String(120), nullable=True)
    deliverables = Column(Text, nullable=True)

    deliverable_type = Column(String(20), default="video", nullable=False)

    output_format = Column(String(60), nullable=True)        # e.g. "MP4 1080p"
    aspect_ratio = Column(String(20), nullable=True)         # e.g. "9:16"
    target_duration_seconds = Column(Integer, nullable=True)

    budget = Column(Integer, nullable=True)                  # whole INR
    deadline = Column(DateTime(timezone=True), nullable=True)

    status = Column(String(32), default="pending_creator_response", nullable=False, index=True)

    creator_response_note = Column(Text, nullable=True)
    responded_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    order = relationship("Order", foreign_keys=[order_id])
    client = relationship("User", foreign_keys=[client_id])
    creator = relationship("User", foreign_keys=[creator_id])
    media = relationship(
        "EditingRequestMedia",
        back_populates="request",
        order_by="EditingRequestMedia.id",
        cascade="all, delete-orphan",
    )

    TERMINAL_STATUSES = ("declined", "cancelled", "completed")

class EditingRequestMedia(Base):
    """
    One source file supplied by the client.

    Only metadata and a private storage key live here — the bytes stay on
    private storage and are served exclusively through an authorised endpoint.
    Browser object URLs are never used for persistence.
    """

    __tablename__ = "editing_request_media"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("editing_requests.id"), nullable=False, index=True)

    media_type = Column(String(20), nullable=False)          # "video" | "image"

    storage_key = Column(Text, nullable=False)

    original_filename = Column(String(255), nullable=True)
    detected_content_type = Column(String(100), nullable=True)
    file_size = Column(BigInteger, nullable=True)

    duration = Column(Integer, nullable=True)                # whole seconds
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    probe_metadata = Column(JSON, nullable=True)

    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("EditingRequest", back_populates="media")
