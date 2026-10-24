from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os
import logging

logger = logging.getLogger(__name__)

from app.core.config import settings, validate_security_settings
from app.core.database import engine, Base

for _problem in validate_security_settings(settings):
    logger.warning("Insecure configuration (development only): %s", _problem)

from app.models import *

Base.metadata.create_all(bind=engine)

def _run_sqlite_migrations():
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        ds_cols = {col["name"] for col in inspect(engine).get_columns("delivery_submissions")}
        new_ds_cols = {
            "review_due_at": "DATETIME",
            "released_at":   "DATETIME",
            "release_method": "VARCHAR(40)",
        }
        for col_name, col_type in new_ds_cols.items():
            if col_name not in ds_cols:
                try:
                    conn.execute(text(
                        f"ALTER TABLE delivery_submissions ADD COLUMN {col_name} {col_type}"
                    ))
                    conn.commit()
                    logger.info("Migration: added delivery_submissions.%s", col_name)
                except Exception as e:
                    logger.warning("Migration skip %s: %s", col_name, e)

try:
    _run_sqlite_migrations()
except Exception as e:
    logger.error("Migration error (non-fatal): %s", e)

from app.api.auth import router as auth_router
from app.api.creators import router as creators_router
from app.api.orders import router as orders_router
from app.api.chats import router as chats_router
from app.api.reviews_payments import review_router, payment_router
from app.api.notifications import notification_router
from app.api.admin import router as admin_router
from app.api.deliveries import router as delivery_router
from app.api.support import router as support_router
from app.api.blog import router as blog_router
from app.api.studio import router as studio_router
from app.api.editing_requests import router as editing_requests_router
from app.api.pixverse import router as pixverse_router
from app.api.public import router as public_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.ENABLE_AUTO_RELEASE_SCHEDULER:
        try:
            from app.workers.auto_release_worker import start_scheduler
            start_scheduler()
            logger.info("Auto-release scheduler running.")
        except Exception as e:
            logger.error("Failed to start auto-release scheduler: %s", e)

    if settings.ENABLE_PIXVERSE_WORKER:
        try:
            from app.workers.pixverse_worker import start_pixverse_scheduler
            start_pixverse_scheduler()
        except Exception as e:
            logger.error("Failed to start PixVerse worker: %s", e)

    yield

    try:
        from app.workers.auto_release_worker import stop_scheduler
        stop_scheduler()
    except Exception:
        pass
    try:
        from app.workers.pixverse_worker import stop_pixverse_scheduler
        stop_pixverse_scheduler()
    except Exception:
        pass

app = FastAPI(
    title="AI CreatorHub API",
    description="Full-stack AI Content Creator Marketplace API",
    version="2.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
        "http://localhost:5177",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://127.0.0.1:5175",
        "http://127.0.0.1:5176",
        "http://127.0.0.1:5177",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(creators_router)
app.include_router(orders_router)
app.include_router(chats_router)
app.include_router(review_router)
app.include_router(payment_router)
app.include_router(notification_router)
app.include_router(admin_router)
app.include_router(delivery_router)
app.include_router(support_router)
app.include_router(blog_router)
app.include_router(studio_router)
app.include_router(editing_requests_router)
app.include_router(pixverse_router)
app.include_router(public_router)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.get("/")
def root():
    return {
        "message": "AI CreatorHub API",
        "version": "2.0.0",
        "docs": "/api/docs",
        "status": "running"
    }

@app.get("/api/health")
def health():
    return {"status": "ok", "platform": "AI CreatorHub"}
