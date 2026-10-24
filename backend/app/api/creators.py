from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user, require_role
from app.models.user import User
from app.models.creator import CreatorProfile, Service, PortfolioItem
from app.schemas.schemas import (
    CreatorProfileCreate, CreatorProfileResponse,
    ServiceCreate, ServiceResponse,
    PortfolioItemCreate, PortfolioItemResponse
)

router = APIRouter(prefix="/api/creators", tags=["creators"])

@router.get("", response_model=List[dict])
def get_creators(
    skip: int = 0,
    limit: int = 20,
    category: Optional[str] = None,
    search: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    min_rating: Optional[float] = None,
    is_verified: Optional[bool] = None,
    sort_by: str = "popular",
    db: Session = Depends(get_db)
):
    query = db.query(CreatorProfile).join(User, CreatorProfile.user_id == User.id).filter(
        CreatorProfile.approval_status == "approved",
        User.is_active == True,
        User.is_blocked == False
    )
    
    if category:
        query = query.filter(CreatorProfile.category == category)
    if search:
        query = query.filter(
            (User.name.ilike(f"%{search}%")) |
            (CreatorProfile.headline.ilike(f"%{search}%")) |
            (CreatorProfile.category.ilike(f"%{search}%"))
        )
    if min_price is not None:
        query = query.filter(CreatorProfile.starting_price >= min_price)
    if max_price is not None:
        query = query.filter(CreatorProfile.starting_price <= max_price)
    if min_rating is not None:
        query = query.filter(CreatorProfile.rating >= min_rating)
    if is_verified is not None:
        query = query.filter(CreatorProfile.is_verified == is_verified)
    
    if sort_by == "top_rated":
        query = query.order_by(CreatorProfile.rating.desc())
    elif sort_by == "price_low":
        query = query.order_by(CreatorProfile.starting_price.asc())
    elif sort_by == "price_high":
        query = query.order_by(CreatorProfile.starting_price.desc())
    elif sort_by == "newest":
        query = query.order_by(CreatorProfile.created_at.desc())
    else:  # popular
        query = query.order_by(CreatorProfile.total_orders.desc())
    
    creators = query.offset(skip).limit(limit).all()
    return [_format_creator(c) for c in creators]

@router.get("/featured", response_model=List[dict])
def get_featured_creators(db: Session = Depends(get_db)):
    creators = db.query(CreatorProfile).join(User, CreatorProfile.user_id == User.id).filter(
        CreatorProfile.is_featured == True,
        CreatorProfile.approval_status == "approved",
        User.is_active == True
    ).limit(8).all()
    return [_format_creator(c) for c in creators]

@router.get("/search")
def search_creators(q: str = Query(""), db: Session = Depends(get_db)):
    creators = db.query(CreatorProfile).join(User, CreatorProfile.user_id == User.id).filter(
        CreatorProfile.approval_status == "approved",
        (User.name.ilike(f"%{q}%")) | (CreatorProfile.headline.ilike(f"%{q}%")) |
        (CreatorProfile.category.ilike(f"%{q}%"))
    ).limit(10).all()
    return [_format_creator(c) for c in creators]

@router.get("/me", response_model=dict)
def get_my_creator_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    creator = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    result = _format_creator(creator)
    result["services"] = [_format_service(s) for s in creator.services if s.is_active]
    result["portfolio"] = [_format_portfolio(p) for p in creator.portfolio_items]
    return result

@router.get("/{user_id}", response_model=dict)
def get_creator(user_id: int, db: Session = Depends(get_db)):
    creator = db.query(CreatorProfile).filter(CreatorProfile.user_id == user_id).first()
    if not creator:
        raise HTTPException(status_code=404, detail="Creator not found")
    result = _format_creator(creator)
    result["services"] = [_format_service(s) for s in creator.services if s.is_active]
    result["portfolio"] = [_format_portfolio(p) for p in creator.portfolio_items]
    return result

@router.put("/profile", response_model=dict)
def update_profile(
    data: CreatorProfileCreate,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        profile = CreatorProfile(user_id=current_user.id)
        db.add(profile)
    
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(profile, field, value)
    
    completion = 0
    if profile.headline: completion += 15
    if profile.bio: completion += 20
    if profile.category: completion += 15
    if profile.skills: completion += 15
    if profile.ai_tools: completion += 10
    if profile.languages: completion += 10
    if profile.starting_price: completion += 15
    setattr(profile, "profile_completion", completion)
    
    db.commit()
    db.refresh(profile)
    return _format_creator(profile)

@router.post("/portfolio", response_model=dict)
def add_portfolio_item(
    data: PortfolioItemCreate,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    item = PortfolioItem(creator_id=profile.id, **data.dict())
    db.add(item)
    db.commit()
    db.refresh(item)
    return _format_portfolio(item)

@router.delete("/portfolio/{item_id}")
def delete_portfolio_item(
    item_id: int,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    item = db.query(PortfolioItem).filter(
        PortfolioItem.id == item_id,
        PortfolioItem.creator_id == profile.id
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Portfolio item not found")
    db.delete(item)
    db.commit()
    return {"message": "Portfolio item deleted"}

@router.post("/services", response_model=dict)
def create_service(
    data: ServiceCreate,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    
    service = Service(creator_id=profile.id, **data.dict())
    db.add(service)
    db.commit()
    db.refresh(service)
    return _format_service(service)

@router.get("/services/my")
def get_my_services(
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        return []
    return [_format_service(s) for s in profile.services]

@router.get("/services/{creator_id}")
def get_creator_services(creator_id: int, db: Session = Depends(get_db)):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == creator_id).first()
    if not profile:
        return []
    return [_format_service(s) for s in profile.services if s.is_active]

@router.put("/services/{service_id}")
def update_service(
    service_id: int,
    data: ServiceCreate,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    service = db.query(Service).filter(Service.id == service_id, Service.creator_id == profile.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return _format_service(service)

@router.delete("/services/{service_id}")
def delete_service(
    service_id: int,
    current_user: User = Depends(require_role("creator")),
    db: Session = Depends(get_db)
):
    profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Creator profile not found")
    service = db.query(Service).filter(Service.id == service_id, Service.creator_id == profile.id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(service)
    db.commit()
    return {"message": "Service deleted"}

def _format_creator(c: CreatorProfile) -> dict:
    return {
        "id": c.id,
        "user_id": c.user_id,
        "name": c.user.name if c.user else "",
        "email": c.user.email if c.user else "",
        "avatar": c.user.avatar if c.user else None,
        "headline": c.headline,
        "bio": c.bio,
        "category": c.category,
        "skills": c.skills or [],
        "ai_tools": c.ai_tools or [],
        "languages": c.languages or [],
        "experience": c.experience,
        "hourly_rate": c.hourly_rate,
        "starting_price": c.starting_price,
        "rating": round(c.rating, 1),
        "total_orders": c.total_orders,
        "total_reviews": c.total_reviews,
        "is_verified": c.is_verified,
        "is_featured": c.is_featured,
        "approval_status": c.approval_status,
        "banner_image": c.banner_image,
        "profile_completion": c.profile_completion,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }

def _format_service(s: Service) -> dict:
    return {
        "id": s.id,
        "creator_id": s.creator_id,
        "title": s.title,
        "description": s.description,
        "category": s.category,
        "price": s.price,
        "delivery_days": s.delivery_days,
        "revisions": s.revisions,
        "thumbnail": s.thumbnail,
        "is_active": s.is_active,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }

def _format_portfolio(p: PortfolioItem) -> dict:
    return {
        "id": p.id,
        "creator_id": p.creator_id,
        "title": p.title,
        "description": p.description,
        "media_url": p.media_url,
        "media_type": p.media_type,
        "tags": p.tags or [],
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }
