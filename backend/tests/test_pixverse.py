"""
Tests for the creator-only PixVerse AI Generator.

No real PixVerse calls are made — the service's HTTP seams and high-level
functions are monkeypatched. A successful HTTP 200 submission is deliberately
NOT treated as a completed generation anywhere in these tests.
"""
import pytest

from app.services import pixverse_service as pv
from app.workers import pixverse_worker as pvw
from app.models.pixverse_job import PixVerseJob
from app.models.studio import StudioProject, StudioAsset
from app.models.delivery import DeliverySubmission

GEN = "/api/creator/ai-generator"

# A minimal fake MP4: ftyp box header + padding so it passes the >1KB and
# not-JSON/HTML checks. media_probe returns has_video_track None (tolerated).
FAKE_MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 4096


@pytest.fixture(autouse=True)
def ensure_key(monkeypatch):
    """Most tests assume the provider is configured."""
    monkeypatch.setattr(pv.settings, "PIXVERSE_API_KEY", "sk-test-key")


def _patch_submit_ok(monkeypatch, counter=None):
    def fake_submit(**kwargs):
        if counter is not None:
            counter.append(1)
        return {"video_id": "999", "credits": 10}
    monkeypatch.setattr(pv, "submit_text_to_video", fake_submit)


# ─── 1. Role enforcement (server-side) ───────────────────────────────────────
def test_config_requires_creator(client, client_user, admin_user):
    assert client.get(f"{GEN}/config", headers=client_user["headers"]).status_code == 403
    assert client.get(f"{GEN}/config", headers=admin_user["headers"]).status_code == 403
    assert client.get(f"{GEN}/config").status_code in (401, 403)


def test_generate_denied_for_non_creators(client, client_user, admin_user, monkeypatch):
    _patch_submit_ok(monkeypatch)
    body = {"prompt": "a calm ocean at dawn"}
    assert client.post(f"{GEN}/generate", json=body, headers=client_user["headers"]).status_code == 403
    assert client.post(f"{GEN}/generate", json=body, headers=admin_user["headers"]).status_code == 403
    assert client.post(f"{GEN}/generate", json=body).status_code in (401, 403)


def test_creator_can_read_config(client, creator_user):
    r = client.get(f"{GEN}/config", headers=creator_user["headers"])
    assert r.status_code == 200
    data = r.json()
    assert data["available"] is True
    assert "720p" in data["supported_qualities"]
    assert "16:9" in data["supported_aspect_ratios"]
    # The API key must never be exposed anywhere in the config payload.
    assert "sk-test-key" not in r.text
    assert "api_key" not in r.text.lower()


# ─── 3. Validation ───────────────────────────────────────────────────────────
def test_prompt_and_settings_validation(client, creator_user, monkeypatch):
    _patch_submit_ok(monkeypatch)
    h = creator_user["headers"]
    assert client.post(f"{GEN}/generate", json={"prompt": "ab"}, headers=h).status_code in (400, 422)
    assert client.post(f"{GEN}/generate", json={"prompt": "valid prompt", "aspect_ratio": "7:7"}, headers=h).status_code == 400
    assert client.post(f"{GEN}/generate", json={"prompt": "valid prompt", "quality": "4320p"}, headers=h).status_code == 400
    assert client.post(f"{GEN}/generate", json={"prompt": "valid prompt", "duration": 99}, headers=h).status_code == 400


# ─── 5. Submission is not completion ─────────────────────────────────────────
def test_submission_not_mistaken_for_completion(client, creator_user, monkeypatch):
    _patch_submit_ok(monkeypatch)
    r = client.post(f"{GEN}/generate", json={"prompt": "a red kite in blue sky"}, headers=creator_user["headers"])
    assert r.status_code == 200
    job = r.json()["job"]
    assert job["status"] == "generating"       # NOT completed
    assert job["output_ready"] is False


# ─── 4. Duplicate submissions ────────────────────────────────────────────────
def test_duplicate_submit_is_deduplicated(client, creator_user, db, monkeypatch):
    calls = []
    _patch_submit_ok(monkeypatch, counter=calls)
    body = {"prompt": "identical prompt here", "aspect_ratio": "16:9", "quality": "540p", "duration": 5}
    r1 = client.post(f"{GEN}/generate", json=body, headers=creator_user["headers"])
    r2 = client.post(f"{GEN}/generate", json=body, headers=creator_user["headers"])
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json()["deduplicated"] is True
    assert r1.json()["job"]["id"] == r2.json()["job"]["id"]
    assert len(calls) == 1   # provider called only once
    assert db.query(PixVerseJob).filter(PixVerseJob.creator_id == creator_user["user"].id).count() == 1


# ─── 8. Missing key → honest unavailability ──────────────────────────────────
def test_unconfigured_shows_unavailable(client, creator_user, monkeypatch):
    monkeypatch.setattr(pv.settings, "PIXVERSE_API_KEY", None)
    assert client.get(f"{GEN}/config", headers=creator_user["headers"]).json()["available"] is False
    r = client.post(f"{GEN}/generate", json={"prompt": "something nice"}, headers=creator_user["headers"])
    assert r.status_code == 503


def test_provider_error_surfaces_safely(client, creator_user, monkeypatch):
    def boom(**kwargs):
        raise pv.PixVerseError("Unsupported generation setting: quality", code="400017")
    monkeypatch.setattr(pv, "submit_text_to_video", boom)
    r = client.post(f"{GEN}/generate", json={"prompt": "a prompt that is long enough"}, headers=creator_user["headers"])
    assert r.status_code == 400
    assert "sk-test-key" not in r.text


# ─── 2 & 11. Cross-creator isolation ─────────────────────────────────────────
def _make_job(client, headers, monkeypatch, prompt="unique isolation prompt"):
    _patch_submit_ok(monkeypatch)
    return client.post(f"{GEN}/generate", json={"prompt": prompt}, headers=headers).json()["job"]


def test_cross_creator_cannot_read_job(client, creator_user, other_creator_user, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch)
    r = client.get(f"{GEN}/jobs/{job['id']}", headers=other_creator_user["headers"])
    assert r.status_code == 404   # 404, not 403 — does not confirm existence


def test_cross_creator_cannot_stream_output(client, creator_user, other_creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch)
    # Force it complete with stored output.
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    _complete_job_via_worker(j, db, monkeypatch)
    # Owner can stream; other creator cannot; anon (no token) cannot.
    tok_a = creator_user["token"]
    tok_b = other_creator_user["token"]
    assert client.get(f"{GEN}/jobs/{job['id']}/stream?token={tok_a}").status_code == 200
    assert client.get(f"{GEN}/jobs/{job['id']}/stream?token={tok_b}").status_code == 404
    assert client.get(f"{GEN}/jobs/{job['id']}/stream").status_code == 401


# ─── 6 & 9. Worker: provider state mapping + private output storage ──────────
def _complete_job_via_worker(job, db, monkeypatch):
    monkeypatch.setattr(pv, "get_result", lambda **kw: {"status": 1, "url": "https://cdn.example/video.mp4"})
    monkeypatch.setattr(pv, "download_output", lambda url: (FAKE_MP4, "video/mp4"))
    pvw._process_job(job, db)


def test_worker_maps_generating(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch)
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    monkeypatch.setattr(pv, "get_result", lambda **kw: {"status": 5, "url": None})
    pvw._process_job(j, db)
    assert j.status == "generating"


def test_worker_completes_and_stores_privately(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch)
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    _complete_job_via_worker(j, db, monkeypatch)
    assert j.status == "completed"
    assert j.storage_key is not None
    assert j.output_file_size == len(FAKE_MP4)
    # Refresh-restore: API returns the persisted completed state.
    r = client.get(f"{GEN}/jobs/{job['id']}", headers=creator_user["headers"])
    assert r.json()["status"] == "completed" and r.json()["output_ready"] is True


def test_worker_moderation_and_failure(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch, prompt="moderation case prompt")
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    monkeypatch.setattr(pv, "get_result", lambda **kw: {"status": 7, "url": None})
    pvw._process_job(j, db)
    assert j.status == "failed" and j.error_code == "moderation"

    job2 = _make_job(client, creator_user["headers"], monkeypatch, prompt="server failure case prompt")
    j2 = db.query(PixVerseJob).filter(PixVerseJob.id == job2["id"]).first()
    monkeypatch.setattr(pv, "get_result", lambda **kw: {"status": 8, "url": None})
    pvw._process_job(j2, db)
    assert j2.status == "failed" and j2.error_code == "provider_failed"


# ─── 10. Output-save retry never regenerates ─────────────────────────────────
def test_retry_save_does_not_resubmit(client, creator_user, db, monkeypatch):
    submit_calls = []
    _patch_submit_ok(monkeypatch, counter=submit_calls)
    job = client.post(f"{GEN}/generate", json={"prompt": "download will fail first"}, headers=creator_user["headers"]).json()["job"]
    assert len(submit_calls) == 1

    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    # Provider says success, but download fails → job stuck in saving_output.
    monkeypatch.setattr(pv, "get_result", lambda **kw: {"status": 1, "url": "https://cdn.example/v.mp4"})
    def dl_fail(url):
        raise pv.PixVerseError("Could not download", code="download_failed", retryable=True)
    monkeypatch.setattr(pv, "download_output", dl_fail)
    pvw._process_job(j, db)
    assert j.status == "saving_output"

    # Creator triggers retry-save: must NOT call submit again.
    r = client.post(f"{GEN}/jobs/{job['id']}/retry-save", headers=creator_user["headers"])
    assert r.status_code == 200
    assert len(submit_calls) == 1  # still only the original submission

    # Now download succeeds on the next worker pass.
    monkeypatch.setattr(pv, "download_output", lambda url: (FAKE_MP4, "video/mp4"))
    pvw._process_job(j, db)
    assert j.status == "completed"
    assert len(submit_calls) == 1


# ─── 12. Studio import uses supported media/project shape ────────────────────
def test_open_in_studio_creates_project_and_asset(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch, prompt="studio import prompt")
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    _complete_job_via_worker(j, db, monkeypatch)

    r = client.post(f"{GEN}/jobs/{job['id']}/open-in-studio", headers=creator_user["headers"])
    assert r.status_code == 200
    pid, aid = r.json()["project_id"], r.json()["asset_id"]

    project = db.query(StudioProject).filter(StudioProject.id == pid).first()
    asset = db.query(StudioAsset).filter(StudioAsset.id == aid).first()
    assert project.creator_id == creator_user["user"].id
    assert asset.media_type == "video"          # correct shape for the editor
    assert asset.project_id == pid
    # storage_key must never be serialized to the client.
    assert asset.storage_key not in r.text


def test_save_to_media_is_idempotent(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch, prompt="idempotent save prompt")
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    _complete_job_via_worker(j, db, monkeypatch)
    a1 = client.post(f"{GEN}/jobs/{job['id']}/save-to-media", headers=creator_user["headers"]).json()["asset_id"]
    a2 = client.post(f"{GEN}/jobs/{job['id']}/save-to-media", headers=creator_user["headers"]).json()["asset_id"]
    assert a1 == a2  # same asset, not duplicated
    assert db.query(StudioAsset).filter(StudioAsset.creator_id == creator_user["user"].id).count() == 1


# ─── 13. Generation does not bypass delivery review ──────────────────────────
def test_generation_does_not_create_delivery(client, creator_user, db, monkeypatch):
    job = _make_job(client, creator_user["headers"], monkeypatch, prompt="no delivery prompt")
    j = db.query(PixVerseJob).filter(PixVerseJob.id == job["id"]).first()
    _complete_job_via_worker(j, db, monkeypatch)
    client.post(f"{GEN}/jobs/{job['id']}/open-in-studio", headers=creator_user["headers"])
    # Nothing here creates a delivery submission or approves anything.
    assert db.query(DeliverySubmission).count() == 0


# ─── Service-level: a 200 with non-zero ErrCode is a failure ─────────────────
def test_service_nonzero_errcode_is_failure(monkeypatch):
    class FakeResp:
        status_code = 200
        def json(self):
            return {"ErrCode": 400017, "ErrMsg": "Invalid parameter",
                    "Error": {"Type": "FIELD_VALUE_INVALID", "Message": "quality"}}
    monkeypatch.setattr(pv, "_post", lambda *a, **k: FakeResp())
    monkeypatch.setattr(pv.settings, "PIXVERSE_API_KEY", "sk-test-key")
    with pytest.raises(pv.PixVerseError):
        pv.submit_text_to_video(prompt="x", model="v5", aspect_ratio="16:9",
                                duration=5, quality="720p", seed=None, trace_id="t")


def test_service_download_rejects_non_video(monkeypatch):
    monkeypatch.setattr(pv.settings, "PIXVERSE_API_KEY", "sk-test-key")
    monkeypatch.setattr(pv, "download_output", lambda url: (b"<!DOCTYPE html><html></html>" + b" " * 2000, "text/html"))
    # The worker's validator must reject HTML masquerading as a video.
    with pytest.raises(pv.PixVerseError):
        pvw._validate_video(*pv.download_output("http://x"))
