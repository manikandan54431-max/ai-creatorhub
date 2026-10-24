import io
import json
import pytest
from app.models.studio import StudioProject, StudioAsset, StudioRenderJob
from app.models.delivery import DeliverySubmission

DUMMY_MP4 = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41" + b"\x00" * 300
DUMMY_WEBM = b"\x1a\x45\xdf\xa3" + b"\x00" * 200

def test_creator_can_access_studio(client, creator_user):
    """1. Authenticated creator can access Studio projects list."""
    res = client.get("/api/creator/studio/projects", headers=creator_user["headers"])
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_client_denied_from_studio(client, client_user):
    """2. Client is forbidden from Studio projects list."""
    res = client.get("/api/creator/studio/projects", headers=client_user["headers"])
    assert res.status_code == 403

def test_admin_denied_from_studio(client, admin_user):
    """3. Admin is forbidden from creator Studio editing workspace."""
    res = client.get("/api/creator/studio/projects", headers=admin_user["headers"])
    assert res.status_code == 403

def test_guest_denied_from_studio(client):
    """4. Unauthenticated guest is denied."""
    res = client.get("/api/creator/studio/projects")
    assert res.status_code == 401

def test_create_and_manage_projects(client, creator_user, other_creator_user, assigned_order):
    """5, 6, 7. Project creation, order linking validation, and isolation."""
    res = client.post(
        "/api/creator/studio/projects",
        headers=creator_user["headers"],
        json={"title": "Draft Demo", "aspect_ratio": "16:9"}
    )
    assert res.status_code == 200
    p1 = res.json()
    assert p1["title"] == "Draft Demo"
    assert p1["order_id"] is None
    assert p1["revision_number"] == 1

    res2 = client.post(
        "/api/creator/studio/projects",
        headers=creator_user["headers"],
        json={"title": "Client Ad", "order_id": assigned_order.id, "aspect_ratio": "9:16"}
    )
    assert res2.status_code == 200
    p2 = res2.json()
    assert p2["order_id"] == assigned_order.id

    res_fail = client.post(
        "/api/creator/studio/projects",
        headers=other_creator_user["headers"],
        json={"title": "Unauthorized Order Link", "order_id": assigned_order.id}
    )
    assert res_fail.status_code == 400

    res_iso = client.get(f"/api/creator/studio/projects/{p1['id']}", headers=other_creator_user["headers"])
    assert res_iso.status_code == 404

    timeline_data = {
        "clips": [{"id": "c1", "type": "video", "start": 0, "duration": 4.5}],
        "textOverlays": [{"id": "t1", "text": "Brand Headline", "startTime": 0, "endTime": 3}],
        "audioTracks": [],
        "captions": [{"id": "cap1", "text": "Intro voice", "startTime": 0, "endTime": 2.5}]
    }
    update_res = client.patch(
        f"/api/creator/studio/projects/{p1['id']}",
        headers=creator_user["headers"],
        json={"timeline_json": timeline_data, "duration": 4.5}
    )
    assert update_res.status_code == 200
    updated_p1 = update_res.json()
    assert updated_p1["revision_number"] == 2

    get_res = client.get(f"/api/creator/studio/projects/{p1['id']}", headers=creator_user["headers"])
    assert get_res.status_code == 200
    loaded_timeline = json.loads(get_res.json()["timeline_json"])
    assert len(loaded_timeline["clips"]) == 1
    assert loaded_timeline["clips"][0]["id"] == "c1"
    assert len(loaded_timeline["textOverlays"]) == 1

    dup_res = client.post(f"/api/creator/studio/projects/{p1['id']}/duplicate", headers=creator_user["headers"])
    assert dup_res.status_code == 200
    dup_p = dup_res.json()
    assert dup_p["id"] != p1["id"]
    assert "Copy" in dup_p["title"]

    del_res = client.delete(f"/api/creator/studio/projects/{p1['id']}", headers=creator_user["headers"])
    assert del_res.status_code == 200

    get_del = client.get(f"/api/creator/studio/projects/{p1['id']}", headers=creator_user["headers"])
    assert get_del.status_code == 404

def test_studio_assets_upload_and_stream(client, creator_user, other_creator_user, client_user):
    """8, 9, 10. Asset upload, storage key privacy, streaming access rules."""
    video_file = ("clip.mp4", io.BytesIO(DUMMY_MP4), "video/mp4")
    upload_res = client.post(
        "/api/creator/studio/assets",
        headers=creator_user["headers"],
        data={"media_type": "video"},
        files={"file": video_file}
    )
    assert upload_res.status_code == 200
    asset = upload_res.json()
    assert asset["original_filename"] == "clip.mp4"
    assert asset["media_type"] == "video"
    assert "storage_key" not in asset  # Storage key kept secret

    asset_id = asset["id"]

    stream_res = client.get(f"/api/creator/studio/assets/{asset_id}/stream", headers=creator_user["headers"])
    assert stream_res.status_code == 200

    client_stream = client.get(f"/api/creator/studio/assets/{asset_id}/stream", headers=client_user["headers"])
    assert client_stream.status_code == 403

    other_stream = client.get(f"/api/creator/studio/assets/{asset_id}/stream", headers=other_creator_user["headers"])
    assert other_stream.status_code == 404

    del_res = client.delete(f"/api/creator/studio/assets/{asset_id}", headers=creator_user["headers"])
    assert del_res.status_code == 200

def test_full_export_and_admin_approval_workflow(client, creator_user, admin_user, client_user, assigned_order):
    """14 to 24. Render export -> Review submission -> Admin review -> Client delivery access."""
    proj_res = client.post(
        "/api/creator/studio/projects",
        headers=creator_user["headers"],
        json={"title": "Studio Final Campaign", "order_id": assigned_order.id, "aspect_ratio": "16:9"}
    )
    assert proj_res.status_code == 200
    project_id = proj_res.json()["id"]

    job_res = client.post(
        "/api/creator/studio/render-jobs",
        headers=creator_user["headers"],
        json={"project_id": project_id}
    )
    assert job_res.status_code == 200
    job = job_res.json()
    job_id = job["id"]
    assert job["status"] == "rendering"

    sub_early = client.post(
        f"/api/creator/studio/render-jobs/{job_id}/submit-for-review",
        headers=creator_user["headers"],
        json={"title": "Premature submit"}
    )
    assert sub_early.status_code == 400

    render_blob = ("export.webm", io.BytesIO(DUMMY_WEBM), "video/webm")
    out_res = client.post(
        f"/api/creator/studio/render-jobs/{job_id}/upload-output",
        headers=creator_user["headers"],
        files={"file": render_blob}
    )
    assert out_res.status_code == 200
    completed_job = out_res.json()
    assert completed_job["status"] == "completed"
    assert completed_job["output_ready"] is True

    sub_res = client.post(
        f"/api/creator/studio/render-jobs/{job_id}/submit-for-review",
        headers=creator_user["headers"],
        json={"title": "Finished Cut v1", "description": "Exported from AI Studio"}
    )
    assert sub_res.status_code == 200
    sub_data = sub_res.json()
    delivery_id = sub_data["delivery_submission_id"]
    assert delivery_id is not None
    assert sub_data["status"] == "pending_review"

    sub_dup = client.post(
        f"/api/creator/studio/render-jobs/{job_id}/submit-for-review",
        headers=creator_user["headers"],
        json={"title": "Duplicate cut"}
    )
    assert sub_dup.status_code == 409

    client_view_pre = client.get(f"/api/orders/{assigned_order.id}/approved-deliveries", headers=client_user["headers"])
    assert client_view_pre.status_code == 200
    assert not any(d["id"] == delivery_id for d in client_view_pre.json())

    admin_view = client.get(f"/api/admin/video-approvals/{delivery_id}", headers=admin_user["headers"])
    assert admin_view.status_code == 200
    assert admin_view.json()["status"] == "pending_review"

    approve_res = client.post(
        f"/api/admin/video-approvals/{delivery_id}/approve",
        headers=admin_user["headers"],
        json={"internal_notes": "Studio export quality looks great"}
    )
    assert approve_res.status_code == 200
    assert approve_res.json()["status"] == "approved"

    client_view_post = client.get(f"/api/orders/{assigned_order.id}/approved-deliveries", headers=client_user["headers"])
    assert client_view_post.status_code == 200
    approved_list = client_view_post.json()
    assert any(d["id"] == delivery_id for d in approved_list)

    patch_res = client.patch(
        f"/api/creator/studio/projects/{project_id}",
        headers=creator_user["headers"],
        json={"title": "New Title Post Delivery"}
    )
    assert patch_res.status_code == 200

    job_check = client.get(f"/api/creator/studio/render-jobs/{job_id}", headers=creator_user["headers"])
    assert job_check.status_code == 200
    assert job_check.json()["delivery_submission_id"] == delivery_id

@pytest.mark.parametrize("path", [
    "/api/creator/studio/ai/script-assistant",
    "/api/creator/studio/ai/caption-hint",
    "/api/creator/studio/ai/voiceover-hint",
    "/api/creator/studio/ai/generate-image",
    "/api/creator/studio/ai/generate-video",
    "/api/creator/studio/ai/generation-config",
    "/api/ai/generate-bio",
    "/api/ai/generate-brief",
    "/api/ai/content-ideas",
    "/api/ai/portfolio-caption",
    "/api/ai/chat-assistant",
    "/api/helpbot/chat",
    "/api/helpbot/status",
    "/api/creator/ai-assistant/1",
    "/api/admin/settings/test-ai",
])
def test_ai_endpoints_are_gone(client, creator_user, path):
    """Every removed AI route must 404 for both GET and POST."""
    for call in (client.get, client.post):
        res = call(path, headers=creator_user["headers"])
        assert res.status_code == 404, f"{path} still reachable ({res.status_code})"

def test_studio_still_works_without_ai_config(client, creator_user):
    """The retained Studio API must function with no AI provider configured."""
    res = client.get("/api/creator/studio/projects", headers=creator_user["headers"])
    assert res.status_code == 200

    create = client.post(
        "/api/creator/studio/projects",
        headers=creator_user["headers"],
        json={"title": "No-AI Project", "aspect_ratio": "16:9"},
    )
    assert create.status_code in (200, 201)

def test_no_secrets_leak_from_studio_and_admin(client, creator_user, admin_user):
    """Retained endpoints must never echo secret configuration values."""
    from app.core.config import settings

    bodies = []
    for res in (
        client.get("/api/creator/studio/projects", headers=creator_user["headers"]),
        client.get("/api/admin/settings", headers=admin_user["headers"]),
    ):
        assert res.status_code == 200
        bodies.append(json.dumps(res.json()))
    raw_str = "".join(bodies)

    assert settings.SECRET_KEY not in raw_str
    for secret in (settings.RAZORPAY_KEY_SECRET, settings.STRIPE_SECRET_KEY):
        if secret:
            assert secret not in raw_str
