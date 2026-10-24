"""
Admin action persistence tests (Issue 7).

Acceptance criterion: no action may merely change a button's appearance while
leaving the database unchanged. Each test therefore re-reads the row from the
database (and, where relevant, re-reads it through the API as a fresh request,
standing in for a refresh / re-login) after the action.

All fixtures are isolated test accounts; no production records are touched.
"""

import pytest

from app.models.creator import CreatorProfile
from app.models.order import Chat, Review
from app.models.user import User

@pytest.fixture
def creator_profile(db, creator_user):
    return db.query(CreatorProfile).filter(
        CreatorProfile.user_id == creator_user["user"].id
    ).first()

class TestVerifyPersists:
    def test_verify_persists_to_the_database(self, client, db, admin_user, creator_profile):
        assert creator_profile.is_verified in (False, None)

        res = client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": True},
            headers=admin_user["headers"],
        )
        assert res.status_code == 200
        assert res.json()["is_verified"] is True
        assert res.json()["changed"] is True

        db.expire_all()
        row = db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first()
        assert row.is_verified is True

    def test_verify_records_reviewer_and_timestamp(self, client, db, admin_user, creator_profile):
        client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": True},
            headers=admin_user["headers"],
        )
        db.expire_all()
        row = db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first()
        assert row.verified_at is not None
        assert row.verified_by == admin_user["user"].id

    def test_verification_survives_a_fresh_request(self, client, admin_user, creator_profile):
        """Stands in for 'still verified after refresh and re-login'."""
        client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": True},
            headers=admin_user["headers"],
        )
        listed = client.get("/api/admin/creators", headers=admin_user["headers"]).json()
        row = next(c for c in listed if c["id"] == creator_profile.id)
        assert row["is_verified"] is True
        assert row["verified_at"] is not None
        assert row["verified_by_name"] == admin_user["user"].name

    def test_verify_is_idempotent(self, client, db, admin_user, creator_profile):
        """The defect this guards: a repeated request used to flip the badge back."""
        url = f"/api/admin/creators/{creator_profile.id}/verify"
        first = client.put(url, json={"verified": True}, headers=admin_user["headers"])
        second = client.put(url, json={"verified": True}, headers=admin_user["headers"])
        third = client.put(url, json={"verified": True}, headers=admin_user["headers"])

        assert first.json()["changed"] is True
        assert second.json()["changed"] is False
        assert third.json()["changed"] is False
        for r in (first, second, third):
            assert r.json()["is_verified"] is True

        db.expire_all()
        row = db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first()
        assert row.is_verified is True

    def test_unverify_clears_the_audit_fields(self, client, db, admin_user, creator_profile):
        url = f"/api/admin/creators/{creator_profile.id}/verify"
        client.put(url, json={"verified": True}, headers=admin_user["headers"])
        res = client.put(url, json={"verified": False}, headers=admin_user["headers"])
        assert res.json()["is_verified"] is False

        db.expire_all()
        row = db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first()
        assert row.is_verified is False
        assert row.verified_at is None
        assert row.verified_by is None

    def test_omitted_body_still_toggles_for_backward_compatibility(self, client, admin_user, creator_profile):
        url = f"/api/admin/creators/{creator_profile.id}/verify"
        assert client.put(url, headers=admin_user["headers"]).json()["is_verified"] is True
        assert client.put(url, headers=admin_user["headers"]).json()["is_verified"] is False

    def test_non_boolean_verified_is_rejected(self, client, admin_user, creator_profile):
        res = client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": "yes"},
            headers=admin_user["headers"],
        )
        assert res.status_code == 400

    def test_unknown_creator_is_404(self, client, admin_user):
        res = client.put("/api/admin/creators/999999/verify", json={"verified": True},
                         headers=admin_user["headers"])
        assert res.status_code == 404

    def test_verify_requires_admin(self, client, creator_user, creator_profile):
        res = client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": True},
            headers=creator_user["headers"],
        )
        assert res.status_code == 403

    def test_verify_rejects_anonymous(self, client, creator_profile):
        res = client.put(f"/api/admin/creators/{creator_profile.id}/verify", json={"verified": True})
        assert res.status_code in (401, 403)

    def test_client_cannot_verify(self, client, client_user, creator_profile):
        res = client.put(
            f"/api/admin/creators/{creator_profile.id}/verify",
            json={"verified": True},
            headers=client_user["headers"],
        )
        assert res.status_code == 403

class TestApprovalActionsPersist:
    def test_approve_persists_and_is_idempotent(self, client, db, admin_user, creator_profile):
        url = f"/api/admin/creators/{creator_profile.id}/approve"
        first = client.put(url, headers=admin_user["headers"])
        assert first.status_code == 200
        assert first.json()["approval_status"] == "approved"
        assert first.json()["changed"] is True

        again = client.put(url, headers=admin_user["headers"])
        assert again.json()["changed"] is False

        db.expire_all()
        row = db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first()
        assert row.approval_status == "approved"

    def test_reject_persists(self, client, db, admin_user, creator_profile):
        res = client.put(f"/api/admin/creators/{creator_profile.id}/reject", headers=admin_user["headers"])
        assert res.json()["approval_status"] == "rejected"
        db.expire_all()
        assert db.query(CreatorProfile).filter(
            CreatorProfile.id == creator_profile.id
        ).first().approval_status == "rejected"

    def test_suspend_then_unsuspend_round_trips(self, client, db, admin_user, creator_profile):
        cid = creator_profile.id
        assert client.put(f"/api/admin/creators/{cid}/suspend",
                          headers=admin_user["headers"]).json()["approval_status"] == "suspended"
        db.expire_all()
        assert db.query(CreatorProfile).filter(CreatorProfile.id == cid).first().approval_status == "suspended"

        assert client.put(f"/api/admin/creators/{cid}/unsuspend",
                          headers=admin_user["headers"]).json()["approval_status"] == "approved"
        db.expire_all()
        assert db.query(CreatorProfile).filter(CreatorProfile.id == cid).first().approval_status == "approved"

    def test_unsuspend_rejects_a_creator_who_is_not_suspended(self, client, admin_user, creator_profile):
        res = client.put(f"/api/admin/creators/{creator_profile.id}/unsuspend", headers=admin_user["headers"])
        assert res.status_code == 400

    def test_feature_reports_the_resulting_state(self, client, db, admin_user, creator_profile):
        url = f"/api/admin/creators/{creator_profile.id}/feature"
        on = client.put(url, headers=admin_user["headers"]).json()
        assert on["is_featured"] is True
        db.expire_all()
        assert db.query(CreatorProfile).filter(CreatorProfile.id == creator_profile.id).first().is_featured is True

        off = client.put(url, headers=admin_user["headers"]).json()
        assert off["is_featured"] is False

    @pytest.mark.parametrize("action", ["approve", "reject", "suspend", "unsuspend", "feature"])
    def test_all_creator_actions_require_admin(self, client, creator_user, creator_profile, action):
        res = client.put(f"/api/admin/creators/{creator_profile.id}/{action}",
                         headers=creator_user["headers"])
        assert res.status_code == 403

class TestUserActionsPersist:
    def test_block_and_unblock_persist(self, client, db, admin_user, client_user):
        uid = client_user["user"].id
        client.put(f"/api/admin/users/{uid}/block", headers=admin_user["headers"])
        db.expire_all()
        assert db.query(User).filter(User.id == uid).first().is_blocked is True

        client.put(f"/api/admin/users/{uid}/unblock", headers=admin_user["headers"])
        db.expire_all()
        assert db.query(User).filter(User.id == uid).first().is_blocked is False

    def test_role_change_persists(self, client, db, admin_user, client_user):
        uid = client_user["user"].id
        res = client.put(f"/api/admin/users/{uid}/role", json={"role": "creator"},
                         headers=admin_user["headers"])
        assert res.status_code == 200
        db.expire_all()
        assert db.query(User).filter(User.id == uid).first().role == "creator"

    def test_block_requires_admin(self, client, creator_user, client_user):
        res = client.put(f"/api/admin/users/{client_user['user'].id}/block",
                         headers=creator_user["headers"])
        assert res.status_code == 403

class TestChatModerationPersists:
    @pytest.fixture
    def chat(self, db, client_user, creator_user):
        c = Chat(client_id=client_user["user"].id, creator_id=creator_user["user"].id,
                 last_message="hello")
        db.add(c)
        db.commit()
        db.refresh(c)
        return c

    def test_block_chat_persists_and_reports_state(self, client, db, admin_user, chat):
        res = client.put(f"/api/admin/chats/{chat.id}/block", headers=admin_user["headers"])
        assert res.status_code == 200
        assert res.json()["is_blocked"] is True

        db.expire_all()
        assert db.query(Chat).filter(Chat.id == chat.id).first().is_blocked is True

    def test_block_chat_requires_admin(self, client, creator_user, chat):
        res = client.put(f"/api/admin/chats/{chat.id}/block", headers=creator_user["headers"])
        assert res.status_code == 403

    def test_unknown_chat_is_404(self, client, admin_user):
        res = client.put("/api/admin/chats/999999/block", headers=admin_user["headers"])
        assert res.status_code == 404

class TestReviewActionsPersist:
    @pytest.fixture
    def review(self, db, assigned_order, client_user, creator_user):
        r = Review(order_id=assigned_order.id, client_id=client_user["user"].id,
                   creator_id=creator_user["user"].id, rating=4.0, comment="ok")
        db.add(r)
        db.commit()
        db.refresh(r)
        return r

    def test_hide_review_persists(self, client, db, admin_user, review):
        res = client.put(f"/api/admin/reviews/{review.id}/hide", headers=admin_user["headers"])
        assert res.status_code == 200
        db.expire_all()
        assert db.query(Review).filter(Review.id == review.id).first().is_hidden is True

    def test_delete_review_persists(self, client, db, admin_user, review):
        rid = review.id
        res = client.delete(f"/api/admin/reviews/{rid}", headers=admin_user["headers"])
        assert res.status_code == 200
        db.expire_all()
        assert db.query(Review).filter(Review.id == rid).first() is None

    def test_delete_review_requires_admin(self, client, creator_user, review):
        res = client.delete(f"/api/admin/reviews/{review.id}", headers=creator_user["headers"])
        assert res.status_code == 403
