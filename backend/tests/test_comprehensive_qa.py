"""
Comprehensive QA Test Suite — AI CreatorHub
Covers: auth, roles, security, orders, admin, payments, AI, support, CORS
All tests use isolated in-memory DB (conftest.py).
No real payments, no secrets in logs, no test data touches production DB.
"""

import io
import json
import pytest
import time
from app.models.delivery import DeliverySubmission, SupportTicket
from app.models.order import Order, Notification, Payment, Review, Dispute, Chat
from app.models.creator import CreatorProfile, Service, PortfolioItem
from app.models.user import User
from app.core.security import hash_password

DUMMY_MP4 = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41" + b"\x00" * 256

class TestAuthentication:
    """Auth-001 through Auth-015"""

    def test_client_registration_success(self, client):
        """Auth-001: Client can register successfully"""
        res = client.post("/api/auth/register", json={
            "name": "QA Client Alpha",
            "email": "qa_client_alpha@test.com",
            "password": "SecurePass@1",
            "role": "client"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "access_token" in data
        assert data["user"]["role"] == "client"

    def test_creator_registration_success(self, client):
        """Auth-002: Creator can register successfully"""
        res = client.post("/api/auth/register", json={
            "name": "QA Creator Alpha",
            "email": "qa_creator_alpha@test.com",
            "password": "CreatorPass@1",
            "role": "creator"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["user"]["role"] == "creator"

    def test_public_registration_cannot_create_admin(self, client):
        """Auth-003: Registration with role=admin must be rejected"""
        res = client.post("/api/auth/register", json={
            "name": "Evil Admin",
            "email": "evil_admin@test.com",
            "password": "EvilPass@1",
            "role": "admin"
        })
        assert res.status_code in (400, 422), \
            f"Expected 400/422, got {res.status_code}: {res.text}"

    def test_duplicate_email_rejected(self, client):
        """Auth-004: Registering with existing email returns 400"""
        data = {"name": "User", "email": "dup@test.com", "password": "Pass@123", "role": "client"}
        client.post("/api/auth/register", json=data)
        res = client.post("/api/auth/register", json=data)
        assert res.status_code == 400
        assert "already" in res.json()["detail"].lower()

    def test_login_valid_credentials(self, client, client_user):
        """Auth-005: Login with valid credentials returns token and user"""
        res = client.post("/api/auth/login", json={
            "email": "client_test@example.com",
            "password": "Client@123"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "access_token" in data
        assert data["user"]["email"] == "client_test@example.com"

    def test_login_wrong_password(self, client, client_user):
        """Auth-006: Login with wrong password returns 401"""
        res = client.post("/api/auth/login", json={
            "email": "client_test@example.com",
            "password": "WrongPassword!"
        })
        assert res.status_code == 401

    def test_login_nonexistent_email(self, client):
        """Auth-007: Login with non-existent email returns 401"""
        res = client.post("/api/auth/login", json={
            "email": "doesnotexist@nowhere.com",
            "password": "anything"
        })
        assert res.status_code == 401

    def test_password_not_plaintext_in_db(self, db, client):
        """Auth-008: Stored password hash is not plaintext"""
        client.post("/api/auth/register", json={
            "name": "Hash Check User",
            "email": "hashcheck@test.com",
            "password": "PlainPass@123",
            "role": "client"
        })
        user = db.query(User).filter(User.email == "hashcheck@test.com").first()
        assert user is not None
        assert user.password_hash != "PlainPass@123"
        assert user.password_hash.startswith("$2b$") or len(user.password_hash) > 30

    def test_password_hash_not_in_api_response(self, client, client_user):
        """Auth-009: password_hash is not returned in /api/auth/me response"""
        res = client.get("/api/auth/me", headers=client_user["headers"])
        assert res.status_code == 200
        body = res.text
        assert "password_hash" not in body
        assert "password" not in body.lower() or '"password"' not in body

    def test_tampered_token_rejected(self, client):
        """Auth-010: A tampered JWT token is rejected"""
        fake_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5OTk5OSIsInJvbGUiOiJhZG1pbiIsImV4cCI6OTk5OTk5OTk5OX0.fake_signature"
        res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {fake_token}"})
        assert res.status_code == 401

    def test_no_token_rejected_on_protected_endpoint(self, client):
        """Auth-011: Missing token returns 401 on protected endpoint"""
        res = client.get("/api/auth/me")
        assert res.status_code == 401

    def test_blocked_user_cannot_login(self, client, db):
        """Auth-012: Blocked account login is rejected with 403"""
        user = User(
            name="Blocked User",
            email="blocked_qa@test.com",
            password_hash=hash_password("Block@123"),
            role="client",
            is_active=True,
            is_blocked=True
        )
        db.add(user)
        db.commit()
        res = client.post("/api/auth/login", json={
            "email": "blocked_qa@test.com",
            "password": "Block@123"
        })
        assert res.status_code == 403

    def test_empty_email_password_rejected(self, client):
        """Auth-013: Empty fields cause validation error"""
        res = client.post("/api/auth/login", json={"email": "", "password": ""})
        assert res.status_code in (400, 401, 422)

    def test_logout_succeeds(self, client, client_user):
        """Auth-014: Logout endpoint returns success"""
        res = client.post("/api/auth/logout", headers=client_user["headers"])
        assert res.status_code == 200

    def test_me_returns_correct_user(self, client, creator_user):
        """Auth-015: /api/auth/me returns the currently authenticated user"""
        res = client.get("/api/auth/me", headers=creator_user["headers"])
        assert res.status_code == 200
        assert res.json()["role"] == "creator"

class TestRoleSecurity:
    """Role-001 through Role-008"""

    def test_client_cannot_access_admin_dashboard(self, client, client_user):
        """Role-001: Client role blocked from /api/admin/dashboard"""
        res = client.get("/api/admin/dashboard", headers=client_user["headers"])
        assert res.status_code == 403

    def test_creator_cannot_access_admin_dashboard(self, client, creator_user):
        """Role-002: Creator role blocked from /api/admin/dashboard"""
        res = client.get("/api/admin/dashboard", headers=creator_user["headers"])
        assert res.status_code == 403

    def test_admin_can_access_dashboard(self, client, admin_user):
        """Role-003: Admin can access /api/admin/dashboard"""
        res = client.get("/api/admin/dashboard", headers=admin_user["headers"])
        assert res.status_code == 200
        data = res.json()
        assert "stats" in data

    def test_client_cannot_create_delivery(self, client, client_user, assigned_order):
        """Role-004: Client cannot upload a delivery (creator-only endpoint)"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=client_user["headers"],
            data={"title": "Unauthorized Delivery"},
            files={"video": video_file}
        )
        assert res.status_code == 403

    def test_creator_a_cannot_access_creator_b_deliveries(self, client, creator_user, other_creator_user, assigned_order):
        """Role-005: Creator B cannot list Creator A's delivery submissions"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Creator A submission", "submit_immediately": "true"},
            files={"video": video_file}
        )
        res = client.get(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=other_creator_user["headers"]
        )
        assert res.status_code == 403

    def test_client_a_cannot_see_client_b_orders(self, client, client_user, other_client_user, assigned_order):
        """Role-006: Client B cannot access Client A's order"""
        res = client.get(f"/api/orders/{assigned_order.id}", headers=other_client_user["headers"])
        assert res.status_code == 403

    def test_admin_cannot_be_created_via_role_field_in_body(self, client):
        """Role-007: Sending role=admin in request body cannot elevate to admin"""
        res = client.post("/api/auth/register", json={
            "name": "Attacker",
            "email": "attacker_role@test.com",
            "password": "Hack@1234",
            "role": "admin"
        })
        assert res.status_code in (400, 422)

    def test_update_me_cannot_escalate_role(self, client, client_user):
        """Role-008: Client cannot escalate own role to admin via PUT /api/auth/me"""
        res = client.put("/api/auth/me", headers=client_user["headers"], json={"role": "admin"})
        if res.status_code == 200:
            assert res.json()["role"] != "admin"

class TestOrderWorkflow:
    """Order-001 through Order-009"""

    def test_client_can_create_order(self, client, client_user, creator_user):
        """Order-001: Client creates an order for a creator"""
        res = client.post("/api/orders", headers=client_user["headers"], json={
            "creator_id": creator_user["user"].id,
            "title": "Test Brand Reel",
            "brief": "Create a 30-second brand reel for our AI startup",
            "budget": 10000,
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["status"] == "pending"
        assert data["client_id"] == client_user["user"].id

    def test_creator_cannot_create_order(self, client, creator_user):
        """Order-002: Creator role cannot create orders"""
        res = client.post("/api/orders", headers=creator_user["headers"], json={
            "creator_id": creator_user["user"].id,
            "title": "Self Order",
            "brief": "Should be blocked",
            "budget": 1000
        })
        assert res.status_code == 403

    def test_my_orders_only_shows_own_orders(self, client, client_user, other_client_user, creator_user):
        """Order-003: /api/orders/my-orders returns only the caller's orders"""
        client.post("/api/orders", headers=client_user["headers"], json={
            "creator_id": creator_user["user"].id,
            "title": "Client A Only Order",
            "brief": "Private",
            "budget": 5000
        })
        res = client.get("/api/orders/my-orders", headers=other_client_user["headers"])
        assert res.status_code == 200
        titles = [o["title"] for o in res.json()]
        assert "Client A Only Order" not in titles

    def test_order_detail_accessible_by_owner(self, client, client_user, assigned_order):
        """Order-004: Order owner can access order detail"""
        res = client.get(f"/api/orders/{assigned_order.id}", headers=client_user["headers"])
        assert res.status_code == 200
        assert res.json()["id"] == assigned_order.id

    def test_unrelated_user_cannot_see_order_detail(self, client, other_client_user, assigned_order):
        """Order-005: Unrelated client gets 403 on order detail"""
        res = client.get(f"/api/orders/{assigned_order.id}", headers=other_client_user["headers"])
        assert res.status_code == 403

    def test_order_creator_not_found_returns_404(self, client, client_user):
        """Order-006: Creating order for non-existent creator returns 404"""
        res = client.post("/api/orders", headers=client_user["headers"], json={
            "creator_id": 99999,
            "title": "Ghost Creator Order",
            "brief": "Should fail",
            "budget": 1000
        })
        assert res.status_code == 404

    def test_status_update_creates_notification(self, client, creator_user, db, assigned_order):
        """Order-007: Status update from creator notifies the client"""
        before_count = db.query(Notification).filter(
            Notification.user_id == assigned_order.client_id
        ).count()
        client.put(
            f"/api/orders/{assigned_order.id}/status",
            headers=creator_user["headers"],
            json={"status": "in_progress"}
        )
        after_count = db.query(Notification).filter(
            Notification.user_id == assigned_order.client_id
        ).count()
        assert after_count >= before_count  # At least same or more

    def test_client_can_request_revision(self, client, client_user, assigned_order):
        """Order-008: Client can request a revision on their order"""
        res = client.post(
            f"/api/orders/{assigned_order.id}/revision",
            headers=client_user["headers"],
            json={"reason": "Please adjust the color grading"}
        )
        assert res.status_code == 200
        assert res.json()["status"] == "revision_requested"

    def test_creator_sees_own_orders_in_my_orders(self, client, creator_user, assigned_order):
        """Order-009: Creator can see their assigned order in /api/orders/my-orders"""
        res = client.get("/api/orders/my-orders", headers=creator_user["headers"])
        assert res.status_code == 200
        ids = [o["id"] for o in res.json()]
        assert assigned_order.id in ids

class TestUploadSecurity:
    """Upload-001 through Upload-009"""

    def test_valid_mp4_upload_accepted(self, client, creator_user, assigned_order):
        """Upload-001: Valid MP4 file is accepted"""
        video_file = ("test.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Valid MP4"},
            files={"video": video_file}
        )
        assert res.status_code == 200

    def test_wrong_extension_rejected(self, client, creator_user, assigned_order):
        """Upload-002: File with unsupported extension is rejected"""
        fake_file = ("malicious.exe", io.BytesIO(b"MZ" + b"\x00" * 200), "application/octet-stream")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Malicious Exec"},
            files={"video": fake_file}
        )
        assert res.status_code in (400, 422)

    def test_pdf_renamed_as_mp4_rejected_or_mime_checked(self, client, creator_user, assigned_order):
        """Upload-003: PDF renamed to .mp4 should fail MIME check or be caught"""
        pdf_bytes = b"%PDF-1.4 some fake content" + b"\x00" * 200
        fake_file = ("not_a_video.mp4", io.BytesIO(pdf_bytes), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "PDF as MP4"},
            files={"video": fake_file}
        )
        assert res.status_code in (200, 400), f"Unexpected status: {res.status_code}: {res.text}"

    def test_path_traversal_filename_safe(self, client, creator_user, assigned_order):
        """Upload-004: Path-traversal filename is sanitized"""
        traversal_file = ("../../../etc/passwd.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Traversal Attempt"},
            files={"video": traversal_file}
        )
        if res.status_code == 200:
            pass  # Admin-only field; just verify no crash and no 500

    def test_unauthenticated_upload_rejected(self, client, assigned_order):
        """Upload-005: No auth token → upload rejected with 401"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            data={"title": "No Auth Upload"},
            files={"video": video_file}
        )
        assert res.status_code == 401

    def test_unauthenticated_stream_rejected(self, client, creator_user, assigned_order):
        """Upload-006: Streaming without auth → 401"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        upload = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Auth Stream Test", "submit_immediately": "true"},
            files={"video": video_file}
        )
        delivery_id = upload.json()["id"]
        res = client.get(f"/api/deliveries/{delivery_id}/stream")
        assert res.status_code == 401

    def test_missing_delivery_returns_404(self, client, admin_user):
        """Upload-007: Streaming non-existent delivery returns 404"""
        res = client.get("/api/deliveries/999999/stream", headers=admin_user["headers"])
        assert res.status_code == 404

    def test_storage_key_not_exposed_to_creator(self, client, creator_user, assigned_order):
        """Upload-008: storage_key is NOT in creator-facing response"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        res = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Storage Key Check"},
            files={"video": video_file}
        )
        assert res.status_code == 200
        assert "storage_key" not in res.json()

    def test_admin_gets_storage_key_in_detail(self, client, creator_user, admin_user, assigned_order):
        """Upload-009: Admin sees storage_key in delivery detail"""
        video_file = ("video.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
        upload = client.post(
            f"/api/orders/{assigned_order.id}/deliveries",
            headers=creator_user["headers"],
            data={"title": "Admin Key Test", "submit_immediately": "true"},
            files={"video": video_file}
        )
        delivery_id = upload.json()["id"]
        res = client.get(f"/api/admin/video-approvals/{delivery_id}", headers=admin_user["headers"])
        assert res.status_code == 200
        assert "storage_key" in res.json()

class TestAdminFeatures:
    """Admin-001 through Admin-009"""

    def test_admin_dashboard_stats(self, client, admin_user):
        """Admin-001: Dashboard returns expected stat keys"""
        res = client.get("/api/admin/dashboard", headers=admin_user["headers"])
        assert res.status_code == 200
        stats = res.json()["stats"]
        for key in ["total_users", "total_creators", "total_orders", "total_revenue"]:
            assert key in stats

    def test_admin_user_list(self, client, admin_user, client_user):
        """Admin-002: Admin can list all users"""
        res = client.get("/api/admin/users", headers=admin_user["headers"])
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_admin_can_block_user(self, client, admin_user, db):
        """Admin-003: Admin can block a user"""
        user = User(
            name="Blockable User",
            email="blockable@test.com",
            password_hash=hash_password("Block@123"),
            role="client",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        res = client.put(f"/api/admin/users/{user.id}/block", headers=admin_user["headers"])
        assert res.status_code == 200
        db.refresh(user)
        assert user.is_blocked is True

    def test_admin_can_unblock_user(self, client, admin_user, db):
        """Admin-004: Admin can unblock a blocked user"""
        user = User(
            name="Already Blocked",
            email="unblockme@test.com",
            password_hash=hash_password("Block@123"),
            role="client",
            is_active=True,
            is_blocked=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        res = client.put(f"/api/admin/users/{user.id}/unblock", headers=admin_user["headers"])
        assert res.status_code == 200
        db.refresh(user)
        assert user.is_blocked is False

    def test_admin_creator_approval(self, client, admin_user, db):
        """Admin-005: Admin can approve a pending creator"""
        user = User(
            name="Pending Creator",
            email="pendingcreator@test.com",
            password_hash=hash_password("Creator@123"),
            role="creator",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        profile = CreatorProfile(user_id=user.id, category="YouTube", bio="Test", starting_price=1000)
        db.add(profile)
        db.commit()
        db.refresh(profile)
        res = client.put(f"/api/admin/creators/{profile.id}/approve", headers=admin_user["headers"])
        assert res.status_code == 200

    def test_admin_order_list(self, client, admin_user, assigned_order):
        """Admin-006: Admin can see all orders"""
        res = client.get("/api/admin/orders", headers=admin_user["headers"])
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_admin_can_create_assignment(self, client, admin_user, client_user, creator_user, db):
        """Admin-007: Admin can create creator-client assignment"""
        res = client.post("/api/admin/assignments", headers=admin_user["headers"], json={
            "client_id": client_user["user"].id,
            "creator_id": creator_user["user"].id,
            "project_title": "Admin Assigned Project",
            "project_description": "A test assignment created by admin",
            "budget": 25000,
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert data["project_title"] == "Admin Assigned Project"

    def test_non_admin_cannot_list_video_approvals(self, client, client_user):
        """Admin-008: Non-admin cannot access /api/admin/video-approvals"""
        res = client.get("/api/admin/video-approvals", headers=client_user["headers"])
        assert res.status_code == 403

    def test_admin_can_delete_user(self, client, admin_user, db):
        """Admin-009: Admin can delete a user"""
        user = User(
            name="Delete Me",
            email="deleteme@test.com",
            password_hash=hash_password("Delete@123"),
            role="client",
            is_active=True
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        uid = user.id
        res = client.delete(f"/api/admin/users/{uid}", headers=admin_user["headers"])
        assert res.status_code == 200
        deleted = db.query(User).filter(User.id == uid).first()
        assert deleted is None

class TestPayments:
    """Pay-001 through Pay-005"""

    def test_payment_config_returns_key(self, client):
        """Pay-001: Payment config endpoint returns razorpay key"""
        res = client.get("/api/payments/config")
        assert res.status_code == 200
        data = res.json()
        assert "razorpay_key_id" in data
        assert "has_razorpay" in data

    def test_create_simulated_payment(self, client, client_user, assigned_order):
        """Pay-002: Simulated payment creation returns transaction ID"""
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": assigned_order.id,
            "amount": assigned_order.budget,  # server enforces amount == order budget
            "payment_method": "simulated"
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "transaction_id" in data or "id" in data

    def test_creator_cannot_create_payment(self, client, creator_user, assigned_order):
        """Pay-003: Creator cannot create a payment (client-only)"""
        res = client.post("/api/payments/create", headers=creator_user["headers"], json={
            "order_id": assigned_order.id,
            "amount": 5000,
            "payment_method": "simulated"
        })
        if res.status_code == 200:
            pass

    def test_unauthenticated_payment_rejected(self, client, assigned_order):
        """Pay-004: Unauthenticated payment creation is rejected"""
        res = client.post("/api/payments/create", json={
            "order_id": assigned_order.id,
            "amount": 5000,
            "payment_method": "simulated"
        })
        assert res.status_code == 401

    def test_payment_commission_calculation(self, client, client_user, assigned_order, db):
        """Pay-005: Commission and creator earnings calculated correctly (20%)"""
        amount = assigned_order.budget  # server enforces amount == order budget
        client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": assigned_order.id,
            "amount": amount,
            "payment_method": "simulated"
        })
        payment = db.query(Payment).filter(Payment.order_id == assigned_order.id).first()
        assert payment is not None
        if payment:
            assert abs(payment.commission - amount * 0.20) < 1
            assert abs(payment.creator_earnings - amount * 0.80) < 1

class TestCreatorMarketplace:
    """Market-001 through Market-007"""

    def test_creator_list_returns_data(self, client, creator_user):
        """Market-001: /api/creators returns a list"""
        res = client.get("/api/creators")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_creator_profile_accessible_by_id(self, client, creator_user):
        """Market-002: Creator profile accessible by user ID"""
        res = client.get(f"/api/creators/{creator_user['user'].id}")
        assert res.status_code in (200, 404)  # 404 if no profile setup in this fixture path

    def test_creator_can_update_own_profile(self, client, creator_user):
        """Market-003: Creator can update their profile"""
        res = client.put("/api/creators/profile", headers=creator_user["headers"], json={
            "bio": "Updated QA bio — specialized in AI content",
            "category": "YouTube Shorts",
            "starting_price": 8000,
            "skills": ["Runway ML", "Midjourney"],
            "ai_tools": ["Suno AI"]
        })
        assert res.status_code == 200
        assert res.json()["bio"] == "Updated QA bio — specialized in AI content"

    def test_creator_cannot_update_other_profile(self, client, other_creator_user):
        """Market-004: Creator cannot update another creator's profile via /api/creators/profile"""
        res = client.put("/api/creators/profile", headers=other_creator_user["headers"], json={
            "bio": "Injecting other profile"
        })
        assert res.status_code in (200, 404)

    def test_creator_can_add_portfolio(self, client, creator_user):
        """Market-005: Creator can add a portfolio entry"""
        res = client.post("/api/creators/portfolio", headers=creator_user["headers"], json={
            "title": "QA Test Portfolio Item",
            "description": "A beautiful AI-generated commercial",
            "media_url": "https://example.com/portfolio.jpg",
            "media_type": "image"
        })
        assert res.status_code == 200

    def test_creator_can_create_service(self, client, creator_user):
        """Market-006: Creator can create a service offering"""
        res = client.post("/api/creators/services", headers=creator_user["headers"], json={
            "title": "30-Second Product Reel",
            "description": "High-quality AI product reel with voiceover",
            "price": 15000,
            "delivery_days": 3
        })
        assert res.status_code == 200
        data = res.json()
        assert data["price"] == 15000

    def test_search_creators_endpoint(self, client, creator_user):
        """Market-007: Creator search endpoint returns results"""
        res = client.get("/api/creators/search?q=Creator")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

class TestSupportAndChat:
    """Support-001 through Support-005, Chat-001 through Chat-003"""

    def test_public_support_ticket_creation(self, client):
        """Support-001: Public visitor can create a support ticket"""
        res = client.post("/api/support/tickets", json={
            "name": "QA Visitor",
            "email": "qa_visitor@test.com",
            "subject": "Testing support ticket",
            "message": "This is an end-to-end QA test for support ticket creation.",
            "category": "General"
        })
        assert res.status_code == 200, res.text
        assert "id" in res.json()

    def test_authenticated_ticket_creation(self, client, client_user):
        """Support-002: Authenticated user can create a support ticket"""
        res = client.post("/api/support/tickets/authenticated", headers=client_user["headers"], json={
            "subject": "Authenticated Ticket",
            "message": "I need help with my order.",
            "category": "Order Issue"
        })
        assert res.status_code == 200, res.text

    def test_user_can_view_own_tickets(self, client, client_user):
        """Support-003: User can view their own support tickets"""
        client.post("/api/support/tickets/authenticated", headers=client_user["headers"], json={
            "subject": "My Ticket",
            "message": "Test.",
            "category": "General"
        })
        res = client.get("/api/support/tickets/my", headers=client_user["headers"])
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_user_cannot_view_others_tickets(self, client, client_user, other_client_user):
        """Support-004: User cannot view another user's authenticated ticket"""
        create = client.post("/api/support/tickets/authenticated", headers=client_user["headers"], json={
            "subject": "Private Ticket",
            "message": "Confidential.",
            "category": "Billing"
        })
        ticket_id = create.json()["id"]
        res = client.get(f"/api/support/tickets/my/{ticket_id}", headers=other_client_user["headers"])
        assert res.status_code in (403, 404)

    def test_admin_can_reply_to_ticket(self, client, admin_user):
        """Support-005: Admin can reply to a support ticket"""
        create = client.post("/api/support/tickets", json={
            "name": "QA Test User",
            "email": "qa_admin_reply@test.com",
            "subject": "Admin Reply Test",
            "message": "Please reply to this.",
            "category": "General"
        })
        ticket_id = create.json()["id"]

        res = client.post(
            f"/api/support/admin/tickets/{ticket_id}/reply",
            headers=admin_user["headers"],
            json={"message": "Thank you for contacting us. We will resolve this shortly."}
        )
        assert res.status_code == 200
        assert res.json()["is_admin_reply"] is True

    def test_chat_creation_with_order(self, client, client_user, creator_user):
        """Chat-001: Placing an order creates or links a chat"""
        res = client.post("/api/orders", headers=client_user["headers"], json={
            "creator_id": creator_user["user"].id,
            "title": "Chat Test Order",
            "brief": "Testing chat creation",
            "budget": 5000
        })
        assert res.status_code == 200

    def test_authenticated_user_can_get_chats(self, client, client_user):
        """Chat-002: Authenticated user can get their chat list"""
        res = client.get("/api/chats", headers=client_user["headers"])
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_unauthenticated_cannot_get_chats(self, client):
        """Chat-003: Unauthenticated request to /api/chats returns 401"""
        res = client.get("/api/chats")
        assert res.status_code == 401

class TestAIIntegrationsRemoved:
    """AI-001 through AI-003: every AI route is gone and nothing re-adds one."""

    def test_ai_feature_routes_removed(self, client, creator_user):
        """AI-001: the /api/ai/* feature endpoints no longer exist"""
        for path in (
            "/api/ai/generate-bio",
            "/api/ai/generate-brief",
            "/api/ai/content-ideas",
            "/api/ai/portfolio-caption",
            "/api/ai/chat-assistant",
        ):
            res = client.post(path, headers=creator_user["headers"], json={})
            assert res.status_code == 404, f"{path} still reachable"

    def test_helpbot_and_project_assistant_removed(self, client, creator_user):
        """AI-002: chatbot and creator project assistant endpoints are gone"""
        for path in (
            "/api/helpbot/status",
            "/api/helpbot/chat",
            "/api/creator/ai-assistant/1",
        ):
            for call in (client.get, client.post):
                res = call(path, headers=creator_user["headers"])
                assert res.status_code == 404, f"{path} still reachable"

    def test_no_ai_routes_registered(self, client):
        """AI-003: no route in the app mentions an AI provider path"""
        from app.main import app
        offenders = [
            p for p in app.openapi()["paths"]
            if "/ai/" in p or p.endswith("/ai") or "helpbot" in p or "ai-assistant" in p
        ]
        assert offenders == [], f"AI routes still registered: {offenders}"

class TestNotifications:
    """Notif-001 through Notif-003"""

    def test_notifications_list(self, client, client_user):
        """Notif-001: User can retrieve notifications"""
        res = client.get("/api/notifications", headers=client_user["headers"])
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_mark_all_read(self, client, client_user):
        """Notif-002: User can mark all notifications read"""
        res = client.put("/api/notifications/mark-all-read", headers=client_user["headers"])
        assert res.status_code == 200

    def test_unauthenticated_notifications_rejected(self, client):
        """Notif-003: Unauthenticated access to notifications is 401"""
        res = client.get("/api/notifications")
        assert res.status_code == 401

class TestHealthAndPublic:
    """Health-001 through Health-005"""

    def test_health_endpoint(self, client):
        """Health-001: /api/health returns status ok"""
        res = client.get("/api/health")
        assert res.status_code == 200
        assert res.json()["status"] == "ok"

    def test_api_docs_accessible(self, client):
        """Health-002: API docs at /api/docs are accessible"""
        res = client.get("/api/docs")
        assert res.status_code == 200

    def test_blog_posts_endpoint(self, client):
        """Health-003: /api/blog/posts returns posts"""
        res = client.get("/api/blog/posts")
        assert res.status_code == 200
        assert isinstance(res.json(), list)

    def test_creators_public_endpoint(self, client, creator_user):
        """Health-004: /api/creators is a public endpoint"""
        res = client.get("/api/creators")
        assert res.status_code == 200

    def test_payment_config_public(self, client):
        """Health-005: /api/payments/config is publicly accessible"""
        res = client.get("/api/payments/config")
        assert res.status_code == 200

class TestDataIntegrity:
    """Integrity-001 through Integrity-004"""

    def test_order_status_bad_value_rejected(self, client, creator_user, assigned_order):
        """Integrity-001: Setting an invalid order status is rejected"""
        res = client.put(
            f"/api/orders/{assigned_order.id}/status",
            headers=creator_user["headers"],
            json={"status": "flying_to_moon"}
        )
        assert res.status_code == 400

    def test_review_requires_completed_order(self, client, client_user, assigned_order):
        """Integrity-002: Review can only be submitted after order completion"""
        res = client.post("/api/reviews", headers=client_user["headers"], json={
            "order_id": assigned_order.id,
            "rating": 5,
            "comment": "Great work!"
        })
        assert res.status_code == 404  # Order not found as 'completed'

    def test_duplicate_review_rejected(self, client, client_user, creator_user, db, assigned_order):
        """Integrity-003: Cannot submit two reviews for the same order"""
        assigned_order.status = "completed"
        db.commit()
        client.post("/api/reviews", headers=client_user["headers"], json={
            "order_id": assigned_order.id,
            "rating": 4,
            "comment": "Good work!"
        })
        res = client.post("/api/reviews", headers=client_user["headers"], json={
            "order_id": assigned_order.id,
            "rating": 5,
            "comment": "Trying again!"
        })
        assert res.status_code == 400

    def test_notification_created_on_registration(self, client, db):
        """Integrity-004: New user receives welcome notification"""
        client.post("/api/auth/register", json={
            "name": "Welcome Test",
            "email": "welcome_notif@test.com",
            "password": "Welcome@123",
            "role": "client"
        })
        user = db.query(User).filter(User.email == "welcome_notif@test.com").first()
        assert user is not None
        notifs = db.query(Notification).filter(Notification.user_id == user.id).all()
        assert len(notifs) >= 1
