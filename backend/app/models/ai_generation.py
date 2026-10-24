"""
AI Generation Job Model
========================
Tracks HuggingFace image and video generation jobs for creators.
Jobs persist across server restarts so users don't lose their generation history.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base

class AIGenerationJob(Base):
    """
    Tracks a single HuggingFace generation request (image or video).

    Status lifecycle:
      queued → running → completed | failed

    On completion, the output is saved as a StudioAsset.
    The output_asset_id links back to the saved asset.
    """
    __tablename__ = "ai_generation_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    job_type: Mapped[str] = mapped_column(String(10), nullable=False)

    model: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    negative_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    width: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    height: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    output_asset_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("studio_assets.id"), nullable=True)

    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, server_default=func.now())
    started_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    creator = relationship("User", foreign_keys=[creator_id])
    output_asset = relationship("StudioAsset", foreign_keys=[output_asset_id])
