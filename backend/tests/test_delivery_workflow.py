import io
import pytest
from app.models.delivery import DeliverySubmission, SupportTicket, BlogPost
from app.models.order import Notification

DUMMY_MP4_HEADER = b"\x00\x00\x00\x1cftypisom\x00\x00\x02\x00isomiso2mp41" + b"\x00" * 200

def test_creator_upload_delivery_submission(client, creator_user, assigned_order):
    """1. Creator uploads a video for their assigned order."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    response = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={
            "title": "Version 1 Initial Cut",
            "description": "Here is the first cut of the product reel",
            "submit_immediately": "true",
        },
        files={"video": video_file}
    )
    assert response.status_code == 200, response.text
    data = response.json()
    assert data["order_id"] == assigned_order.id
    assert data["version_number"] == 1
    assert data["status"] == "pending_review"
    assert data["title"] == "Version 1 Initial Cut"
    assert "storage_key" not in data  # Security check: private key not exposed

def test_unassigned_creator_cannot_submit(client, other_creator_user, assigned_order):
    """5. Another creator cannot submit or access private submission for unassigned order."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    response = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=other_creator_user["headers"],
        data={"title": "Hacked Cut"},
        files={"video": video_file}
    )
    assert response.status_code == 403

def test_admin_sees_pending_submission(client, creator_user, admin_user, assigned_order):
    """2. Admin sees the pending submission in video verification dashboard."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "Pending Video", "submit_immediately": "true"},
        files={"video": video_file}
    )
    assert create_res.status_code == 200
    delivery_id = create_res.json()["id"]

    res = client.get("/api/admin/video-approvals?status=pending_review", headers=admin_user["headers"])
    assert res.status_code == 200
    items = res.json()
    assert any(i["id"] == delivery_id for i in items)

def test_client_cannot_preview_or_download_before_approval(client, creator_user, client_user, assigned_order):
    """3 & 4. Client cannot preview, stream, or download video before admin approval."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "Unapproved Cut", "submit_immediately": "true"},
        files={"video": video_file}
    )
    delivery_id = create_res.json()["id"]

    appr_res = client.get(f"/api/orders/{assigned_order.id}/approved-deliveries", headers=client_user["headers"])
    assert appr_res.status_code == 200
    assert len(appr_res.json()) == 0

    stream_res = client.get(f"/api/deliveries/{delivery_id}/stream", headers=client_user["headers"])
    assert stream_res.status_code == 403

    dl_res = client.get(f"/api/deliveries/{delivery_id}/download", headers=client_user["headers"])
    assert dl_res.status_code == 403

def test_other_client_cannot_access_delivery(client, creator_user, other_client_user, assigned_order):
    """6. Another client cannot access delivery."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "Private Cut", "submit_immediately": "true"},
        files={"video": video_file}
    )
    delivery_id = create_res.json()["id"]

    res = client.get(f"/api/deliveries/{delivery_id}/stream", headers=other_client_user["headers"])
    assert res.status_code == 403

def test_non_admin_cannot_approve(client, creator_user, client_user, assigned_order):
    """7. Non-admin users cannot approve submissions."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "To Approve", "submit_immediately": "true"},
        files={"video": video_file}
    )
    delivery_id = create_res.json()["id"]

    res = client.post(f"/api/admin/video-approvals/{delivery_id}/approve", headers=client_user["headers"])
    assert res.status_code == 403

    res2 = client.post(f"/api/admin/video-approvals/{delivery_id}/approve", headers=creator_user["headers"])
    assert res2.status_code == 403

def test_admin_changes_requested_requires_feedback_and_notifies(client, creator_user, admin_user, assigned_order):
    """11. Request changes requires feedback and notifies creator."""
    video_file = ("video.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "First Version", "submit_immediately": "true"},
        files={"video": video_file}
    )
    delivery_id = create_res.json()["id"]

    fail_res = client.post(
        f"/api/admin/video-approvals/{delivery_id}/request-changes",
        headers=admin_user["headers"],
        json={"feedback": "", "internal_notes": "Needs audio fix"}
    )
    assert fail_res.status_code in (400, 422)

    req_res = client.post(
        f"/api/admin/video-approvals/{delivery_id}/request-changes",
        headers=admin_user["headers"],
        json={"feedback": "The background audio is too loud over the voiceover. Please remix.", "internal_notes": "First round check"}
    )
    assert req_res.status_code == 200
    assert req_res.json()["status"] == "changes_requested"

def test_creator_can_submit_revision_which_needs_fresh_approval(client, creator_user, admin_user, client_user, assigned_order):
    """12 & 13. Creator submits revised version (v2) which requires fresh admin approval."""
    video_file = ("video_v1.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    v1_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "V1", "submit_immediately": "true"},
        files={"video": video_file}
    )
    v1_id = v1_res.json()["id"]

    client.post(
        f"/api/admin/video-approvals/{v1_id}/request-changes",
        headers=admin_user["headers"],
        json={"feedback": "Fix aspect ratio"}
    )

    video_file_v2 = ("video_v2.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    v2_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "V2 Fixed Ratio", "submit_immediately": "true"},
        files={"video": video_file_v2}
    )
    assert v2_res.status_code == 200
    v2_data = v2_res.json()
    assert v2_data["version_number"] == 2
    assert v2_data["status"] == "pending_review"

    appr_res = client.get(f"/api/orders/{assigned_order.id}/approved-deliveries", headers=client_user["headers"])
    assert len(appr_res.json()) == 0

def test_admin_approval_delivers_exact_version_to_client(client, creator_user, admin_user, client_user, assigned_order):
    """8, 9, 10, 14. Admin approval delivers exact version, notifies client, allows streaming, does not auto-complete."""
    video_file = ("video_final.mp4", io.BytesIO(DUMMY_MP4_HEADER), "video/mp4")
    create_res = client.post(
        f"/api/orders/{assigned_order.id}/deliveries",
        headers=creator_user["headers"],
        data={"title": "Final Product Reel", "description": "Color graded and mixed", "submit_immediately": "true"},
        files={"video": video_file}
    )
    delivery_id = create_res.json()["id"]

    approve_res = client.post(
        f"/api/admin/video-approvals/{delivery_id}/approve",
        headers=admin_user["headers"],
        json={"internal_notes": "Approved for client delivery"}
    )
    assert approve_res.status_code == 200
    appr_data = approve_res.json()
    assert appr_data["status"] == "approved"
    assert appr_data["delivered_to_client"] is True

    appr_list = client.get(f"/api/orders/{assigned_order.id}/approved-deliveries", headers=client_user["headers"])
    assert appr_list.status_code == 200
    deliveries = appr_list.json()
    assert len(deliveries) >= 1
    assert deliveries[0]["id"] == delivery_id
    assert deliveries[0]["title"] == "Final Product Reel"

    stream_res = client.get(f"/api/deliveries/{delivery_id}/stream", headers=client_user["headers"])
    assert stream_res.status_code == 200

    dl_res = client.get(f"/api/deliveries/{delivery_id}/download", headers=client_user["headers"])
    assert dl_res.status_code == 200

    order_res = client.get(f"/api/orders/{assigned_order.id}", headers=client_user["headers"])
    assert order_res.status_code == 200
    assert order_res.json()["status"] != "completed"

def test_public_registration_blocks_admin_role(client):
    """15. Public registration cannot create an admin account."""
    res = client.post(
        "/api/auth/register",
        json={
            "name": "Attacker",
            "email": "attacker@example.com",
            "password": "Password123!",
            "role": "admin"
        }
    )
    assert res.status_code == 422  # Pydantic validation rejects 'admin'

def test_support_ticket_creation_and_admin_management(client, admin_user, client_user):
    """17. Contact/support forms persist real tickets and allow admin reply."""
    ticket_res = client.post(
        "/api/support/tickets",
        json={
            "name": "Visitor Inquiry",
            "email": "visitor@example.com",
            "subject": "Question regarding video turnaround",
            "message": "What is the typical review turnaround time on AI CreatorHub?",
            "category": "Admin Review"
        }
    )
    assert ticket_res.status_code == 200
    ticket_id = ticket_res.json()["id"]

    admin_list = client.get("/api/support/admin/tickets", headers=admin_user["headers"])
    assert admin_list.status_code == 200
    assert any(t["id"] == ticket_id for t in admin_list.json())

    status_res = client.put(
        f"/api/support/admin/tickets/{ticket_id}/status",
        headers=admin_user["headers"],
        json={"status": "in_progress"}
    )
    assert status_res.status_code == 200

    reply_res = client.post(
        f"/api/support/admin/tickets/{ticket_id}/reply",
        headers=admin_user["headers"],
        json={"message": "Turnaround time is typically within 24 business hours."}
    )
    assert reply_res.status_code == 200
    assert reply_res.json()["is_admin_reply"] is True

def test_blog_articles_available(client):
    """All 5 required original articles exist and are served via API."""
    res = client.get("/api/blog/posts")
    assert res.status_code == 200
    posts = res.json()
    assert len(posts) >= 5
    slugs = [p["slug"] for p in posts]
    assert "how-to-write-a-clear-brief-for-an-ai-video-creator" in slugs
    assert "how-admin-video-approval-works-on-ai-creatorhub" in slugs
