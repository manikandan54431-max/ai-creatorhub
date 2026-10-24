"""
P0 security regression tests
============================
Covers the access-control and payment fixes:
  - order status changes limited to participants + valid transitions
  - client approval only for delivered orders; creator stats counted once
  - link deliveries limited to valid states and http(s) URLs
  - payment amount enforced server-side; no double payment
  - payment verification requires ownership and, for Razorpay, a matching signature
  - Razorpay failures never produce a completed payment
  - chat REST + WebSocket limited to the chat's participants
  - production refuses insecure default settings
No real payment gateway or third-party API is contacted.
"""
import json
import sys
import types
from types import SimpleNamespace

import pytest
from sqlalchemy.orm import sessionmaker
from starlette.websockets import WebSocketDisconnect

from app.core.config import settings, Settings, validate_security_settings
from app.core.security import hash_password, create_access_token
from app.models.creator import CreatorProfile
from app.models.order import Order, Payment, Chat, Message
from app.models.user import User

def _make_order(db, client_user, creator_user, status, budget=15000):
    order = Order(
        client_id=client_user["user"].id,
        creator_id=creator_user["user"].id,
        title=f"Order ({status})",
        brief="Test brief",
        budget=budget,
        status=status,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@pytest.fixture
def pending_order(db, client_user, creator_user):
    return _make_order(db, client_user, creator_user, "pending")

@pytest.fixture
def delivered_order(db, client_user, creator_user):
    return _make_order(db, client_user, creator_user, "delivered")

@pytest.fixture
def chat(db, client_user, creator_user):
    c = Chat(client_id=client_user["user"].id, creator_id=creator_user["user"].id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

@pytest.fixture
def ws_sessions(db, monkeypatch):
    """The WebSocket handler opens its own SessionLocal; point it at the test connection."""
    from app.api import chats
    monkeypatch.setattr(chats, "SessionLocal", sessionmaker(bind=db.connection(), autoflush=False))

def _install_fake_razorpay(monkeypatch, fail_create=False, valid_signature=True, rp_order_id="order_RP123"):
    """Configure Razorpay with dummy credentials and a fake SDK (no network)."""
    def create(_params):
        if fail_create:
            raise RuntimeError("gateway down")
        return {"id": rp_order_id}

    def verify_payment_signature(_params):
        if not valid_signature:
            raise ValueError("signature mismatch")
        return True

    class Client:
        def __init__(self, auth):
            self.order = SimpleNamespace(create=create)
            self.utility = SimpleNamespace(verify_payment_signature=verify_payment_signature)

    fake = types.ModuleType("razorpay")
    fake.Client = Client
    monkeypatch.setitem(sys.modules, "razorpay", fake)
    monkeypatch.setattr(settings, "RAZORPAY_KEY_ID", "rzp_test_dummy")
    monkeypatch.setattr(settings, "RAZORPAY_KEY_SECRET", "dummy_secret")

def _pending_razorpay_payment(db, order, rp_order_id="order_RP123"):
    p = Payment(
        order_id=order.id, client_id=order.client_id, creator_id=order.creator_id,
        amount=order.budget, status="pending", payment_gateway="razorpay",
        transaction_id=rp_order_id,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p

class TestOrderStatusAccess:

    def test_unrelated_client_cannot_change_status(self, client, db, other_client_user, assigned_order):
        res = client.put(f"/api/orders/{assigned_order.id}/status",
                         headers=other_client_user["headers"], json={"status": "cancelled"})
        assert res.status_code == 403
        db.refresh(assigned_order)
        assert assigned_order.status == "in_progress"

    def test_unrelated_creator_cannot_change_status(self, client, db, other_creator_user, pending_order):
        res = client.put(f"/api/orders/{pending_order.id}/status",
                         headers=other_creator_user["headers"], json={"status": "accepted"})
        assert res.status_code == 403
        db.refresh(pending_order)
        assert pending_order.status == "pending"

    def test_client_cannot_self_complete_via_status(self, client, db, client_user, assigned_order):
        res = client.put(f"/api/orders/{assigned_order.id}/status",
                         headers=client_user["headers"], json={"status": "completed"})
        assert res.status_code == 400
        db.refresh(assigned_order)
        assert assigned_order.status == "in_progress"

    @pytest.mark.parametrize("target", ["delivered", "completed"])
    def test_creator_cannot_skip_review_via_status(self, client, db, creator_user, assigned_order, target):
        res = client.put(f"/api/orders/{assigned_order.id}/status",
                         headers=creator_user["headers"], json={"status": target})
        assert res.status_code == 400
        db.refresh(assigned_order)
        assert assigned_order.status == "in_progress"

    def test_creator_accept_then_start_still_works(self, client, db, creator_user, pending_order):
        r1 = client.put(f"/api/orders/{pending_order.id}/status",
                        headers=creator_user["headers"], json={"status": "accepted"})
        assert r1.status_code == 200, r1.text
        r2 = client.put(f"/api/orders/{pending_order.id}/status",
                        headers=creator_user["headers"], json={"status": "in_progress"})
        assert r2.status_code == 200, r2.text
        db.refresh(pending_order)
        assert pending_order.status == "in_progress"

    def test_client_can_cancel_pending_order(self, client, db, client_user, pending_order):
        res = client.put(f"/api/orders/{pending_order.id}/status",
                         headers=client_user["headers"], json={"status": "cancelled"})
        assert res.status_code == 200, res.text

    def test_admin_can_still_set_any_status(self, client, db, admin_user, assigned_order):
        res = client.put(f"/api/orders/{assigned_order.id}/status",
                         headers=admin_user["headers"], json={"status": "cancelled"})
        assert res.status_code == 200, res.text

class TestOrderApprovalAndDelivery:

    def test_cannot_approve_undelivered_order(self, client, db, client_user, assigned_order):
        res = client.post(f"/api/orders/{assigned_order.id}/approve", headers=client_user["headers"])
        assert res.status_code == 400
        db.refresh(assigned_order)
        assert assigned_order.status == "in_progress"

    def test_approve_counts_creator_order_exactly_once(self, client, db, client_user, creator_user, delivered_order):
        profile = db.query(CreatorProfile).filter(CreatorProfile.user_id == creator_user["user"].id).first()
        before = profile.total_orders or 0

        r1 = client.post(f"/api/orders/{delivered_order.id}/approve", headers=client_user["headers"])
        assert r1.status_code == 200, r1.text
        r2 = client.post(f"/api/orders/{delivered_order.id}/approve", headers=client_user["headers"])
        assert r2.status_code == 400  # already completed

        db.refresh(profile)
        db.refresh(delivered_order)
        assert delivered_order.status == "completed"
        assert profile.total_orders == before + 1

    def test_other_client_cannot_approve(self, client, other_client_user, delivered_order):
        res = client.post(f"/api/orders/{delivered_order.id}/approve", headers=other_client_user["headers"])
        assert res.status_code == 404

    @pytest.mark.parametrize("url", ["javascript:alert(document.cookie)", "data:text/html,<script>x</script>", "ftp://x"])
    def test_link_delivery_rejects_non_http_urls(self, client, db, creator_user, assigned_order, url):
        res = client.post(f"/api/orders/{assigned_order.id}/delivery",
                          headers=creator_user["headers"], json={"delivery_url": url})
        assert res.status_code == 400
        db.refresh(assigned_order)
        assert assigned_order.status == "in_progress"
        assert assigned_order.delivery_url is None

    def test_link_delivery_rejected_before_order_accepted(self, client, creator_user, pending_order):
        res = client.post(f"/api/orders/{pending_order.id}/delivery",
                          headers=creator_user["headers"], json={"delivery_url": "https://drive.example.com/v"})
        assert res.status_code == 400

    def test_link_delivery_still_works_for_active_order(self, client, db, creator_user, assigned_order):
        res = client.post(f"/api/orders/{assigned_order.id}/delivery",
                          headers=creator_user["headers"], json={"delivery_url": "https://drive.example.com/v"})
        assert res.status_code == 200, res.text
        db.refresh(assigned_order)
        assert assigned_order.status == "delivered"

class TestPaymentValidation:

    def test_amount_must_match_order_budget(self, client, db, client_user, pending_order):
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": 1, "payment_gateway": "simulated",
        })
        assert res.status_code == 400
        assert db.query(Payment).filter(Payment.order_id == pending_order.id).count() == 0

    def test_payment_amount_comes_from_order(self, client, db, client_user, pending_order):
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "simulated",
        })
        assert res.status_code == 200, res.text
        payment = db.query(Payment).filter(Payment.order_id == pending_order.id).one()
        assert payment.amount == pending_order.budget
        assert payment.status == "completed"
        db.refresh(pending_order)
        assert pending_order.status == "accepted"

    def test_cannot_pay_twice(self, client, client_user, pending_order):
        body = {"order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "simulated"}
        assert client.post("/api/payments/create", headers=client_user["headers"], json=body).status_code == 200
        res = client.post("/api/payments/create", headers=client_user["headers"], json=body)
        assert res.status_code == 409

    def test_cannot_pay_for_cancelled_order(self, client, db, client_user, creator_user):
        order = _make_order(db, client_user, creator_user, "cancelled")
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": order.id, "amount": order.budget, "payment_gateway": "simulated",
        })
        assert res.status_code == 400

    def test_unknown_gateway_rejected(self, client, client_user, pending_order):
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "free-money",
        })
        assert res.status_code == 400

    def test_simulated_payments_can_be_disabled(self, client, db, client_user, pending_order, monkeypatch):
        monkeypatch.setattr(settings, "ALLOW_SIMULATED_PAYMENTS", False)
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "simulated",
        })
        assert res.status_code == 400
        assert db.query(Payment).filter(Payment.order_id == pending_order.id).count() == 0

    def test_razorpay_failure_does_not_complete_payment(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch, fail_create=True)
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "razorpay",
        })
        assert res.status_code == 502
        assert db.query(Payment).filter(Payment.order_id == pending_order.id,
                                        Payment.status == "completed").count() == 0
        db.refresh(pending_order)
        assert pending_order.status == "pending"

    def test_razorpay_create_returns_pending_payment(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch)
        res = client.post("/api/payments/create", headers=client_user["headers"], json={
            "order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "razorpay",
        })
        assert res.status_code == 200, res.text
        assert res.json()["razorpay_order_id"] == "order_RP123"
        payment = db.query(Payment).filter(Payment.order_id == pending_order.id).one()
        assert payment.status == "pending"

    def test_config_has_no_hardcoded_key(self, client):
        data = client.get("/api/payments/config").json()
        assert data["razorpay_key_id"] is None
        assert data["has_razorpay"] is False

class TestPaymentVerification:

    def test_other_client_cannot_verify(self, client, db, other_client_user, pending_order):
        payment = _pending_razorpay_payment(db, pending_order)
        res = client.post("/api/payments/verify", headers=other_client_user["headers"],
                          json={"order_id": pending_order.id})
        assert res.status_code == 403
        db.refresh(payment)
        assert payment.status == "pending"

    def test_creator_cannot_verify_clients_payment(self, client, db, creator_user, pending_order):
        payment = _pending_razorpay_payment(db, pending_order)
        res = client.post("/api/payments/verify", headers=creator_user["headers"],
                          json={"order_id": pending_order.id, "transaction_id": "TXN_FAKE"})
        assert res.status_code == 403
        db.refresh(payment)
        assert payment.status == "pending"

    def test_unsigned_verify_cannot_complete_razorpay_payment(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch)
        payment = _pending_razorpay_payment(db, pending_order)
        res = client.post("/api/payments/verify", headers=client_user["headers"],
                          json={"order_id": pending_order.id, "transaction_id": "TXN_FAKE"})
        assert res.status_code == 400
        db.refresh(payment)
        db.refresh(pending_order)
        assert payment.status == "pending"
        assert pending_order.status == "pending"

    def test_signature_for_another_razorpay_order_rejected(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch, valid_signature=True)
        payment = _pending_razorpay_payment(db, pending_order, rp_order_id="order_EXPENSIVE")
        res = client.post("/api/payments/verify", headers=client_user["headers"], json={
            "order_id": pending_order.id,
            "razorpay_order_id": "order_CHEAP",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": "sig",
        })
        assert res.status_code == 400
        db.refresh(payment)
        assert payment.status == "pending"

    def test_invalid_signature_rejected(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch, valid_signature=False)
        payment = _pending_razorpay_payment(db, pending_order)
        res = client.post("/api/payments/verify", headers=client_user["headers"], json={
            "order_id": pending_order.id,
            "razorpay_order_id": "order_RP123",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": "bad",
        })
        assert res.status_code == 400
        assert "dummy_secret" not in res.text
        db.refresh(payment)
        assert payment.status == "pending"

    def test_valid_signature_completes_payment(self, client, db, client_user, pending_order, monkeypatch):
        _install_fake_razorpay(monkeypatch, valid_signature=True)
        payment = _pending_razorpay_payment(db, pending_order)
        res = client.post("/api/payments/verify", headers=client_user["headers"], json={
            "order_id": pending_order.id,
            "razorpay_order_id": "order_RP123",
            "razorpay_payment_id": "pay_1",
            "razorpay_signature": "good",
        })
        assert res.status_code == 200, res.text
        db.refresh(payment)
        db.refresh(pending_order)
        assert payment.status == "completed"
        assert payment.transaction_id == "pay_1"
        assert pending_order.status == "accepted"

    def test_reverify_does_not_roll_back_order(self, client, db, client_user, pending_order):
        body = {"order_id": pending_order.id, "amount": pending_order.budget, "payment_gateway": "simulated"}
        assert client.post("/api/payments/create", headers=client_user["headers"], json=body).status_code == 200
        pending_order.status = "in_progress"
        db.commit()
        res = client.post("/api/payments/verify", headers=client_user["headers"],
                          json={"order_id": pending_order.id})
        assert res.status_code == 200
        db.refresh(pending_order)
        assert pending_order.status == "in_progress"

class TestChatRestAccess:

    def test_outsider_cannot_read_messages(self, client, other_client_user, chat):
        res = client.get(f"/api/chats/{chat.id}/messages", headers=other_client_user["headers"])
        assert res.status_code == 403

    def test_outsider_cannot_post_message(self, client, db, other_client_user, other_creator_user, chat):
        for outsider in (other_client_user, other_creator_user):
            res = client.post(f"/api/chats/{chat.id}/messages",
                              headers=outsider["headers"], json={"message": "injected"})
            assert res.status_code == 403
        assert db.query(Message).filter(Message.chat_id == chat.id).count() == 0

    def test_admin_can_read_but_not_post(self, client, db, admin_user, chat):
        assert client.get(f"/api/chats/{chat.id}/messages", headers=admin_user["headers"]).status_code == 200
        res = client.post(f"/api/chats/{chat.id}/messages",
                          headers=admin_user["headers"], json={"message": "hi"})
        assert res.status_code == 403

    def test_participant_can_still_post(self, client, db, client_user, creator_user, chat):
        res = client.post(f"/api/chats/{chat.id}/messages",
                          headers=client_user["headers"], json={"message": "hello"})
        assert res.status_code == 200, res.text
        assert res.json()["receiver_id"] == creator_user["user"].id

    def test_cannot_open_chat_with_non_creator(self, client, client_user, other_client_user, admin_user):
        for target in (other_client_user, admin_user):
            res = client.post(f"/api/chats/create/{target['user'].id}", headers=client_user["headers"])
            assert res.status_code == 404

    def test_can_open_chat_with_creator(self, client, client_user, other_creator_user):
        res = client.post(f"/api/chats/create/{other_creator_user['user'].id}", headers=client_user["headers"])
        assert res.status_code == 200, res.text

class TestChatWebSocketAccess:

    def _url(self, chat, token):
        return f"/api/chats/ws/{chat.id}?token={token}"

    def test_outsider_websocket_rejected(self, client, db, ws_sessions, other_client_user, chat):
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(self._url(chat, other_client_user["token"])) as ws:
                ws.send_text(json.dumps({"message": "spy"}))
                ws.receive_text()
        assert exc.value.code == 4003
        assert db.query(Message).filter(Message.chat_id == chat.id).count() == 0

    def test_missing_or_bad_token_rejected(self, client, ws_sessions, chat):
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(f"/api/chats/ws/{chat.id}"):
                pass
        assert exc.value.code == 4001
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(self._url(chat, "not-a-jwt")):
                pass
        assert exc.value.code == 4001

    def test_blocked_user_websocket_rejected(self, client, db, ws_sessions, client_user, chat):
        client_user["user"].is_blocked = True
        db.commit()
        with pytest.raises(WebSocketDisconnect) as exc:
            with client.websocket_connect(self._url(chat, client_user["token"])):
                pass
        assert exc.value.code == 4003

    def test_participant_websocket_send_works(self, client, db, ws_sessions, client_user, creator_user, chat):
        with client.websocket_connect(self._url(chat, client_user["token"])) as ws:
            ws.send_text("not json")  # ignored, must not kill the socket
            ws.send_text(json.dumps({"message": "hello over ws"}))
            data = json.loads(ws.receive_text())
        assert data["message"] == "hello over ws"
        assert data["receiver_id"] == creator_user["user"].id
        db.expire_all()
        assert db.query(Message).filter(Message.chat_id == chat.id).count() == 1

    def test_blocked_chat_websocket_does_not_store(self, client, db, ws_sessions, client_user, chat):
        chat.is_blocked = True
        db.commit()
        with client.websocket_connect(self._url(chat, client_user["token"])) as ws:
            ws.send_text(json.dumps({"message": "should not save"}))
            data = json.loads(ws.receive_text())
        assert data == {"error": "Chat is blocked"}
        db.expire_all()
        assert db.query(Message).filter(Message.chat_id == chat.id).count() == 0

class TestSecuritySettings:

    def _settings(self, **overrides):
        base = dict(
            SECRET_KEY="x" * 48,
            ADMIN_PASSWORD="A-long-unique-admin-pass!",
            ALLOW_SIMULATED_PAYMENTS=False,
            ENVIRONMENT="production",
        )
        base.update(overrides)
        return Settings(_env_file=None, **base)

    def test_production_with_strong_settings_starts(self):
        assert validate_security_settings(self._settings()) == []

    @pytest.mark.parametrize("override", [
        {"SECRET_KEY": "your-super-secret-key-change-in-production-min-32-chars"},
        {"SECRET_KEY": "k3y-Qz9"},
        {"ADMIN_PASSWORD": "Admin@1234"},
        {"ALLOW_SIMULATED_PAYMENTS": True},
    ])
    def test_production_refuses_insecure_defaults(self, override):
        with pytest.raises(RuntimeError) as exc:
            validate_security_settings(self._settings(**override))
        for value in override.values():
            if isinstance(value, str):
                assert value not in str(exc.value)

    def test_development_only_warns(self):
        problems = validate_security_settings(self._settings(ENVIRONMENT="development", ADMIN_PASSWORD="Admin@1234"))
        assert problems  # reported, but no exception
