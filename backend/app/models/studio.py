"""
Studio Models — AI Video Studio for Creators
=============================================
Three tables:
  1. studio_projects    — project metadata + timeline JSON
  2. studio_assets      — uploaded media (video/image/audio)
  3. studio_render_jobs — export job tracking

All private. Creators see only their own records.
"""
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime, Text,
    Float, ForeignKey, BigInteger, JSON
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class StudioProject(Base):
    """
    A creator's editing project. May optionally be linked to an order.
    timeline_json stores the full editor state (clips, texts, audio, captions).
    """
    __tablename__ = "studio_projects"

    id              = Column(Integer, primary_key=True, index=True)
    creator_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id        = Column(Integer, ForeignKey("orders.id"), nullable=True)

    title           = Column(String(255), nullable=False, default="Untitled Project")
    aspect_ratio    = Column(String(10), default="16:9")   # "16:9" | "9:16" | "1:1"
    duration        = Column(Float, default=0.0)            # seconds

    timeline_json       = Column(Text, default="{}")
    output_settings_json = Column(Text, default="{}")

    revision_number = Column(Integer, default=1)

    is_deleted      = Column(Boolean, default=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator  = relationship("User", foreign_keys=[creator_id])
    order    = relationship("Order", foreign_keys=[order_id])
    assets   = relationship("StudioAsset", back_populates="project",
                            foreign_keys="StudioAsset.project_id",
                            cascade="all, delete-orphan")
    render_jobs = relationship("StudioRenderJob", back_populates="project",
                               cascade="all, delete-orphan")

class StudioAsset(Base):
    """
    An uploaded media file belonging to a creator.
    May optionally be tied to a project; creators can also have library-level assets.
    Storage key never leaves the backend (served via authenticated stream endpoint).
    """
    __tablename__ = "studio_assets"

    id              = Column(Integer, primary_key=True, index=True)
    creator_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id      = Column(Integer, ForeignKey("studio_projects.id"), nullable=True)

    media_type      = Column(String(20), nullable=False)

    storage_key     = Column(Text, nullable=False)

    original_filename       = Column(String(255), nullable=True)
    detected_content_type   = Column(String(100), nullable=True)
    file_size               = Column(BigInteger, nullable=True)   # bytes
    duration                = Column(Float, nullable=True)        # seconds, for video/audio
    width                   = Column(Integer, nullable=True)
    height                  = Column(Integer, nullable=True)

    metadata_json   = Column(Text, default="{}")

    is_deleted      = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), server_default=func.now())

    creator  = relationship("User", foreign_keys=[creator_id])
    project  = relationship("StudioProject", back_populates="assets",
                            foreign_keys=[project_id])

class StudioRenderJob(Base):
    """
    Tracks a render/export job for a studio project.
    Status: queued → rendering → completed | failed | cancelled
    """
    __tablename__ = "studio_render_jobs"

    id              = Column(Integer, primary_key=True, index=True)
    project_id      = Column(Integer, ForeignKey("studio_projects.id"), nullable=False)
    creator_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    project_revision        = Column(Integer, nullable=False, default=1)
    timeline_snapshot_json  = Column(Text, nullable=False)   # frozen copy at render time
    output_settings_json    = Column(Text, default="{}")

    status          = Column(String(20), default="queued", nullable=False)
    progress        = Column(Float, nullable=True)          # 0–100 or None for indeterminate
    error_message   = Column(Text, nullable=True)

    output_storage_key = Column(Text, nullable=True)
    output_file_size   = Column(BigInteger, nullable=True)

    delivery_submission_id = Column(Integer, ForeignKey("delivery_submissions.id"), nullable=True)

    started_at   = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at   = Column(DateTime(timezone=True), server_default=func.now())

    creator  = relationship("User", foreign_keys=[creator_id])
    project  = relationship("StudioProject", back_populates="render_jobs")
    delivery = relationship("DeliverySubmission", foreign_keys=[delivery_submission_id])
