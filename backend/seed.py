"""
AI CreatorHub - Database Seed Script
Creates admin account + demo data
Run: python seed.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User
from app.models.creator import CreatorProfile, Service, PortfolioItem
from app.models.order import Order, Chat, Message, Payment, Review, Assignment, Dispute, Notification, SavedCreator
from app.core.config import settings
from datetime import datetime, timedelta
import random

Base.metadata.create_all(bind=engine)
db = SessionLocal()

print("🌱 Starting AI CreatorHub seed...")

print("🧹 Clearing existing data...")
for table in [SavedCreator, Dispute, Notification, Review, Payment, Message, Chat, Assignment, Order, PortfolioItem, Service, CreatorProfile, User]:
    db.query(table).delete()
db.commit()

print("👤 Creating admin...")
admin = User(
    name=settings.ADMIN_NAME,
    email=settings.ADMIN_EMAIL,
    password_hash=hash_password(settings.ADMIN_PASSWORD),
    role="admin",
    avatar="https://ui-avatars.com/api/?name=Admin&background=4F46E5&color=fff",
    is_active=True
)
db.add(admin)
db.commit()
db.refresh(admin)

print("👥 Creating clients...")
client_data = [
    {"name": "Aisha Sharma", "email": "aisha@example.com", "avatar": "https://ui-avatars.com/api/?name=Aisha+Sharma&background=EC4899&color=fff"},
    {"name": "Rohan Mehta", "email": "rohan@example.com", "avatar": "https://ui-avatars.com/api/?name=Rohan+Mehta&background=3B82F6&color=fff"},
    {"name": "Neha Gupta", "email": "neha@example.com", "avatar": "https://ui-avatars.com/api/?name=Neha+Gupta&background=10B981&color=fff"},
    {"name": "Kunal Verma", "email": "kunal@example.com", "avatar": "https://ui-avatars.com/api/?name=Kunal+Verma&background=F59E0B&color=fff"},
    {"name": "Priyanka Das", "email": "priyanka@example.com", "avatar": "https://ui-avatars.com/api/?name=Priyanka+Das&background=8B5CF6&color=fff"},
]

clients = []
for c in client_data:
    user = User(
        name=c["name"],
        email=c["email"],
        password_hash=hash_password("Client@123"),
        role="client",
        avatar=c["avatar"],
        is_active=True
    )
    db.add(user)
    clients.append(user)
db.commit()
for c in clients:
    db.refresh(c)

print("🎨 Creating creators...")
creator_data = [
    {
        "name": "Priya Patel",
        "email": "priya@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Priya+Patel&background=F43F5E&color=fff",
        "headline": "AI Reels Creator | Viral Content Specialist",
        "bio": "I create jaw-dropping AI-powered reels that stop the scroll. Specializing in brand storytelling through Instagram Reels and YouTube Shorts using cutting-edge AI tools.",
        "category": "Instagram Reels",
        "skills": ["AI Video Editing", "Storytelling", "Brand Content", "Viral Marketing"],
        "ai_tools": ["RunwayML", "ElevenLabs", "Midjourney", "CapCut AI"],
        "languages": ["English", "Hindi", "Gujarati"],
        "experience": "3 years",
        "starting_price": 4999,
        "rating": 4.9,
        "total_orders": 87,
        "is_featured": True,
    },
    {
        "name": "Arjun Singh",
        "email": "arjun@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Arjun+Singh&background=3B82F6&color=fff",
        "headline": "AI Video Editor | Cinematic AI Films",
        "bio": "Transforming brands with cinematic AI videos. I blend traditional filmmaking principles with AI technology to create stunning product videos, brand films, and advertisements.",
        "category": "AI Video Creation",
        "skills": ["AI Video Production", "Motion Graphics", "Color Grading", "Screenplay"],
        "ai_tools": ["Sora", "RunwayML", "Pika Labs", "Adobe Firefly"],
        "languages": ["English", "Hindi", "Punjabi"],
        "experience": "4 years",
        "starting_price": 7999,
        "rating": 4.8,
        "total_orders": 124,
        "is_featured": True,
    },
    {
        "name": "Divya Nair",
        "email": "divya@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Divya+Nair&background=8B5CF6&color=fff",
        "headline": "AI UGC Ads Creator | Performance Marketing",
        "bio": "UGC ads specialist using AI to create authentic, high-converting ad content. My AI-powered UGC videos consistently deliver 3-5x ROAS for e-commerce brands.",
        "category": "UGC Ads",
        "skills": ["UGC Content", "AI Ad Creation", "E-commerce", "Performance Marketing"],
        "ai_tools": ["HeyGen", "Synthesia", "ElevenLabs", "D-ID"],
        "languages": ["English", "Malayalam", "Tamil"],
        "experience": "2 years",
        "starting_price": 5999,
        "rating": 4.7,
        "total_orders": 63,
        "is_featured": True,
    },
    {
        "name": "Karthik Kumar",
        "email": "karthik@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Karthik+Kumar&background=10B981&color=fff",
        "headline": "AI Image Artist | Brand Visual Creator",
        "bio": "Creating breathtaking AI-generated visuals for brands. From product photography to abstract art, I use AI to create images that tell your brand's story powerfully.",
        "category": "AI Image Generation",
        "skills": ["AI Art", "Product Photography", "Brand Visuals", "Digital Illustration"],
        "ai_tools": ["Midjourney", "DALL-E 3", "Stable Diffusion", "Adobe Firefly"],
        "languages": ["English", "Tamil", "Kannada"],
        "experience": "3 years",
        "starting_price": 2999,
        "rating": 4.6,
        "total_orders": 201,
        "is_featured": False,
    },
    {
        "name": "Sneha Reddy",
        "email": "sneha@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Sneha+Reddy&background=F59E0B&color=fff",
        "headline": "AI Animation Creator | 2D/3D Motion Expert",
        "bio": "Bringing characters and brands to life with AI animation. Specializing in explainer videos, animated ads, and brand mascot creation using the latest AI animation tools.",
        "category": "AI Animation",
        "skills": ["2D Animation", "3D Animation", "Motion Graphics", "Character Design"],
        "ai_tools": ["Kling AI", "Luma AI", "Stable Video", "AnimateDiff"],
        "languages": ["English", "Telugu", "Hindi"],
        "experience": "5 years",
        "starting_price": 9999,
        "rating": 4.9,
        "total_orders": 52,
        "is_featured": True,
    },
    {
        "name": "Vikram Joshi",
        "email": "vikram@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Vikram+Joshi&background=EF4444&color=fff",
        "headline": "Prompt Engineer | AI System Architect",
        "bio": "Master prompt engineer with expertise in crafting optimized prompts for ChatGPT, Claude, Midjourney, and Stable Diffusion. I help businesses unlock the full potential of AI.",
        "category": "Prompt Engineering",
        "skills": ["Prompt Engineering", "AI Automation", "LLM Fine-tuning", "Workflow Design"],
        "ai_tools": ["ChatGPT", "Claude", "Gemini", "Midjourney"],
        "languages": ["English", "Hindi", "Marathi"],
        "experience": "3 years",
        "starting_price": 3999,
        "rating": 4.8,
        "total_orders": 178,
        "is_featured": False,
    },
    {
        "name": "Meera Krishnan",
        "email": "meera@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Meera+Krishnan&background=06B6D4&color=fff",
        "headline": "AI Voiceover Artist | Multilingual Content",
        "bio": "Creating crystal-clear AI voiceovers in 20+ languages. Perfect for explainer videos, ads, e-learning content, and podcast narration. Human-quality AI voices that connect.",
        "category": "Voiceover",
        "skills": ["AI Voiceover", "Script Writing", "Audio Editing", "Multilingual Content"],
        "ai_tools": ["ElevenLabs", "Murf AI", "Play.ht", "Resemble AI"],
        "languages": ["English", "Hindi", "Tamil", "Telugu", "Malayalam"],
        "experience": "2 years",
        "starting_price": 1999,
        "rating": 4.7,
        "total_orders": 312,
        "is_featured": False,
    },
    {
        "name": "Rahul Agarwal",
        "email": "rahul@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Rahul+Agarwal&background=84CC16&color=fff",
        "headline": "AI Product Photographer | E-commerce Visuals",
        "bio": "Revolutionizing e-commerce with AI product photography. Generate stunning product visuals without expensive photoshoots. Perfect for Amazon, Flipkart, and D2C brands.",
        "category": "AI Image Generation",
        "skills": ["Product Photography", "AI Styling", "Background Replacement", "E-commerce Visuals"],
        "ai_tools": ["Midjourney", "Adobe Firefly", "Canva AI", "Remove.bg AI"],
        "languages": ["English", "Hindi"],
        "experience": "2 years",
        "starting_price": 3499,
        "rating": 4.5,
        "total_orders": 95,
        "is_featured": False,
    },
    {
        "name": "Ananya Chakraborty",
        "email": "ananya@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Ananya+Chakraborty&background=F97316&color=fff",
        "headline": "AI Brand Content Creator | Social Media Expert",
        "bio": "Full-funnel AI content strategist helping brands dominate social media. From strategy to creation, I build content ecosystems that drive real business results using AI.",
        "category": "AI Video Creation",
        "skills": ["Content Strategy", "Social Media", "Brand Storytelling", "AI Content"],
        "ai_tools": ["Canva AI", "Adobe Firefly", "ChatGPT", "RunwayML"],
        "languages": ["English", "Bengali", "Hindi"],
        "experience": "4 years",
        "starting_price": 6999,
        "rating": 4.8,
        "total_orders": 73,
        "is_featured": True,
    },
    {
        "name": "Sanjay Yadav",
        "email": "sanjay@example.com",
        "avatar": "https://ui-avatars.com/api/?name=Sanjay+Yadav&background=7C3AED&color=fff",
        "headline": "AI YouTube Shorts Creator | Viral Growth Expert",
        "bio": "Helping brands go viral on YouTube Shorts with AI-powered content. My shorts consistently achieve 100K+ views. Specializing in educational, entertainment, and brand content.",
        "category": "YouTube Shorts",
        "skills": ["YouTube Shorts", "Viral Content", "AI Editing", "Growth Hacking"],
        "ai_tools": ["CapCut AI", "ElevenLabs", "RunwayML", "Pika Labs"],
        "languages": ["English", "Hindi", "Bhojpuri"],
        "experience": "3 years",
        "starting_price": 5499,
        "rating": 4.6,
        "total_orders": 141,
        "is_featured": False,
    },
]

creators = []
creator_profiles = []

for cd in creator_data:
    user = User(
        name=cd["name"],
        email=cd["email"],
        password_hash=hash_password("Creator@123"),
        role="creator",
        avatar=cd["avatar"],
        is_active=True
    )
    db.add(user)
    db.flush()
    
    profile = CreatorProfile(
        user_id=user.id,
        headline=cd["headline"],
        bio=cd["bio"],
        category=cd["category"],
        skills=cd["skills"],
        ai_tools=cd["ai_tools"],
        languages=cd["languages"],
        experience=cd["experience"],
        starting_price=cd["starting_price"],
        hourly_rate=cd["starting_price"] / 5,
        rating=cd["rating"],
        total_orders=cd["total_orders"],
        total_reviews=cd["total_orders"] // 3,
        is_verified=True,
        is_featured=cd["is_featured"],
        approval_status="approved",
        profile_completion=95
    )
    db.add(profile)
    db.flush()
    creators.append(user)
    creator_profiles.append(profile)

db.commit()

print("📦 Creating services...")
service_templates = [
    {"title": "Basic Package", "price_mult": 1.0, "days": 5, "revisions": 2},
    {"title": "Standard Package", "price_mult": 2.0, "days": 7, "revisions": 3},
    {"title": "Premium Package", "price_mult": 3.5, "days": 10, "revisions": 5},
]

services = []
for profile in creator_profiles[:8]:
    user = db.query(User).filter(User.id == profile.user_id).first()
    for tmpl in service_templates[:2]:
        svc = Service(
            creator_id=profile.id,
            title=f"{tmpl['title']} - {profile.category} Content",
            description=f"Professional {profile.category} content creation using AI tools. Includes {tmpl['revisions']} revisions and delivery in {tmpl['days']} days.",
            category=profile.category,
            price=round(profile.starting_price * tmpl["price_mult"]),
            delivery_days=tmpl["days"],
            revisions=tmpl["revisions"],
            is_active=True
        )
        db.add(svc)
        services.append(svc)

db.commit()

print("🖼️  Creating portfolio items...")
portfolio_titles = [
    "Brand Launch Campaign",
    "Viral Product Reel",
    "AI Avatar Ad",
    "Cinematic Product Video",
    "Social Media Content Pack",
    "E-commerce Product Shots",
    "Animated Explainer Video",
    "Multilingual Campaign",
]

media_urls = [
    "https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800",
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800",
    "https://images.unsplash.com/photo-1633356122102-3fe601e05bd2?w=800",
    "https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?w=800",
    "https://images.unsplash.com/photo-1636819488524-1f019c4e1c44?w=800",
    "https://images.unsplash.com/photo-1614850523011-8f49fec7e6ce?w=800",
]

for profile in creator_profiles:
    for i in range(3):
        item = PortfolioItem(
            creator_id=profile.id,
            title=f"{random.choice(portfolio_titles)} #{i+1}",
            description=f"A stunning {profile.category} project created using {', '.join(profile.ai_tools[:2])}.",
            media_url=random.choice(media_urls),
            media_type="image",
            tags=profile.skills[:3],
        )
        db.add(item)

db.commit()

print("📋 Creating orders...")
order_statuses = ["completed", "in_progress", "delivered", "completed", "completed", "accepted", "pending", "revision_requested", "cancelled", "completed"]
orders = []

for i in range(10):
    client = random.choice(clients)
    creator = random.choice(creators)
    profile = next((p for p in creator_profiles if p.user_id == creator.id), None)
    profile_services = [s for s in services if profile and s.creator_id == profile.id]
    svc = random.choice(profile_services) if profile_services else (random.choice(services) if services else None)
    
    order = Order(
        client_id=client.id,
        creator_id=creator.id,
        service_id=svc.id if svc else None,
        title=f"{random.choice(['Brand Video', 'Product Reel', 'AI Ad', 'Content Pack', 'Viral Short'])} for {client.name}",
        brief=f"I need high-quality {profile.category if profile else 'content'} for my brand. Looking for professional and engaging content that connects with the target audience.",
        requirements=f"Duration: 30-60 seconds, Platform: Instagram/YouTube, Style: Modern and dynamic, Language: English+Hindi",
        budget=profile.starting_price * random.uniform(1, 3) if profile else 5000,
        deadline=datetime.utcnow() + timedelta(days=random.randint(5, 30)),
        status=order_statuses[i],
        revision_count=random.randint(0, 2),
        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 60))
    )
    
    if order_statuses[i] == "completed":
        order.completed_at = datetime.utcnow() - timedelta(days=random.randint(1, 10))
        order.delivery_url = "https://drive.google.com/file/demo_delivery"
        order.delivery_notes = "Final files are ready. Includes source files and all formats."
    
    db.add(order)
    orders.append(order)

db.commit()

print("💳 Creating payments...")
for order in orders:
    if order.status in ["completed", "in_progress", "delivered", "accepted", "revision_requested"]:
        commission_pct = 0.20
        commission = order.budget * commission_pct
        payment = Payment(
            order_id=order.id,
            client_id=order.client_id,
            creator_id=order.creator_id,
            amount=order.budget,
            commission=commission,
            creator_earnings=order.budget - commission,
            status="completed" if order.status == "completed" else "pending",
            payment_gateway="simulated",
            transaction_id=f"TXN_{order.id:04d}ABC{random.randint(1000, 9999)}",
            created_at=order.created_at
        )
        db.add(payment)

db.commit()

print("💬 Creating chats and messages...")
chat_messages = [
    ("Hi! I'm interested in your services. Can we discuss my project?", "client"),
    ("Hello! Thanks for reaching out. I'd love to help. What's your project about?", "creator"),
    ("I need a 60-second product video for my skincare brand.", "client"),
    ("Great! I specialize in exactly that. What's your budget and timeline?", "creator"),
    ("Budget is around ₹15,000 and need it in 2 weeks.", "client"),
    ("That works perfectly. I can deliver a high-quality AI-powered product video within 10 days.", "creator"),
    ("That sounds great! I'll place the order now.", "client"),
    ("Wonderful! I'll start working on it as soon as the order is confirmed.", "creator"),
]

for i in range(5):
    client = clients[i % len(clients)]
    creator = creators[i % len(creators)]
    order = orders[i] if i < len(orders) else None
    
    chat = Chat(
        client_id=client.id,
        creator_id=creator.id,
        order_id=order.id if order else None,
        last_message="That sounds great! I'll place the order now.",
        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 30))
    )
    db.add(chat)
    db.flush()
    
    for j, (msg_text, sender_role) in enumerate(chat_messages):
        sender = client if sender_role == "client" else creator
        receiver = creator if sender_role == "client" else client
        msg = Message(
            chat_id=chat.id,
            sender_id=sender.id,
            receiver_id=receiver.id,
            message=msg_text,
            is_read=True,
            created_at=chat.created_at + timedelta(minutes=j*5)
        )
        db.add(msg)

db.commit()

print("⭐ Creating reviews...")
review_comments = [
    "Absolutely phenomenal work! The AI-generated content exceeded all my expectations. Will definitely hire again!",
    "Very professional and delivered on time. The quality was outstanding. My Instagram engagement tripled!",
    "Great creator! Understood my vision perfectly and brought it to life with AI tools I never knew existed.",
    "Amazing talent! The reels she created went viral. 500K+ views in just 3 days. Highly recommended!",
    "Excellent communication and top-notch delivery. The AI voiceover sounded more human than expected.",
    "Fantastic experience! The AI animations were stunning and my audience loved them. Will hire again!",
    "Professional, creative, and fast. Delivered ahead of schedule with amazing quality. 5 stars!",
    "Best investment for my brand! The UGC ads created are converting incredibly well. ROI is insane!",
    "Exceptional work on our product photography. The AI backgrounds look photorealistic!",
    "Outstanding prompt engineering work. My AI automation now saves 10+ hours per week!",
]

completed_orders = [o for o in orders if o.status == "completed"]
for i, order in enumerate(completed_orders[:8]):
    review = Review(
        order_id=order.id,
        client_id=order.client_id,
        creator_id=order.creator_id,
        rating=random.choice([4.5, 4.8, 5.0, 4.7, 4.9]),
        comment=review_comments[i % len(review_comments)],
        created_at=order.completed_at or datetime.utcnow() - timedelta(days=random.randint(1, 10))
    )
    db.add(review)

db.commit()

for profile in creator_profiles:
    reviews = db.query(Review).filter(Review.creator_id == profile.user_id, Review.is_hidden == False).all()
    if reviews:
        profile.rating = round(sum(r.rating for r in reviews) / len(reviews), 2)
        profile.total_reviews = len(reviews)

db.commit()

print("📌 Creating assignments...")
assignment_data = [
    {
        "title": "Premium Brand Campaign for Aisha",
        "description": "Create a comprehensive AI content campaign for a luxury skincare brand. Need 5 product videos, 10 Instagram reels, and 20 product images.",
        "category": "AI Video Creation",
        "ai_tools": ["RunwayML", "Midjourney"],
        "budget": 50000,
    },
    {
        "title": "E-commerce Content Pack for Rohan's Store",
        "description": "Full e-commerce content creation including product photography, promotional videos, and social media content.",
        "category": "AI Image Generation",
        "ai_tools": ["Midjourney", "DALL-E 3"],
        "budget": 25000,
    },
    {
        "title": "YouTube Shorts Strategy for Neha's Startup",
        "description": "Create 30 YouTube Shorts over 3 months to grow Neha's fitness brand channel from 0 to 10K subscribers.",
        "category": "YouTube Shorts",
        "ai_tools": ["CapCut AI", "RunwayML"],
        "budget": 30000,
    },
]

for i, ad in enumerate(assignment_data):
    client = clients[i]
    creator = creators[i]
    
    order = Order(
        client_id=client.id,
        creator_id=creator.id,
        title=ad["title"],
        brief=ad["description"],
        budget=ad["budget"],
        deadline=datetime.utcnow() + timedelta(days=30),
        status="assigned",
        created_at=datetime.utcnow() - timedelta(days=random.randint(1, 5))
    )
    db.add(order)
    db.flush()
    
    assignment = Assignment(
        client_id=client.id,
        creator_id=creator.id,
        admin_id=admin.id,
        project_title=ad["title"],
        project_description=ad["description"],
        required_category=ad["category"],
        required_ai_tools=ad["ai_tools"],
        budget=ad["budget"],
        deadline=datetime.utcnow() + timedelta(days=30),
        status="assigned",
        admin_notes="High priority client. Please ensure top-quality delivery.",
        order_id=order.id,
        created_at=order.created_at
    )
    db.add(assignment)
    
    chat = Chat(
        client_id=client.id,
        creator_id=creator.id,
        order_id=order.id,
        last_message=f"Admin has assigned you to project: {ad['title']}"
    )
    db.add(chat)

db.commit()

print("⚠️  Creating disputes...")
if len(orders) >= 2:
    dispute1 = Dispute(
        order_id=orders[6].id,
        raised_by=orders[6].client_id,
        reason="The delivery does not match the brief provided. The video quality is poor and the AI-generated content looks unnatural. Requesting immediate revision or refund.",
        status="under_review",
        created_at=datetime.utcnow() - timedelta(days=2)
    )
    db.add(dispute1)
    
    dispute2 = Dispute(
        order_id=orders[7].id if len(orders) > 7 else orders[0].id,
        raised_by=orders[7].client_id if len(orders) > 7 else orders[0].client_id,
        reason="Creator stopped responding after initial payment. No updates on the project for 10 days.",
        status="open",
        created_at=datetime.utcnow() - timedelta(days=5)
    )
    db.add(dispute2)

db.commit()

print("🔔 Creating notifications...")
for user in clients + creators:
    notifs = [
        Notification(user_id=user.id, title="Welcome to AI CreatorHub! 🎉", message="Complete your profile to get started.", type="info"),
        Notification(user_id=user.id, title="New Feature Available", message="Check out our new AI Brief Generator tool!", type="info"),
    ]
    for n in notifs:
        db.add(n)

db.commit()

print("\n✅ Seed complete! Summary:")
print(f"   👤 Admin: {admin.email} / {settings.ADMIN_PASSWORD}")
print(f"   👥 Clients: {len(clients)} (password: Client@123)")
print(f"   🎨 Creators: {len(creator_profiles)} (password: Creator@123)")
print(f"   📦 Services: {len(services)}")
print(f"   📋 Orders: {len(orders)}")
print(f"   ⭐ Reviews: {len(completed_orders[:8])}")
print(f"   💬 Chats: 5")
print(f"   📌 Assignments: 3")
print(f"   ⚠️  Disputes: 2")
print(f"\n🚀 Backend URL: http://localhost:8000")
print(f"📖 API Docs: http://localhost:8000/api/docs")
print(f"\nCreator logins:")
for cd in creator_data:
    print(f"   {cd['email']} / Creator@123")
print(f"\nClient logins:")
for c in client_data:
    print(f"   {c['email']} / Client@123")

db.close()
