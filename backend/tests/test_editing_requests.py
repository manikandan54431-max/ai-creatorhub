"""
Client media editing request tests (Issue 5).

Covers the client flow, backend validation, creator access boundaries, and the
integration with the existing order workflow.

Isolated test accounts only (Client A/B, Creator A/B, Admin); uploads are
redirected to a temp directory by the `isolated_uploads` fixture.
"""

import os
import struct

import pytest

from app.api import editing_requests as er
from app.models.creator import CreatorProfile
from app.models.editing_request import EditingRequest, EditingRequestMedia
from app.models.order import Order

@pytest.fixture(autouse=True)
def isolated_source_media(tmp_path, monkeypatch):
    """Keep source media out of the real private_uploads/ tree."""
    d = tmp_path / "private_uploads" / "editing_requests"
    d.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(er, "SOURCE_MEDIA_DIR", str(d))
    return d

def _box(t: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", len(payload) + 8) + t + payload

@pytest.fixture
def sample_mp4():
    """A minimal but structurally valid H.264 MP4 the probe accepts."""
    def hdlr(h):
        return _box(b"hdlr", b"\x00" * 8 + h + b"\x00" * 12)

    def tkhd(w, h):
        p = bytearray(84)
        p[-8:] = struct.pack(">II", w << 16, h << 16)
        return _box(b"tkhd", bytes(p))

    mdhd = _box(b"mdhd", b"\x00" * 4 + b"\x00" * 8 + struct.pack(">II", 1000, 4000) + b"\x00" * 4)
    stsd = _box(b"stsd", b"\x00" * 4 + struct.pack(">I", 1) + struct.pack(">I", 16) + b"avc1" + b"\x00" * 8)
    mdia = _box(b"mdia", mdhd + hdlr(b"vide") + _box(b"minf", _box(b"stbl", stsd)))
    trak = _box(b"trak", tkhd(1280, 720) + mdia)
    mvhd = _box(b"mvhd", b"\x00" * 4 + b"\x00" * 8 + struct.pack(">II", 1000, 4000) + b"\x00" * 80)
    return (_box(b"ftyp", b"isomiso2avc1mp41")
            + _box(b"moov", mvhd + trak)
            + _box(b"mdat", b"\x00" * 128))

@pytest.fixture
def sample_png():
    return (b"\x89PNG\r\n\x1a\n"
            + _box(b"IHDR", struct.pack(">IIBBBBB", 1, 1, 8, 2, 0, 0, 0))
            + _box(b"IDAT", b"\x08\x1d\x01\x02\x00\x00\x00")
            + _box(b"IEND", b""))

@pytest.fixture
def approved_creator(db, creator_user):
    profile = db.query(CreatorProfile).filter(
        CreatorProfile.user_id == creator_user["user"].id
    ).first()
    profile.approval_status = "approved"
    db.commit()
    return creator_user

def _create(client, headers, creator_id, files, **overrides):
    data = {
        "creator_id": str(creator_id),
        "title": "Edit my holiday footage",
        "instructions": "Please trim the dead air and colour grade it warmly.",
        "deliverable_type": "video",
    }
    data.update({k: str(v) for k, v in overrides.items()})
    return client.post("/api/editing-requests", data=data, files=files, headers=headers)

class TestClientCanCreateRequests:
    def test_creates_request_with_media_and_an_order(self, client, db, client_user, approved_creator, sample_mp4):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("holiday.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code == 201, res.text
        body = res.json()

        assert body["title"] == "Edit my holiday footage"
        assert body["media_count"] == 1
        assert body["media"][0]["media_type"] == "video"
        assert body["media"][0]["duration"] == 4
        assert body["media"][0]["width"] == 1280

        assert body["order_id"] is not None
        order = db.query(Order).filter(Order.id == body["order_id"]).first()
        assert order is not None
        assert order.client_id == client_user["user"].id
        assert order.creator_id == approved_creator["user"].id

    def test_a_new_request_does_not_imply_the_creator_accepted(self, client, client_user, approved_creator, sample_mp4):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        body = res.json()
        assert body["status"] == "pending_creator_response"
        assert body["responded_at"] is None

    def test_accepts_multiple_files_of_mixed_types(self, client, client_user, approved_creator, sample_mp4, sample_png):
        res = _create(client, client_user["headers"], approved_creator["user"].id, [
            ("files", ("clip.mp4", sample_mp4, "video/mp4")),
            ("files", ("still.png", sample_png, "image/png")),
        ], deliverable_type="both")
        assert res.status_code == 201
        kinds = sorted(m["media_type"] for m in res.json()["media"])
        assert kinds == ["image", "video"]

    def test_media_is_persisted_to_disk_not_a_browser_url(self, client, db, client_user, approved_creator, sample_mp4, isolated_source_media):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        media = db.query(EditingRequestMedia).filter(
            EditingRequestMedia.request_id == res.json()["id"]
        ).all()
        assert len(media) == 1
        stored = os.path.join(str(isolated_source_media), media[0].storage_key)
        assert os.path.exists(stored)
        assert os.path.getsize(stored) == len(sample_mp4)

    def test_request_history_is_listed_for_the_owner(self, client, client_user, approved_creator, sample_mp4):
        _create(client, client_user["headers"], approved_creator["user"].id,
                [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        res = client.get("/api/editing-requests/my", headers=client_user["headers"])
        assert res.status_code == 200
        assert len(res.json()) == 1
        assert res.json()[0]["status"] == "pending_creator_response"

    def test_storage_key_is_never_exposed(self, client, client_user, approved_creator, sample_mp4):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert "storage_key" not in res.json()["media"][0]

    def test_limits_endpoint_matches_server_enforcement(self, client, client_user):
        res = client.get("/api/editing-requests/config/limits", headers=client_user["headers"])
        assert res.status_code == 200
        assert res.json()["max_files_per_request"] == er.MAX_FILES_PER_REQUEST
        assert res.json()["max_file_mb"] == er.MAX_FILE_MB

class TestValidation:
    def test_instructions_are_required(self, client, client_user, approved_creator, sample_mp4):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))], instructions="nope")
        assert res.status_code == 400
        assert "instructions" in res.json()["detail"].lower()

    def test_at_least_one_file_is_required(self, client, client_user, approved_creator):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("", b"", "application/octet-stream"))])
        assert res.status_code in (400, 422)

    def test_rejects_a_disallowed_extension(self, client, client_user, approved_creator):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("virus.exe", b"MZ\x90\x00" + b"\x00" * 64, "application/octet-stream"))])
        assert res.status_code == 400
        assert "unsupported" in res.json()["detail"].lower()

    def test_rejects_content_that_does_not_match_its_extension(self, client, client_user, approved_creator):
        """A renamed text file must not get through on its extension alone."""
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("fake.mp4", b"this is plainly not a video file at all", "video/mp4"))])
        assert res.status_code == 400
        assert "does not look like" in res.json()["detail"].lower()

    def test_rejects_an_empty_file(self, client, client_user, approved_creator):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("empty.mp4", b"", "video/mp4"))])
        assert res.status_code in (400, 422)

    def test_rejects_too_many_files(self, client, client_user, approved_creator, sample_png):
        files = [("files", (f"p{i}.png", sample_png, "image/png"))
                 for i in range(er.MAX_FILES_PER_REQUEST + 1)]
        res = _create(client, client_user["headers"], approved_creator["user"].id, files)
        assert res.status_code == 400
        assert "at most" in res.json()["detail"].lower()

    def test_rejects_an_oversized_file(self, client, client_user, approved_creator, monkeypatch):
        monkeypatch.setattr(er, "MAX_FILE_BYTES", 1024)
        monkeypatch.setattr(er, "MAX_FILE_MB", 1)
        big = b"\x89PNG\r\n\x1a\n" + b"\x00" * 4096
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("big.png", big, "image/png"))])
        assert res.status_code == 413

    def test_rejects_an_unapproved_creator(self, client, db, client_user, creator_user, sample_mp4):
        profile = db.query(CreatorProfile).filter(
            CreatorProfile.user_id == creator_user["user"].id
        ).first()
        profile.approval_status = "pending"
        db.commit()

        res = _create(client, client_user["headers"], creator_user["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code == 400
        assert "not currently accepting work" in res.json()["detail"]

    def test_rejects_a_suspended_creator(self, client, db, client_user, creator_user, sample_mp4):
        profile = db.query(CreatorProfile).filter(
            CreatorProfile.user_id == creator_user["user"].id
        ).first()
        profile.approval_status = "suspended"
        db.commit()
        res = _create(client, client_user["headers"], creator_user["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code == 400

    def test_rejects_a_non_creator_target(self, client, client_user, other_client_user, sample_mp4):
        res = _create(client, client_user["headers"], other_client_user["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code == 400
        assert "does not exist" in res.json()["detail"]

    def test_rejects_an_invalid_deliverable_type(self, client, client_user, approved_creator, sample_mp4):
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))], deliverable_type="hologram")
        assert res.status_code == 400

    def test_a_rejected_request_leaves_nothing_behind(self, client, db, client_user, approved_creator, isolated_source_media):
        before = set(os.listdir(str(isolated_source_media)))
        res = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("fake.mp4", b"definitely not a video", "video/mp4"))])
        assert res.status_code == 400
        assert db.query(EditingRequest).count() == 0
        assert set(os.listdir(str(isolated_source_media))) == before

    def test_a_creator_cannot_create_a_request(self, client, approved_creator, sample_mp4):
        res = _create(client, approved_creator["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code == 403

    def test_anonymous_cannot_create_a_request(self, client, approved_creator, sample_mp4):
        res = client.post("/api/editing-requests",
                          data={"creator_id": str(approved_creator["user"].id),
                                "title": "x", "instructions": "a" * 20},
                          files=[("files", ("a.mp4", sample_mp4, "video/mp4"))])
        assert res.status_code in (401, 403)

class TestCreatorAccess:
    @pytest.fixture
    def request_id(self, client, client_user, approved_creator, sample_mp4):
        return _create(client, client_user["headers"], approved_creator["user"].id,
                       [("files", ("a.mp4", sample_mp4, "video/mp4"))]).json()["id"]

    def test_creator_sees_requests_addressed_to_them(self, client, approved_creator, request_id):
        res = client.get("/api/editing-requests/assigned", headers=approved_creator["headers"])
        assert res.status_code == 200
        assert [r["id"] for r in res.json()] == [request_id]

    def test_another_creator_sees_nothing(self, client, other_creator_user, request_id):
        """No endpoint hands a creator every client's media."""
        res = client.get("/api/editing-requests/assigned", headers=other_creator_user["headers"])
        assert res.status_code == 200
        assert res.json() == []

    def test_another_creator_cannot_read_the_request(self, client, other_creator_user, request_id):
        res = client.get(f"/api/editing-requests/{request_id}", headers=other_creator_user["headers"])
        assert res.status_code == 404

    def test_another_client_cannot_read_the_request(self, client, other_client_user, request_id):
        res = client.get(f"/api/editing-requests/{request_id}", headers=other_client_user["headers"])
        assert res.status_code == 404

    def test_admin_can_read_the_request(self, client, admin_user, request_id):
        res = client.get(f"/api/editing-requests/{request_id}", headers=admin_user["headers"])
        assert res.status_code == 200

    def test_creator_can_stream_the_source_media(self, client, approved_creator, request_id):
        media_id = client.get(f"/api/editing-requests/{request_id}",
                              headers=approved_creator["headers"]).json()["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{media_id}/stream",
                         headers=approved_creator["headers"])
        assert res.status_code == 200
        assert res.headers["content-type"] == "video/mp4"
        assert res.headers.get("content-disposition") == "inline"

    def test_creator_can_download_the_source_media(self, client, approved_creator, request_id):
        media_id = client.get(f"/api/editing-requests/{request_id}",
                              headers=approved_creator["headers"]).json()["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{media_id}/download",
                         headers=approved_creator["headers"])
        assert res.status_code == 200

    def test_unrelated_creator_cannot_stream_the_media(self, client, approved_creator, other_creator_user, request_id):
        media_id = client.get(f"/api/editing-requests/{request_id}",
                              headers=approved_creator["headers"]).json()["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{media_id}/stream",
                         headers=other_creator_user["headers"])
        assert res.status_code == 404

    def test_unrelated_client_cannot_stream_the_media(self, client, approved_creator, other_client_user, request_id):
        media_id = client.get(f"/api/editing-requests/{request_id}",
                              headers=approved_creator["headers"]).json()["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{media_id}/stream",
                         headers=other_client_user["headers"])
        assert res.status_code == 404

    def test_media_requires_authentication(self, client, approved_creator, request_id):
        media_id = client.get(f"/api/editing-requests/{request_id}",
                              headers=approved_creator["headers"]).json()["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{media_id}/stream")
        assert res.status_code in (401, 403)

    def test_media_ids_from_another_request_are_not_reachable(self, client, client_user, approved_creator, sample_mp4, request_id):
        other = _create(client, client_user["headers"], approved_creator["user"].id,
                        [("files", ("b.mp4", sample_mp4, "video/mp4"))]).json()
        foreign_media_id = other["media"][0]["id"]
        res = client.get(f"/api/editing-requests/{request_id}/media/{foreign_media_id}/stream",
                         headers=approved_creator["headers"])
        assert res.status_code == 404

class TestResponseFlow:
    @pytest.fixture
    def req(self, client, client_user, approved_creator, sample_mp4):
        return _create(client, client_user["headers"], approved_creator["user"].id,
                       [("files", ("a.mp4", sample_mp4, "video/mp4"))]).json()

    def test_accept_moves_the_order_into_the_existing_workflow(self, client, db, approved_creator, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": True}, headers=approved_creator["headers"])
        assert res.status_code == 200
        assert res.json()["status"] == "accepted"

        db.expire_all()
        order = db.query(Order).filter(Order.id == req["order_id"]).first()
        assert order.status == "accepted"

    def test_decline_requires_a_reason(self, client, approved_creator, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": False}, headers=approved_creator["headers"])
        assert res.status_code == 400
        assert "reason" in res.json()["detail"].lower()

    def test_decline_cancels_the_order_and_records_the_note(self, client, db, approved_creator, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": False, "note": "Outside my skill set"},
                          headers=approved_creator["headers"])
        assert res.status_code == 200
        assert res.json()["status"] == "declined"
        assert res.json()["creator_response_note"] == "Outside my skill set"

        db.expire_all()
        assert db.query(Order).filter(Order.id == req["order_id"]).first().status == "cancelled"

    def test_cannot_answer_twice(self, client, approved_creator, req):
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": False, "note": "changed my mind"},
                          headers=approved_creator["headers"])
        assert res.status_code == 400
        assert "already been answered" in res.json()["detail"]

    def test_another_creator_cannot_respond(self, client, other_creator_user, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": True}, headers=other_creator_user["headers"])
        assert res.status_code == 404

    def test_client_cannot_accept_on_the_creators_behalf(self, client, client_user, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": True}, headers=client_user["headers"])
        assert res.status_code == 403

    def test_accept_must_be_a_boolean(self, client, approved_creator, req):
        res = client.post(f"/api/editing-requests/{req['id']}/respond",
                          json={"accept": "yes"}, headers=approved_creator["headers"])
        assert res.status_code == 400

    def test_client_can_cancel_an_unanswered_request(self, client, db, client_user, req):
        res = client.post(f"/api/editing-requests/{req['id']}/cancel", headers=client_user["headers"])
        assert res.status_code == 200
        assert res.json()["status"] == "cancelled"
        db.expire_all()
        assert db.query(Order).filter(Order.id == req["order_id"]).first().status == "cancelled"

    def test_client_cannot_cancel_after_acceptance(self, client, client_user, approved_creator, req):
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])
        res = client.post(f"/api/editing-requests/{req['id']}/cancel", headers=client_user["headers"])
        assert res.status_code == 400

    def test_another_client_cannot_cancel(self, client, other_client_user, req):
        res = client.post(f"/api/editing-requests/{req['id']}/cancel",
                          headers=other_client_user["headers"])
        assert res.status_code == 404

    def test_declined_request_media_becomes_unavailable_to_the_creator(self, client, approved_creator, req):
        media_id = req["media"][0]["id"]
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": False, "note": "Not for me"},
                    headers=approved_creator["headers"])
        res = client.get(f"/api/editing-requests/{req['id']}/media/{media_id}/stream",
                         headers=approved_creator["headers"])
        assert res.status_code == 403

    def test_client_still_sees_their_own_media_after_a_decline(self, client, client_user, approved_creator, req):
        media_id = req["media"][0]["id"]
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": False, "note": "Not for me"},
                    headers=approved_creator["headers"])
        res = client.get(f"/api/editing-requests/{req['id']}/media/{media_id}/stream",
                         headers=client_user["headers"])
        assert res.status_code == 200

class TestDeliveryIntegration:
    def test_creator_delivers_through_the_existing_pipeline(self, client, db, client_user, approved_creator, sample_mp4):
        req = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))]).json()
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])

        res = client.post(
            f"/api/orders/{req['order_id']}/deliveries",
            data={"title": "Edited cut v1", "submit_immediately": "true"},
            files={"video": ("edited.mp4", sample_mp4, "video/mp4")},
            headers=approved_creator["headers"],
        )
        assert res.status_code == 200, res.text
        body = res.json()
        assert body["version_number"] == 1
        assert body["status"] == "pending_review"
        assert body["deliverable_kind"] == "video"
        assert body["review_due_at"] is not None

    def test_photo_deliverables_are_accepted_and_labelled(self, client, client_user, approved_creator, sample_mp4, sample_png):
        req = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))],
                      deliverable_type="photo").json()
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])

        res = client.post(
            f"/api/orders/{req['order_id']}/deliveries",
            data={"title": "Edited stills"},
            files={"video": ("still.png", sample_png, "image/png")},
            headers=approved_creator["headers"],
        )
        assert res.status_code == 200, res.text
        assert res.json()["deliverable_kind"] == "image"
        assert res.json()["detected_content_type"] == "image/png"

    def test_mismatched_extension_and_content_is_refused(self, client, client_user, approved_creator, sample_mp4, sample_png):
        req = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))]).json()
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])

        res = client.post(
            f"/api/orders/{req['order_id']}/deliveries",
            data={"title": "sneaky"},
            files={"video": ("image_named_as_video.mp4", sample_png, "video/mp4")},
            headers=approved_creator["headers"],
        )
        assert res.status_code == 400

    def test_a_creator_cannot_deliver_to_someone_elses_order(self, client, client_user, approved_creator, other_creator_user, sample_mp4):
        req = _create(client, client_user["headers"], approved_creator["user"].id,
                      [("files", ("a.mp4", sample_mp4, "video/mp4"))]).json()
        client.post(f"/api/editing-requests/{req['id']}/respond",
                    json={"accept": True}, headers=approved_creator["headers"])

        res = client.post(
            f"/api/orders/{req['order_id']}/deliveries",
            data={"title": "not mine"},
            files={"video": ("x.mp4", sample_mp4, "video/mp4")},
            headers=other_creator_user["headers"],
        )
        assert res.status_code == 403
