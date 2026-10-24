"""
PixVerse Generation Job Model
=============================
Tracks creator-only PixVerse text-to-video generation jobs. Durable so a
creator's history and in-flight jobs survive a server restart and a browser
refresh. Kept separate from the legacy ai_generation_jobs table (different
provider, different parameters).

Local status lifecycle (mapped from PixVerse provider status codes):
  queued → generating → saving_output → completed | failed

The provider task id (PixVerse video_id) is recorded as soon as submission is
accepted, so a successful submission is never mistaken for a completed
generation. The output is saved into private storage before a job is marked
completed; output_asset_id links to a StudioAsset only once the creator saves
it to My Media.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Integer, String, Text, ForeignKey
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.database import Base


class PixVerseJob(Base):
    __tablename__ = "pixverse_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    creator_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    provider: Mapped[str] = mapped_column(String(40), default="pixverse", nullable=False)
    model: Mapped[str] = mapped_column(String(60), nullable=False)

    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(10), nullable=False)
    duration: Mapped[int] = mapped_column(Integer, nullable=False)
    quality: Mapped[str] = mapped_column(String(10), nullable=False)
    seed: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # PixVerse video_id (the provider task id) + the per-request trace id.
    provider_task_id: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    trace_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # queued | generating | saving_output | completed | failed
    status: Mapped[str] = mapped_column(String(20), default="queued", nullable=False, index=True)
    provider_status: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String(40), nullable=True)
    credits: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Private on-disk copy of the completed output (never exposed as a path).
    storage_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    output_content_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    output_file_size: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Set only when the creator chooses "Save to My Media".
    output_asset_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("studio_assets.id"), nullable=True)

    poll_attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    created_at: Mapped[Optional[datetime]] = mapped_column(nullable=True, server_default=func.now())
    submitted_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(nullable=True)

    creator = relationship("User", foreign_keys=[creator_id])
    output_asset = relationship("StudioAsset", foreign_keys=[output_asset_id])
