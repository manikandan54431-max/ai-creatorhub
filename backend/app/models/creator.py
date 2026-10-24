from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base

class CreatorProfile(Base):
    __tablename__ = "creator_profiles"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    headline = Column(String(255), nullable=True)
    bio = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    skills = Column(JSON, default=list)
    ai_tools = Column(JSON, default=list)
    languages = Column(JSON, default=list)
    experience = Column(String(100), nullable=True)
    hourly_rate = Column(Float, default=0.0)
    starting_price = Column(Float, default=0.0)
    portfolio_links = Column(JSON, default=list)
    rating = Column(Float, default=0.0)
    total_orders = Column(Integer, default=0)
    total_reviews = Column(Integer, default=0)
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_featured = Column(Boolean, default=False)
    approval_status = Column(String(20), default="pending")  # pending, approved, rejected, suspended
    banner_image = Column(Text, nullable=True)
    profile_completion = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    user = relationship("User", foreign_keys=[user_id], back_populates="creator_profile")
    verifier = relationship("User", foreign_keys=[verified_by])
    services = relationship("Service", back_populates="creator")
    portfolio_items = relationship("PortfolioItem", back_populates="creator")

class Service(Base):
    __tablename__ = "services"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)
    price = Column(Float, nullable=False)
    delivery_days = Column(Integer, default=7)
    revisions = Column(Integer, default=2)
    thumbnail = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    creator = relationship("CreatorProfile", back_populates="services")
    orders = relationship("Order", back_populates="service")

class PortfolioItem(Base):
    __tablename__ = "portfolio_items"
    
    id = Column(Integer, primary_key=True, index=True)
    creator_id = Column(Integer, ForeignKey("creator_profiles.id"), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    media_url = Column(Text, nullable=True)
    media_type = Column(String(20), default="image")  # image, video, link
    tags = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    creator = relationship("CreatorProfile", back_populates="portfolio_items")
