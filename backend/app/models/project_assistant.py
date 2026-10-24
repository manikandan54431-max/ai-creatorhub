from sqlalchemy import Column, Integer, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class ProjectAssistantSession(Base):
    """Per-order AI assistant workspace for the assigned creator."""
    __tablename__ = "project_assistant_sessions"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("orders.id"), unique=True, nullable=False, index=True)
    creator_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    context_hash = Column(String(16), nullable=True)

    analysis = Column(JSON, nullable=True)

    selected_concept_index = Column(Integer, nullable=True)

    conversation = Column(JSON, nullable=False, default=list)

    concept_versions = Column(JSON, nullable=False, default=list)

    is_outdated = Column(Boolean, nullable=False, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now())

    order = relationship("Order", foreign_keys=[order_id])
    creator = relationship("User", foreign_keys=[creator_id])
