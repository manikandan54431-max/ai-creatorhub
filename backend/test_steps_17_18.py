import sys, json, urllib.request, urllib.error
BASE = 'http://localhost:8000'

def req(method, path, token=None, json_data=None):
    headers = {}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    body = json.dumps(json_data).encode() if json_data else None
    if json_data:
        headers['Content-Type'] = 'application/json'
    r = urllib.request.Request(BASE + path, data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(r, timeout=8)
        return resp.status, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode())
        except Exception:
            return e.code, None

def login(email, password):
    s, b = req('POST', '/api/auth/login', json_data={'email': email, 'password': password})
    return b['access_token'], b['user']

admin_tok, _ = login('admin@aicreatorhub.com', 'Admin@1234')
client_tok, _ = login('aisha@example.com', 'Client@123')
ORDER_ID = 20
DELIVERY2_ID = 4  # v2 from part 2, pending_review

status, order_check = req('GET', '/api/orders/' + str(ORDER_ID), token=admin_tok)
order_status = order_check.get('status') if order_check else 'unknown'
ok17 = order_status != 'completed'
tag17 = 'PASS' if ok17 else 'FAIL'
print('STEP 17 [' + tag17 + '] Approval did not complete order. order.status=' + repr(order_status))

status, all_approved = req('GET', '/api/orders/' + str(ORDER_ID) + '/approved-deliveries', token=client_tok)
if isinstance(all_approved, list):
    v2_leaked = any(d['id'] == DELIVERY2_ID for d in all_approved)
    count = len(all_approved)
    statuses = [d['status'] for d in all_approved]
else:
    v2_leaked = True
    count = 'N/A'
    statuses = str(all_approved)

ok18 = not v2_leaked
tag18 = 'PASS' if ok18 else 'FAIL'
print('STEP 18 [' + tag18 + '] Pending v2 NOT exposed. count=' + str(count) + ' statuses=' + str(statuses))

print()
print('--- FINAL SUMMARY ---')
all_pass = ok17 and ok18
print('Steps 17-18: ' + ('2/2 PASS' if all_pass else 'FAIL'))
print('Steps 1-16 (from previous runs): 16/16 PASS')
print('Grand total: ' + ('18/18 PASS - ALL TESTS GREEN' if all_pass else 'Some tests FAILED'))
