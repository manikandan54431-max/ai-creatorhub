"""
End-to-end test for the delivery approval bug fix.
Tests all 18 scenarios from the bug report.
"""
import sys, os, io, json, time, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import urllib.request, urllib.error

BASE = 'http://localhost:8000'
PASS = "\033[92m[PASS]\033[0m"
FAIL = "\033[91m[FAIL]\033[0m"
SKIP = "\033[93m[SKIP]\033[0m"
results = []

def log(label, passed, detail=""):
    tag = PASS if passed else FAIL
    print(f"{tag} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, passed))

def req(method, path, token=None, data=None, json_data=None, content_type='application/json'):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = None
    if json_data is not None:
        body = json.dumps(json_data).encode()
        headers['Content-Type'] = 'application/json'
    elif data is not None:
        body = data
        if content_type:
            headers['Content-Type'] = content_type
    r = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=8)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, {}

def login(email, password):
    status, body = req('POST', '/api/auth/login', json_data={'email': email, 'password': password})
    assert status == 200, f"Login failed for {email}: {status} {body}"
    return body['access_token'], body['user']

print("\n=== Setting up actors ===")
admin_tok, admin_user = login('admin@aicreatorhub.com', 'Admin@1234')
client_tok, client_user = login('aisha@example.com', 'Client@123')     # client for order #1
other_tok, other_user  = login('rohan@example.com', 'Client@123')      # unrelated client
creator_tok, creator_user = login('vikram@example.com', 'Creator@123') # creator for order #1

print(f"  Admin: {admin_user['name']}")
print(f"  Client (order #1): {client_user['name']} id={client_user['id']}")
print(f"  Other client: {other_user['name']} id={other_user['id']}")
print(f"  Creator: {creator_user['name']} id={creator_user['id']}")

print("\n=== Finding a fresh test order ===")
status, orders = req('GET', '/api/admin/orders', token=admin_tok)
test_order = None
for o in orders:
    if o['status'] in ('in_progress', 'accepted', 'assigned') and o.get('creator_id') == creator_user['id']:
        test_order = o
        break

if not test_order:
    print("  No suitable order found, creating one...")
    status, svcs = req('GET', f"/api/creators/services/{creator_user['id']}", token=client_tok)
    service_id = svcs[0]['id'] if status == 200 and svcs else None
    status, new_order = req('POST', '/api/orders', token=client_tok, json_data={
        'creator_id': creator_user['id'],
        'service_id': service_id,
        'title': 'E2E Delivery Test Order',
        'brief': 'Test order for delivery approval E2E test',
        'requirements': 'Test requirements',
        'budget': 5000,
        'deadline': '2026-12-31T00:00:00Z',
    })
    assert status == 200, f"Failed to create order: {new_order}"
    test_order = new_order
    req('PUT', f"/api/orders/{test_order['id']}/status", token=creator_tok, json_data={'status': 'in_progress'})
    test_order['status'] = 'in_progress'
    print(f"  Created test order #{test_order['id']}")

ORDER_ID = test_order['id']
print(f"  Using order #{ORDER_ID} status={test_order['status']!r} client_id={test_order.get('client_id')} creator_id={test_order.get('creator_id')}")

def make_minimal_mp4():
    ftyp = b'\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41'
    return ftyp + b'\x00' * (1024 - len(ftyp))

print(f"\n=== STEP 1: Creator uploads v1 to order #{ORDER_ID} ===")
import uuid
boundary = f'----FormBoundary{uuid.uuid4().hex}'
mp4_data = make_minimal_mp4()
filename = f'test_v1_{uuid.uuid4().hex[:6]}.mp4'

def build_multipart(fields, files, boundary):
    body = b''
    for name, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, (fname, fdata, mime) in files.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
        body += fdata + b'\r\n'
    body += f'--{boundary}--\r\n'.encode()
    return body

body = build_multipart(
    {'title': 'E2E Test Delivery v1', 'description': 'Test notes', 'submit_immediately': 'true'},
    {'video': (filename, mp4_data, 'video/mp4')},
    boundary
)

upload_headers = {
    'Authorization': f'Bearer {creator_tok}',
    'Content-Type': f'multipart/form-data; boundary={boundary}',
}
r = urllib.request.Request(f'{BASE}/api/orders/{ORDER_ID}/deliveries', data=body, headers=upload_headers, method='POST')
try:
    resp = urllib.request.urlopen(r, timeout=15)
    upload_resp = json.loads(resp.read().decode())
    DELIVERY_ID = upload_resp['id']
    log("1. Creator uploads v1 (submit_immediately=true)", True, f"delivery_id={DELIVERY_ID} status={upload_resp['status']!r}")
except urllib.error.HTTPError as e:
    err = e.read().decode()
    log("1. Creator uploads v1", False, f"HTTP {e.code}: {err[:200]}")
    print("FATAL: Cannot proceed without a delivery. Exiting.")
    sys.exit(1)

print("\n=== STEP 2: Client sees pending before approval ===")
status, approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
log("2. Before approval: client sees pending (empty list)", status == 200 and approved == [], f"got {approved}")

print("\n=== STEP 3: Client cannot access media before approval ===")
status, body = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=client_tok)
log("3. Client stream before approval returns 403", status == 403, f"got {status}")

print("\n=== STEP 4: Admin approves v1 ===")
status, approval = req('POST', f'/api/admin/video-approvals/{DELIVERY_ID}/approve',
                        token=admin_tok, json_data={'internal_notes': 'Looks great!'})
log("4. Admin approves v1", status == 200 and approval.get('status') == 'approved',
    f"HTTP {status} delivery.status={approval.get('status')!r}")

print("\n=== STEP 5: Verify DB records ===")
status, detail = req('GET', f'/api/admin/video-approvals/{DELIVERY_ID}', token=admin_tok)
delivery_ok = status == 200 and detail.get('status') == 'approved' and detail.get('approved_at') and detail.get('delivered_at')
log("5a. DB: delivery status=approved, approved_at set, delivered_at set", delivery_ok,
    f"status={detail.get('status')!r} approved_at={detail.get('approved_at')!r}")

status, order_now = req('GET', f'/api/orders/{ORDER_ID}', token=admin_tok)
order_delivered = status == 200 and order_now.get('status') == 'delivered'
log("5b. DB: order status advanced to 'delivered'", order_delivered,
    f"order.status={order_now.get('status')!r}")

print("\n=== STEP 6: Client delivery API ===")
status, approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
log("6. Client approved-deliveries endpoint returns v1", status == 200 and len(approved) == 1,
    f"HTTP {status} count={len(approved) if isinstance(approved, list) else 'N/A'}")

if isinstance(approved, list) and approved:
    d = approved[0]
    log("6a. Response has all required fields",
        all(k in d for k in ('id','order_id','title','version_number','status','approved_at','delivered_at')),
        f"fields present: {list(d.keys())}")
    log("6b. status=approved in response", d.get('status') == 'approved', f"status={d.get('status')!r}")
    log("6c. No storage_key exposed to client", 'storage_key' not in d, "")
    log("6d. No internal_admin_notes exposed", 'internal_admin_notes' not in d, "")

print("\n=== STEP 7-9: Stream and download ===")
status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=client_tok)
log("7-8. Playback: client can stream approved delivery", status == 200, f"HTTP {status}")

status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/download', token=client_tok)
log("9. Download: client can download approved delivery", status == 200, f"HTTP {status}")

print("\n=== STEP 10-11: Persistence (fresh login) ===")
fresh_tok, _ = login('aisha@example.com', 'Client@123')
status, fresh_approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=fresh_tok)
log("10-11. Fresh login: approved delivery still visible", status == 200 and len(fresh_approved) == 1,
    f"HTTP {status} count={len(fresh_approved) if isinstance(fresh_approved,list) else 'N/A'}")

print("\n=== STEP 12: Authorization — wrong client ===")
status, _ = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=other_tok)
log("12. Other client cannot access delivery", status in (403, 404), f"HTTP {status}")
status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=other_tok)
log("12b. Other client cannot stream file", status in (403, 404), f"HTTP {status}")

print("\n=== STEP 13: Authorization — wrong creator ===")
other_creator_tok, _ = login('priya@example.com', 'Creator@123')
status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=other_creator_tok)
log("13. Other creator cannot stream file", status in (403, 404), f"HTTP {status}")

print("\n=== STEP 14-16: Version 2 upload ===")
req('POST', f'/api/orders/{ORDER_ID}/revision', token=client_tok, json_data={'reason': 'E2E test revision'})

body2 = build_multipart(
    {'title': 'E2E Test Delivery v2', 'description': 'Test v2', 'submit_immediately': 'true'},
    {'video': (f'test_v2_{uuid.uuid4().hex[:6]}.mp4', mp4_data, 'video/mp4')},
    boundary
)
r2 = urllib.request.Request(f'{BASE}/api/orders/{ORDER_ID}/deliveries', data=body2, headers=upload_headers, method='POST')
try:
    resp2 = urllib.request.urlopen(r2, timeout=15)
    upload2 = json.loads(resp2.read().decode())
    DELIVERY2_ID = upload2['id']
    log("14. V2 upload succeeds", True, f"delivery_id={DELIVERY2_ID} status={upload2['status']!r}")
    log("15. V2 is NOT auto-approved (status=pending_review)", upload2['status'] == 'pending_review',
        f"status={upload2['status']!r}")

    status, still_approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
    log("16. V2 pending: client still sees v1 (v2 not exposed)", 
        status == 200 and len(still_approved) >= 1 and all(d['status'] == 'approved' for d in still_approved),
        f"count={len(still_approved) if isinstance(still_approved,list) else 'N/A'}")

    status, _ = req('GET', f'/api/deliveries/{DELIVERY2_ID}/stream', token=client_tok)
    log("16b. V2 stream blocked for client before approval", status in (403, 404), f"HTTP {status}")
except urllib.error.HTTPError as e:
    log("14. V2 upload", False, f"HTTP {e.code}: {e.read().decode()[:100]}")
    DELIVERY2_ID = None

print("\n=== STEP 17: Approval does not complete order ===")
status, order_check = req('GET', f'/api/orders/{ORDER_ID}', token=admin_tok)
log("17. Admin approval did not set order=completed", 
    order_check.get('status') != 'completed',
    f"order.status={order_check.get('status')!r}")

total = len(results)
passed = sum(1 for _, p in results if p)
failed = total - passed
print(f"\n{'='*60}")
print(f"RESULTS: {passed}/{total} passed, {failed} failed")
print('='*60)
if failed:
    print("\nFailed tests:")
    for name, p in results:
        if not p:
            print(f"  {FAIL} {name}")
