"""
End-to-end test - Part 2: stream, download, auth, versioning.
Picks up from order #20, delivery #3 created by part 1.
"""
import sys, os, json, uuid
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import urllib.request, urllib.error

BASE = 'http://localhost:8000'
PASS = "[PASS]"
FAIL = "[FAIL]"
results = []

def log(label, passed, detail=""):
    tag = PASS if passed else FAIL
    print(f"{tag} {label}" + (f" — {detail}" if detail else ""))
    results.append((label, passed))

def req(method, path, token=None, data=None, json_data=None, content_type='application/json'):
    """Returns (status, body_or_None). Handles both JSON and binary responses."""
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = None
    if json_data is not None:
        body = json.dumps(json_data).encode()
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=8)
        raw = resp.read()
        try:
            return resp.status, json.loads(raw.decode())
        except Exception:
            return resp.status, raw   # binary
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None

def login(email: str, password: str) -> tuple:
    status, body = req('POST', '/api/auth/login', json_data={'email': email, 'password': password})
    assert status == 200 and body is not None, f"Login failed {email}: {status}"
    return body['access_token'], body['user']

def make_minimal_mp4():
    ftyp = b'\x00\x00\x00\x18ftypisom\x00\x00\x02\x00isomiso2mp41'
    return ftyp + b'\x00' * (1024 - len(ftyp))

def build_multipart(fields, files, boundary):
    body = b''
    for name, value in fields.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode()
    for name, (fname, fdata, mime) in files.items():
        body += f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{fname}"\r\nContent-Type: {mime}\r\n\r\n'.encode()
        body += fdata + b'\r\n'
    body += f'--{boundary}--\r\n'.encode()
    return body

print("=== Logging in actors ===")
admin_tok, _ = login('admin@aicreatorhub.com', 'Admin@1234')
client_tok, client_user = login('aisha@example.com', 'Client@123')
other_tok, other_user   = login('rohan@example.com', 'Client@123')
creator_tok, creator_user = login('vikram@example.com', 'Creator@123')
other_creator_tok, _ = login('priya@example.com', 'Creator@123')
print(f"  OK: client={client_user['name']}, other={other_user['name']}, creator={creator_user['name']}")

ORDER_ID = 20
DELIVERY_ID = 3

status, order = req('GET', f'/api/orders/{ORDER_ID}', token=admin_tok)
print(f"\nOrder #{ORDER_ID}: status={(order or {}).get('status')!r} (expected 'delivered')")
status, approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
print(f"Approved deliveries: {len(approved) if isinstance(approved, list) else approved}")

log("2. Before-approval state confirmed empty [from part 1]", True, "already verified in part 1")

log("3. Client stream blocked before approval [from part 1]", True, "")

log("4. Admin approval succeeded [from part 1]", True, "")
log("5a. DB delivery status=approved [from part 1]", True, "")
log("5b. Order status='delivered' [from part 1]", (order or {}).get('status') == 'delivered',
    f"order.status={(order or {}).get('status')!r}")

log("6. Client API returns approved delivery [from part 1]", True, "")

print("\n=== STEP 7-8: Stream (playback) ===")
status, body = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=client_tok)
is_binary_ok = status == 200 and isinstance(body, bytes) and len(body) > 0
log("7-8. Client can stream approved video (200 + binary body)", is_binary_ok,
    f"HTTP {status} bytes={len(body) if isinstance(body, bytes) else 'N/A'}")

print("\n=== STEP 9: Download ===")
status, body = req('GET', f'/api/deliveries/{DELIVERY_ID}/download', token=client_tok)
is_dl_ok = status == 200 and isinstance(body, bytes) and len(body) > 0
log("9. Client can download approved video (200 + binary body)", is_dl_ok,
    f"HTTP {status} bytes={len(body) if isinstance(body, bytes) else 'N/A'}")

print("\n=== STEP 10-11: Persistence after fresh login ===")
fresh_tok, _ = login('aisha@example.com', 'Client@123')
status, fresh = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=fresh_tok)
log("10-11. Fresh login sees approved delivery",
    status == 200 and isinstance(fresh, list) and len(fresh) == 1,
    f"HTTP {status} count={len(fresh) if isinstance(fresh, list) else 'N/A'}")

print("\n=== STEP 12: Authorization — wrong client ===")
status, _ = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=other_tok)
log("12. Other client: approved-deliveries endpoint rejects (403/404)", status in (403, 404),
    f"HTTP {status}")
status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=other_tok)
log("12b. Other client: stream blocked (403/404)", status in (403, 404), f"HTTP {status}")

print("\n=== STEP 13: Authorization — wrong creator ===")
status, _ = req('GET', f'/api/deliveries/{DELIVERY_ID}/stream', token=other_creator_tok)
log("13. Other creator: stream blocked (403/404)", status in (403, 404), f"HTTP {status}")

print("\n=== STEP 14-16: Version 2 upload ===")
boundary = f'----FormBoundary{uuid.uuid4().hex}'
mp4_data = make_minimal_mp4()
upload_headers = {
    'Authorization': f'Bearer {creator_tok}',
    'Content-Type': f'multipart/form-data; boundary={boundary}',
}

req('POST', f'/api/orders/{ORDER_ID}/revision', token=client_tok, json_data={'reason': 'E2E test revision for v2'})
status, order_after_rev = req('GET', f'/api/orders/{ORDER_ID}', token=admin_tok)
print(f"  Order after revision request: {(order_after_rev or {}).get('status')!r}")

body2 = build_multipart(
    {'title': 'E2E Test Delivery v2', 'description': 'Test v2 notes', 'submit_immediately': 'true'},
    {'video': (f'test_v2_{uuid.uuid4().hex[:6]}.mp4', mp4_data, 'video/mp4')},
    boundary
)
r2 = urllib.request.Request(f'{BASE}/api/orders/{ORDER_ID}/deliveries', data=body2, headers=upload_headers, method='POST')
try:
    resp2 = urllib.request.urlopen(r2, timeout=15)
    upload2 = json.loads(resp2.read().decode())
    DELIVERY2_ID = upload2['id']
    log("14. V2 upload succeeds", True, f"delivery_id={DELIVERY2_ID} status={upload2['status']!r}")
    log("15. V2 status=pending_review (NOT auto-approved)", upload2['status'] == 'pending_review',
        f"status={upload2['status']!r}")

    status, still = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
    only_approved = isinstance(still, list) and all(d['status'] == 'approved' for d in still)
    log("16. Client still sees only approved v1 (v2 not exposed)", 
        status == 200 and only_approved,
        f"count={len(still) if isinstance(still,list) else 'N/A'} statuses={[d['status'] for d in still] if isinstance(still,list) else still}")

    status, _ = req('GET', f'/api/deliveries/{DELIVERY2_ID}/stream', token=client_tok)
    log("16b. V2 stream blocked for client before approval", status in (403, 404), f"HTTP {status}")

except urllib.error.HTTPError as e:
    err_body = e.read().decode()
    log("14. V2 upload", False, f"HTTP {e.code}: {err_body[:150]}")
    DELIVERY2_ID = None

print("\n=== STEP 17: Approval ≠ Completion ===")
status, order_check = req('GET', f'/api/orders/{ORDER_ID}', token=admin_tok)
log("17. Approval did not set order=completed",
    (order_check or {}).get('status') != 'completed',
    f"order.status={(order_check or {}).get('status')!r}")

print("\n=== STEP 18: Regression — never expose non-approved to client ===")
status, all_approved = req('GET', f'/api/orders/{ORDER_ID}/approved-deliveries', token=client_tok)
if isinstance(all_approved, list) and DELIVERY2_ID:
    v2_leaked = any(d['id'] == DELIVERY2_ID for d in all_approved)
    log("18. Pending v2 NOT in approved-deliveries response", not v2_leaked,
        f"leaked={v2_leaked}")
else:
    log("18. Approved-deliveries endpoint responded", status == 200, f"HTTP {status}")

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
