from pydantic import BaseModel, field_validator
from typing import Optional, List, Union
from datetime import datetime

class UserRegister(BaseModel):
    name: str
    email: str
    password: str
    role: str = "client"  # client or creator

    @field_validator("role")
    @classmethod
    def validate_role(cls, v):
        if v not in ["client", "creator"]:
            raise ValueError("Role must be client or creator")
        return v

    @field_validator("password")
    @classmethod
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v

class UserLogin(BaseModel):
    email: str
    password: str

class UserUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    role: str
    avatar: Optional[str] = None
    phone: Optional[str] = None
    is_active: bool
    is_blocked: bool
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str
    new_password: str

class CreatorProfileCreate(BaseModel):
    headline: Optional[str] = None
    bio: Optional[str] = None
    category: Optional[str] = None
    skills: Optional[List[str]] = []
    ai_tools: Optional[List[str]] = []
    languages: Optional[List[str]] = []
    experience: Optional[str] = None
    hourly_rate: Optional[float] = 0.0
    starting_price: Optional[float] = 0.0

class CreatorProfileResponse(BaseModel):
    id: int
    user_id: int
    headline: Optional[str] = None
    bio: Optional[str] = None
    category: Optional[str] = None
    skills: Optional[List] = []
    ai_tools: Optional[List] = []
    languages: Optional[List] = []
    experience: Optional[str] = None
    hourly_rate: float
    starting_price: float
    rating: float
    total_orders: int
    total_reviews: int
    is_verified: bool
    is_featured: bool
    approval_status: str
    banner_image: Optional[str] = None
    profile_completion: int
    user: Optional[UserResponse] = None
    created_at: datetime

    class Config:
        from_attributes = True

class ServiceCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    delivery_days: int = 7
    revisions: int = 2
    thumbnail: Optional[str] = None

class ServiceResponse(BaseModel):
    id: int
    creator_id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float
    delivery_days: int
    revisions: int
    thumbnail: Optional[str] = None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True

class PortfolioItemCreate(BaseModel):
    title: str
    description: Optional[str] = None
    media_url: Optional[str] = None
    media_type: str = "image"
    tags: Optional[List[str]] = []

class PortfolioItemResponse(BaseModel):
    id: int
    creator_id: int
    title: str
    description: Optional[str] = None
    media_url: Optional[str] = None
    media_type: str
    tags: Optional[List] = []
    created_at: datetime

    class Config:
        from_attributes = True

class OrderCreate(BaseModel):
    creator_id: int
    service_id: Optional[int] = None
    title: str
    brief: Optional[str] = None
    requirements: Optional[str] = None
    budget: float
    deadline: Optional[datetime] = None

class OrderResponse(BaseModel):
    id: int
    client_id: int
    creator_id: Optional[int] = None
    service_id: Optional[int] = None
    title: str
    brief: Optional[str] = None
    requirements: Optional[str] = None
    budget: float
    deadline: Optional[datetime] = None
    status: str
    delivery_url: Optional[str] = None
    delivery_notes: Optional[str] = None
    revision_count: int
    created_at: datetime
    completed_at: Optional[datetime] = None
    client: Optional[UserResponse] = None
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class OrderStatusUpdate(BaseModel):
    status: str

class DeliveryCreate(BaseModel):
    delivery_url: str
    delivery_notes: Optional[str] = None

class RevisionRequest(BaseModel):
    reason: str

class MessageCreate(BaseModel):
    message: Optional[str] = None
    attachment_url: Optional[str] = None

class MessageResponse(BaseModel):
    id: int
    chat_id: int
    sender_id: int
    receiver_id: int
    message: Optional[str] = None
    attachment_url: Optional[str] = None
    is_read: bool
    is_flagged: bool
    created_at: datetime
    sender: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ChatResponse(BaseModel):
    id: int
    client_id: int
    creator_id: int
    order_id: Optional[int] = None
    last_message: Optional[str] = None
    is_blocked: bool
    created_at: datetime
    client: Optional[UserResponse] = None
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    order_id: int
    rating: float
    comment: Optional[str] = None

    @field_validator("rating")
    @classmethod
    def validate_rating(cls, v):
        if not 1 <= v <= 5:
            raise ValueError("Rating must be between 1 and 5")
        return v

class ReviewResponse(BaseModel):
    id: int
    order_id: int
    client_id: int
    creator_id: int
    rating: float
    comment: Optional[str] = None
    is_hidden: bool
    created_at: datetime
    client: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class PaymentCreate(BaseModel):
    order_id: int
    amount: float
    payment_gateway: Optional[str] = "simulated"
    payment_method: Optional[str] = None

class PaymentVerify(BaseModel):
    order_id: int
    transaction_id: Optional[str] = None
    payment_id: Optional[Union[int, str]] = None
    razorpay_payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    amount: Optional[float] = None

class PaymentResponse(BaseModel):
    id: int
    order_id: int
    client_id: int
    creator_id: Optional[int] = None
    amount: float
    commission: float
    creator_earnings: float
    status: str
    payment_gateway: str
    transaction_id: Optional[str] = None
    refund_status: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: Optional[str] = None
    type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

class AssignmentCreate(BaseModel):
    client_id: int
    creator_id: int
    project_title: str
    project_description: Optional[str] = None
    required_category: Optional[str] = None
    required_ai_tools: Optional[List[str]] = []
    budget: Optional[float] = None
    deadline: Optional[datetime] = None
    admin_notes: Optional[str] = None

class AssignmentResponse(BaseModel):
    id: int
    client_id: int
    creator_id: Optional[int] = None
    admin_id: int
    project_title: str
    project_description: Optional[str] = None
    required_category: Optional[str] = None
    required_ai_tools: Optional[List] = []
    budget: Optional[float] = None
    deadline: Optional[datetime] = None
    status: str
    admin_notes: Optional[str] = None
    order_id: Optional[int] = None
    created_at: datetime
    client: Optional[UserResponse] = None
    creator: Optional[UserResponse] = None

    class Config:
        from_attributes = True

class DisputeCreate(BaseModel):
    order_id: int
    reason: str

class DisputeResolve(BaseModel):
    admin_decision: str
    status: str  # resolved

class DisputeResponse(BaseModel):
    id: int
    order_id: int
    raised_by: int
    reason: str
    status: str
    admin_decision: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    role: Optional[str] = None
    is_blocked: Optional[bool] = None
    is_active: Optional[bool] = None

class DashboardStats(BaseModel):
    total_users: int
    total_creators: int
    total_clients: int
    total_orders: int
    pending_orders: int
    completed_orders: int
    total_revenue: float
    active_chats: int
    new_registrations: int
