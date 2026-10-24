"""
Blog API
========
Static seed articles stored in the database.
Admins can manage; public can read.
"""

import json
from typing import Optional, List
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.database import get_db
from app.core.security import require_admin
from app.models.delivery import BlogPost

router = APIRouter(prefix="/api/blog", tags=["blog"])

SEED_ARTICLES = [
    {
        "slug": "how-to-write-a-clear-brief-for-an-ai-video-creator",
        "title": "How to Write a Clear Brief for an AI Video Creator",
        "category": "For Clients",
        "author_label": "AI CreatorHub Editorial",
        "reading_time_minutes": 5,
        "excerpt": "A well-written brief is the foundation of every great video project. Learn how to communicate your vision so your AI creator can deliver exactly what you need.",
        "content": """## Why Your Brief Matters

When you hire an AI video creator through AI CreatorHub, the brief you provide is the single most important document in the entire project. It tells your creator what you need, how you want it to feel, and what success looks like. A vague brief leads to missed expectations, revision cycles, and delays.

Start with one clear sentence: what should the video achieve? Examples:
- "We want to announce our new product launch to existing customers."
- "We need a 60-second explainer for our homepage that reduces bounce rate."
- "I want a short-form reel for Instagram to grow our fitness brand."

Describe the exact people who will watch the video. Include:
- Age range and demographics
- What platform they use
- What they already know about your product
- What they need to feel or do after watching

Be specific:
- 15-second vertical reel, 9:16 aspect ratio
- 2-minute landscape explainer, 16:9
- 30-second square social clip, 1:1

If you're unsure, say so. Your creator can advise based on the platform.

Use reference videos or describe the feeling:
- "Professional and authoritative, like a SaaS product demo"
- "Energetic and fun, fast cuts, upbeat music"
- "Calm and reassuring, slow pace, soothing narration"

You can also link to videos on YouTube or attach files in the project chat.

List the three to five things the viewer must know or feel after watching. Do not list twenty points. Prioritize ruthlessly.

Share your:
- Logo files
- Brand colors (hex codes)
- Fonts (if you need them used)
- Any visual elements to avoid

If you have script ideas or specific phrases, include them. If you want the creator to write the script, say so.

Be honest about when you actually need the final approved video, not when you'd like to start.

- **Do not write "make it look good."** Tell them what good looks like for your brand.
- **Do not share a 10-page document** when a focused one-page brief is clearer.
- **Do not reference 12 different reference videos** with contradictory styles.

If you are struggling to write your brief, AI CreatorHub includes an AI Brief Assistant on the hire page. Enter a rough idea and the assistant will generate a structured brief you can edit before submitting.

A good brief includes: your goal, your audience, the format and length, the tone and style, key messages, brand assets, and a real deadline. Write it once, write it well, and your creator can start delivering quality work immediately.
""",
        "tags": '["briefs", "clients", "communication"]',
        "is_published": True,
    },
    {
        "slug": "what-to-prepare-before-hiring-an-ai-content-creator",
        "title": "What to Prepare Before Hiring an AI Content Creator",
        "category": "For Clients",
        "author_label": "AI CreatorHub Editorial",
        "reading_time_minutes": 4,
        "excerpt": "Getting ready before you hire saves time and helps your creator start working immediately. Here is a practical checklist for every client.",
        "content": """## Before You Post a Project

Hiring an AI content creator on AI CreatorHub is straightforward, but clients who prepare well get better results faster. This guide is a practical checklist of everything to have ready before you create an order.

Collect these files before you start:
- ☐ Logo in PNG or SVG (transparent background preferred)
- ☐ Brand color palette (hex codes, e.g. #0078D4)
- ☐ Primary and secondary fonts (or font names from Google Fonts)
- ☐ Any brand pattern, texture, or watermark files

Find two or three videos that capture the style you want. These do not need to be your competitors. They can be from any industry. Save their URLs. Be prepared to explain *specifically* what you like about each one.

Decide whether you want:
- A fully written script you provide
- Talking points the creator will script
- Fully creator-written content based on your brief

If you have a draft script, have it ready in a text document.

Know where the video will be published:
- YouTube: 16:9, typically 2–15 minutes
- Instagram Reels / TikTok: 9:16, 15–90 seconds
- Website homepage: 16:9, typically 60–90 seconds
- LinkedIn: 16:9 or 1:1, 30–120 seconds

Have a realistic budget in mind. Research typical market rates for the type of video you need. Know your actual final deadline — not a wish, but the date you cannot miss.

Identify who in your organization will review and approve the video. Make sure that person is available during the project. Delays often happen because the approver is unreachable, not because the creator is slow.

When you place your order or submit a project request, you will be asked for:
- Project title
- Brief and requirements
- Budget
- Deadline

An admin will review your request and assign the right creator. Once assigned, you will have a private project chat to communicate directly.

You do not need to do anything else immediately. An admin will assign a creator and notify you. Your creator will be in touch via the project chat.

The final video will go through an admin review before it is delivered to you. This quality check is built into every project on AI CreatorHub.

Prepare your brand assets, reference videos, content direction, platform specs, budget, and timeline before you hire. The more you have ready, the faster your creator can start — and the better your result will be.
""",
        "tags": '["preparation", "clients", "hiring"]',
        "is_published": True,
    },
    {
        "slug": "how-admin-video-approval-works-on-ai-creatorhub",
        "title": "How Admin Video Approval Works on AI CreatorHub",
        "category": "Platform Guide",
        "author_label": "AI CreatorHub Editorial",
        "reading_time_minutes": 5,
        "excerpt": "Every video delivery on AI CreatorHub goes through an admin review before the client receives it. Here is exactly how that process works and why it protects everyone.",
        "content": """## Why We Review Every Video Before Delivery

AI CreatorHub uses a mandatory admin review process for all video deliveries. No video is delivered directly from the creator to the client without first passing through an admin quality check.

This protects clients from receiving work that does not meet requirements. It protects creators from disputes about misaligned expectations. And it ensures the platform maintains a consistent standard of quality.

When a creator has completed the project video, they go to the order detail page and use the "Submit Video for Review" section. They:

- Enter a video title and delivery notes
- Upload the video file (MP4, WebM, or MOV)
- Optionally upload a thumbnail
- Preview the video before submitting
- Click "Submit to Admin for Approval"

After submission, the creator sees a confirmation: *"Your video has been submitted for admin review. The client will receive it only after approval."*

The video is stored securely. It is not accessible to anyone except the creator and admins.

An admin receives a notification and sees the new submission in the Video Approvals dashboard. The admin can:

- Watch the video in a secure player
- Read the creator's delivery notes
- Review the original project brief and requirements
- Check all previous submission versions
- Add internal notes (private to admins)

**If the video meets the requirements:**
The admin clicks "Approve and Deliver to Client." A confirmation dialog appears. Upon confirming:
- The specific version is marked approved
- The delivery timestamp is recorded along with the approving admin's identity
- The client receives a notification: "Your approved project video is ready"
- The creator receives a notification: "Your video was approved and delivered"

**If the video needs changes:**
The admin clicks "Request Changes" and provides specific feedback. A reason is required — the admin cannot request changes without explaining what needs to be corrected. The creator receives a notification with the feedback.

The client sees the approved video in their order detail page. Before approval, they see: *"Your project is in progress. The final video will appear here after quality review."*

After approval, they see:
- A video player with the approved video
- An "Admin Verified" badge
- The creator's delivery notes
- Options to download, accept the delivery, or request a revision

If the client is satisfied, they click "Accept Delivery." This moves the order to completed status.

If the client wants changes, they click "Request Revision." This sends a revision request to the creator. The creator then uploads a new version. Every new version goes through the same admin review — there are no shortcuts.

Every submission is versioned. If a creator submits three versions, all three are stored and visible in the admin review panel. Approving version 3 never retroactively approves versions 1 and 2.

- Pending or rejected video files
- Private storage URLs for unapproved videos
- Internal admin notes
- Creator-admin feedback before it is formally delivered

Admin review is not a formality. It is a built-in quality gate that every project goes through. It ensures that what the client sees is work the platform is confident meets the project requirements.
""",
        "tags": '["platform", "approvals", "quality", "workflow"]',
        "is_published": True,
    },
    {
        "slug": "how-creators-can-build-a-strong-portfolio",
        "title": "How Creators Can Build a Strong Portfolio on AI CreatorHub",
        "category": "For Creators",
        "author_label": "AI CreatorHub Editorial",
        "reading_time_minutes": 6,
        "excerpt": "Your portfolio is your most powerful tool for winning projects. Learn what clients look for and how to present your best AI video work effectively.",
        "content": """## Why Your Portfolio Is Your Best Sales Tool

On AI CreatorHub, clients browse creator profiles before deciding whom they want to work with. Your portfolio is the first — and often only — thing they will judge you by. A strong portfolio wins assignments. A weak or empty one loses them.

Before adding portfolio pieces, understand what clients evaluate:

1. **Can this creator do the type of video I need?** — Show work that matches what you want to get hired for.
2. **Is the quality consistent?** — Three exceptional pieces beat ten average ones.
3. **Can they work in my style?** — Show range if you have it, but make your best style obvious.
4. **Are they serious?** — A complete, detailed profile signals professionalism.

Do not add everything you have ever made. Add your best five to ten pieces. For each piece, choose work that:
- Demonstrates strong visual quality
- Shows a clear, focused outcome (product, story, message)
- Represents the type of projects you want to attract

Remove or exclude work that is rough, experimental, or that you would not want to recreate commercially.

Every portfolio item has a title and description. Use these. A blank description wastes an opportunity.

For each item, write:
- What the project was for (type of video, not the client's name if private)
- What AI tools were used (Runway Gen-2, Suno AI, ElevenLabs, etc.)
- The specific outcome or purpose of the video
- The platform it was created for

Example: *"60-second product launch reel for a fitness supplement brand. Created using Runway Gen-2 for motion, ElevenLabs for voiceover, and Suno AI for the background music. Designed for Instagram Reels (9:16)."*

AI CreatorHub clients are specifically looking for AI-powered creators. Make your AI tool expertise prominent:
- List every AI tool you are proficient with in your profile
- Describe how you use each tool in your portfolio descriptions
- Highlight your unique combination of tools

Your headline appears below your name on every listing. It should:
- Be specific, not generic
- Mention your specialization and tools
- Be under 15 words

Weak: "Professional Video Creator"
Strong: "AI Video Creator | Runway Gen-2, ElevenLabs | Product & Brand Stories"

The platform calculates a profile completion score. A fully completed profile includes:
- Professional bio (use the AI Bio Generator if you need a starting point)
- Category and skills
- AI tools listed
- Starting price set
- At least one portfolio item
- At least one active service

Incomplete profiles rank lower in search results and are less likely to receive admin assignments.

When an admin assigns a project to you, respond promptly via the project chat. Confirm you have received the brief. Ask clarifying questions early, not after you have started work. Clients notice when a creator communicates well — it leads to strong reviews.

Every completed project is an opportunity to:
- Request a review from the client
- Ask if you can reference the project type in your portfolio (keep client names private unless you have permission)
- Note what worked well to refine your future process

Build your portfolio with your best, most relevant work. Write specific descriptions that highlight your AI tools and process. Complete every section of your profile. Communicate professionally on every project. This is how you become a top-rated creator on AI CreatorHub.
""",
        "tags": '["creators", "portfolio", "profile", "tips"]',
        "is_published": True,
    },
    {
        "slug": "how-to-give-useful-feedback-on-a-video-delivery",
        "title": "How to Give Useful Feedback on a Video Delivery",
        "category": "For Clients",
        "author_label": "AI CreatorHub Editorial",
        "reading_time_minutes": 4,
        "excerpt": "Vague feedback wastes everyone's time and leads to revision cycles that go nowhere. Here is how to give feedback that actually leads to the video you want.",
        "content": """## The Problem with Vague Feedback

"Can you make it more dynamic?" is not useful feedback. "Can you add more energy?" tells a creator nothing actionable. "I don't like it" gives the creator nowhere to go.

Vague feedback leads to guesswork. Guesswork leads to revisions that miss the mark. Revisions that miss the mark frustrate both parties and waste project time.

Specific, structured feedback is the only kind that works.

Before you write a single word of feedback, watch the entire video at least twice. Take notes on your second watch. Do not pause to write after 10 seconds and miss the second half.

Use this structure for every revision request:

Start with what you want to keep. This tells the creator what not to change. If you skip this, they may revise something you already liked.

Example: "The intro sequence with the logo animation is exactly right. Keep that."

Be specific about the problem, not just the symptom.

Weak: "The music feels wrong."
Strong: "The music is too upbeat for this product. We sell sleep aids. I need something slower and calmer. Reference: [YouTube link to a similar video with the right feel]."

Weak: "The pacing is off."
Strong: "The transition between scenes 2 and 3 feels rushed — give it at least 1 second more before the text appears."

If you have seen a video that has the element you want, link to it. A reference is worth a thousand words of description. Be specific about what part of the reference video you mean: "I want the text animation style from 0:45 of this video."

Rank your requests:
- **Must fix:** The voiceover is missing in the final 15 seconds.
- **Should fix:** The background color in the middle section clashes with our brand colors.
- **Optional:** The transition to the CTA could be smoother if it's easy to do.

This prevents the creator from prioritizing minor preferences over critical corrections.

All feedback should go through the project chat on AI CreatorHub, not via personal messages, email, or verbal calls. This creates a clear record that both you and your creator can refer back to.

When you receive a revised delivery, go back to your original feedback list. Check each item. Confirm what has been addressed before asking for more changes.

If everything is correct, accept the delivery promptly. Leaving a delivery hanging without response is unfair to the creator.

Watch the full video before giving feedback. Tell the creator what to keep, what to change, and why — with specific examples and references. Separate must-have fixes from optional improvements. Keep all communication in the project chat. When revisions are complete, review your original list and accept promptly.
""",
        "tags": '["clients", "feedback", "revisions", "communication"]',
        "is_published": True,
    },
]

def seed_blog_posts(db: Session):
    """Seed initial blog posts if table is empty."""
    count = db.query(BlogPost).count()
    if count == 0:
        for article in SEED_ARTICLES:
            post = BlogPost(**article)
            db.add(post)
        db.commit()

def _fmt_post(p: BlogPost, full: bool = False) -> dict:
    result = {
        "id": p.id,
        "slug": p.slug,
        "title": p.title,
        "excerpt": p.excerpt,
        "category": p.category,
        "author_label": p.author_label,
        "reading_time_minutes": p.reading_time_minutes,
        "tags": json.loads(p.tags) if p.tags else [],
        "cover_image_url": p.cover_image_url,
        "is_published": p.is_published,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    }
    if full:
        result["content"] = p.content
    return result

@router.get("/posts")
def list_posts(
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, le=100),
    db: Session = Depends(get_db),
):
    """Public: list all published blog posts."""
    seed_blog_posts(db)

    query = db.query(BlogPost).filter(BlogPost.is_published == True)
    if category:
        query = query.filter(BlogPost.category == category)
    if search:
        query = query.filter(
            BlogPost.title.ilike(f"%{search}%") |
            BlogPost.excerpt.ilike(f"%{search}%") |
            BlogPost.content.ilike(f"%{search}%")
        )
    posts = query.order_by(BlogPost.created_at.desc()).offset(skip).limit(limit).all()
    return [_fmt_post(p) for p in posts]

@router.get("/posts/categories")
def list_categories(db: Session = Depends(get_db)):
    """Public: list distinct categories."""
    seed_blog_posts(db)
    cats = db.query(BlogPost.category).filter(BlogPost.is_published == True).distinct().all()
    return [c[0] for c in cats if c[0]]

@router.get("/posts/{slug}")
def get_post(slug: str, db: Session = Depends(get_db)):
    """Public: get a single post by slug."""
    seed_blog_posts(db)
    post = db.query(BlogPost).filter(BlogPost.slug == slug, BlogPost.is_published == True).first()
    if not post:
        raise HTTPException(status_code=404, detail="Article not found")
    return _fmt_post(post, full=True)
