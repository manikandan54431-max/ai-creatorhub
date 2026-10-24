import os
import sys
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["ENABLE_AUTO_RELEASE_SCHEDULER"] = "false"
os.environ["ENABLE_PIXVERSE_WORKER"] = "false"  # never start the real poller in tests
for _key in ("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"):
    os.environ[_key] = ""

from app.core.database import Base, get_db
from app.core.security import hash_password, create_access_token
from app.main import app
from app.models.user import User
from app.models.creator import CreatorProfile
from app.models.order import Order, Notification
from app.models.delivery import DeliverySubmission, SupportTicket, BlogPost

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture(scope="session", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)

@pytest.fixture(autouse=True)
def isolated_uploads(tmp_path, monkeypatch):
    """Redirect private upload dirs to a temp folder so tests never write into private_uploads/."""
    from app.api import deliveries, studio
    deliv = tmp_path / "private_uploads" / "deliveries"
    thumbs = tmp_path / "private_uploads" / "thumbnails"
    assets = tmp_path / "private_uploads" / "studio" / "assets"
    renders = tmp_path / "private_uploads" / "studio" / "renders"
    for d in (deliv, thumbs, assets, renders):
        d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(deliveries, "DELIVERY_UPLOAD_DIR", str(deliv))
    monkeypatch.setattr(deliveries, "THUMBNAIL_UPLOAD_DIR", str(thumbs))
    monkeypatch.setattr(studio, "_BASE", str(tmp_path))
    monkeypatch.setattr(studio, "STUDIO_ASSET_DIR", str(assets))
    monkeypatch.setattr(studio, "STUDIO_RENDER_DIR", str(renders))

    # PixVerse output + asset dirs
    from app.api import pixverse as pvapi
    from app.workers import pixverse_worker as pvw
    pv_dir = tmp_path / "private_uploads" / "pixverse"
    pv_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(pvapi, "PIXVERSE_DIR", str(pv_dir))
    monkeypatch.setattr(pvapi, "STUDIO_ASSET_DIR", str(assets))
    monkeypatch.setattr(pvw, "PIXVERSE_DIR", str(pv_dir))
    yield

@pytest.fixture
def db():
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()

@pytest.fixture
def client(db):
    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

@pytest.fixture
def admin_user(db):
    user = User(
        name="Admin Test",
        email="admin_test@example.com",
        password_hash=hash_password("Admin@123"),
        role="admin",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture
def creator_user(db):
    user = User(
        name="Creator Test",
        email="creator_test@example.com",
        password_hash=hash_password("Creator@123"),
        role="creator",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    profile = CreatorProfile(user_id=user.id, category="Instagram Reels", bio="Expert video creator", starting_price=5000)
    db.add(profile)
    db.commit()
    token = create_access_token({"sub": str(user.id)})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture
def other_creator_user(db):
    user = User(
        name="Other Creator",
        email="other_creator@example.com",
        password_hash=hash_password("Creator@123"),
        role="creator",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture
def client_user(db):
    user = User(
        name="Client Test",
        email="client_test@example.com",
        password_hash=hash_password("Client@123"),
        role="client",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture
def other_client_user(db):
    user = User(
        name="Other Client",
        email="other_client@example.com",
        password_hash=hash_password("Client@123"),
        role="client",
        is_active=True
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id)})
    return {"user": user, "token": token, "headers": {"Authorization": f"Bearer {token}"}}

@pytest.fixture
def assigned_order(db, client_user, creator_user):
    order = Order(
        client_id=client_user["user"].id,
        creator_id=creator_user["user"].id,
        title="AI Commercial Video",
        brief="Create a 30s product demo using RunwayML",
        budget=15000,
        status="in_progress"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order
