# FIXES — 8 Reported Issues

Work done 2026-10-24 against the live project. The repository is **not** under
git (`git status` → fatal), so there is no diff or stash to preserve and no
commits were made; all changes are in the working tree.

The backend was already running on port 8000 **without `--reload`**, so it was
left untouched and a separate instance was started on a spare port for live
verification, then stopped.

---

## Result summary

| # | Issue | Result |
|---|---|---|
| 1 | Uploaded video has a blank preview | **PASS** |
| 2 | Remove default admin assignment data | **PARTIAL — awaiting your approval to delete** |
| 3 | Admin chat monitor must use real chats | **PARTIAL — awaiting your approval to delete** |
| 4 | Weekly / monthly / yearly turnover | **PASS** |
| 5 | Client media editing requests | **PASS** |
| 6 | Display "-" instead of NaN | **PASS** |
| 7 | Verify and admin actions must persist | **PASS** |
| 8 | Video Studio back / dashboard navigation | **PASS — code complete, browser click-through NOT TESTED** |

Tests executed:

| Suite | Command | Result |
|---|---|---|
| Backend | `python -m pytest tests/ -q` | **291 passed, 0 failed** (was 170 before this work) |
| Frontend unit | `npm run test:unit` | **25 passed, 0 failed** |
| Frontend lint | `npx oxlint src/` | **0 errors** (warnings only, all pre-existing in kind) |
| Frontend build | `npm run build` | **PASSED** — 3030 modules |
| Live API | manual `curl` against a scratch backend | see each issue below |
| Playwright E2E | **NOT RUN — deliberately.** See "Why Playwright was not run". |

---

## Phase 1 — Inspection summary

| Thing | Finding |
|---|---|
| Backend | FastAPI 0.143.3 / Starlette 1.8.0, SQLAlchemy, SQLite `backend/creatorhub.db` |
| Frontend | React 18 + Vite, Zustand, axios, Recharts |
| Auth | JWT; `require_admin` / `require_role` on every admin route inspected |
| Media | Private disk storage under `private_uploads/`, authenticated stream endpoints |
| Currency | **Single currency (INR ₹)** — no currency column anywhere, so no mixed-currency risk |
| Tooling | `ffmpeg` / `ffprobe` are **not installed**; no JS unit-test runner was configured |
| Live rows at start | users 3, creator_profiles 1, orders 2, payments 2, assignments **35**, chats **35**, messages 0, delivery_submissions 9, studio_projects 19, studio_assets 7 |

### Media delivery was already working — so it was not the cause of Issue 1

Probed the real uploaded asset against a running backend:

```
GET /api/creator/studio/assets/6/stream?token=...
  200 · content-type: video/mp4 · accept-ranges: bytes · content-length: 2812016
  access-control-allow-origin: http://localhost:5173
GET (same) with  Range: bytes=0-1023
  206 Partial Content · content-range: bytes 0-1023/2812016
```

And the stored file is a valid, browser-playable MP4 — parsed its boxes
directly: `ftyp`/`moov`/`mdat` intact, **avc1 (H.264) + mp4a (AAC)**, 480×864,
11.76 s. Range requests, CORS and codec support were all fine from the start.

---

## ISSUE 1 — Uploaded video has a blank preview

**Status: FIXED · PASS**

**Reproduction:** Creator → Video Studio → open a project → Media tab → upload a
video → press Play. The timer counts 0.0 → 5.0 s while the preview stays black.

### Root cause — four separate defects, none of them the URL

1. **The playhead was a fake timer, decoupled from the video element.**
   `togglePlay()` ran `setInterval(... setCurrentTime(t => t + 0.1), 100)`, which
   advanced whether or not a video had loaded — so *the running timer was
   worthless as evidence of playback*. `videoRef.current.play().catch(() => {})`
   then swallowed every real failure silently.
2. **`computeTotalDuration` fabricated a 5-second timeline out of nothing** —
   `return Math.max(clipEnd, textEnd, 5)`. An empty project still reported 5 s,
   which is exactly the phantom playback being reported.
3. **Uploading an asset never put it on the timeline.** `handleUpload` only
   appended to the asset library; a clip existed only after a separate
   `addClipFromAsset` click, and nothing in the UI said so. Confirmed in the
   database: **all 19 of creator 17's studio projects had `clips: []`** while
   their uploaded assets were valid videos. `currentClip` was `undefined`, the
   `<video>` element was never rendered at all, and the black box was the empty
   container.
4. **No real media metadata, so durations were invented.** `upload_asset` never
   probed the file — `duration`, `width`, `height` were `NULL` for every row in
   `studio_assets`, so clips fell back to a hardcoded `duration: 10` for an
   11.76-second file.

Also fixed (latent, same area): `assetStreamUrl()` baked the current JWT into the
URL and that URL was persisted inside `timeline_json`, so after the 7-day token
expiry a saved project silently served 401s into the muted `.catch`.

### Fix applied

**Backend** — new `app/services/media_probe.py`, a dependency-free container
parser (no ffmpeg, which is not installed here):

* Reads duration, dimensions, track layout and codecs from MP4/ISO-BMFF, WebM
  and WAV headers.
* Returns `None` for anything it cannot read — **never a guess**. An unreadable
  header is explicitly *not* treated as an unplayable file.
* `upload_asset` now stores the real `duration` / `width` / `height`, verifies
  the bytes actually landed on disk, and **rejects with an honest message** a
  file with no video track ("upload it under Audio instead") or an undecodable
  codec ("re-export as H.264"). No extension is renamed to pretend a conversion
  happened.
* The stream endpoint now sends `Content-Disposition: inline` instead of
  `attachment`, which was wrong for a media source.

**Frontend** (`StudioEditorPage.jsx`):

* Uploads are added to the timeline automatically, so upload → visible picture
  is one step.
* Clip length comes from the probed duration; when unknown it is corrected from
  the element's own `onLoadedMetadata` — the only path that may set a duration
  not read from the file.
* The 5-second floor is gone. Play refuses to run on an empty timeline or a
  failed clip, and the clock stops if the video errors.
* The `<video>` element reports real state — loading, buffering, ready, error —
  with visible overlays and a Retry button. `MediaError` codes are translated
  into specific messages (corrupt file, unsupported codec, network). A video
  reporting `videoWidth === 0` is called out as audio-only.
* A status line under the controls shows the true pixel dimensions and clip
  length, so a running timer is no longer the only feedback.
* Media URLs are resolved from `assetId` at render time, never from the saved
  timeline; legacy clips keep working via a fallback.

### Test evidence

`tests/test_media_probe.py` — **22 passed**: real values read from built MP4/WAV
headers; unknown values stay `None`; truncated, tiny, empty and
hostile-box-size inputs degrade without raising; the probe never mutates input;
audio-only and `hvc1` uploads are refused with the reason and the fix named; an
unreadable header is still accepted; stream serves `inline` with
`accept-ranges`; cross-creator and cross-role stream access is refused.

Live upload of the real 2.8 MB H.264 file through the API:

```json
{ "duration": 11.765, "width": 480, "height": 864,
  "has_video_track": true, "video_codec": "avc1", "audio_codec": "mp4a",
  "probe_note": null }
```

Previously all three were `null` and the editor invented a 10-second clip.
Stream headers confirmed: `206 Partial Content`, `content-disposition: inline`,
`accept-ranges: bytes`.

**Remaining limitation:** the final visual confirmation — a human seeing moving
pictures in the browser — has not been done; see "What was not verified".

---

## ISSUE 2 — Remove default admin assignment data

**Status: PARTIAL — code fixed, deletion awaiting your approval**

### Root cause

*No hardcoded array existed in the frontend.* `AdminAssignments.jsx` already
loaded from `adminAPI.getAssignments()`, and the backend returned real rows. The
sample records are **real rows in the live database left behind by the Playwright
smoke tests** — `frontend/tests/03-creator-order.spec.js` posts
`project_title: 'PW Smoke: Smartwatch Ad'` straight at `http://localhost:8000`,
i.e. the development database.

* 35 of 35 `assignments` rows were titled `PW Smoke: AI Smartwatch Ad` or
  `PW Smoke: Smartwatch Ad`, all budget 5000, all status `assigned`.
* **All 35 had dangling foreign keys** — `client_id`/`creator_id` pointed at
  users 18–110 that no longer exist (only 1, 17, 18 remain).

Second, genuine frontend defect: `fetchData()` ended in `catch {}`, so **an API
failure rendered as the "No assignments yet" empty state**.

### Fix applied

* `AdminAssignments.jsx` now has three distinct states — loading skeletons, an
  **error state with a Retry button**, and an honest empty state that says there
  are no assignments *in the database*. An API failure can no longer masquerade
  as "no records".
* The client/creator pickers load together and surface their own failure with a
  retry, instead of silently rendering empty dropdowns. The placeholder reads
  "No eligible creators available" when the list really is empty.
* Status-advance buttons were unguarded `await`s; they now report failures.
* New `backend/report_test_residue.py` — **dry run by default**, nothing is
  deleted without `--delete --yes-i-am-sure`.

### Provenance rule, and a hazard the dry run caught

A row is classified as test residue only when **both** hold: its title matches a
known automated-test prefix (`PW Smoke:`), **and** its client/creator FK is
dangling. Requiring both means a genuine project can never be condemned by title
alone, and a real-but-orphaned record is never deleted just for being orphaned.
Anything matching one rule only is reported as "needs a human decision" and left
alone.

The first dry run **would have deleted orders 1 and 2** by following
`assignment.order_id`. Those are *genuine* orders belonging to live users 17 and
18 — and order 2 has a completed ₹100 payment against it. SQLite had reissued the
low primary keys of the deleted smoke orders to real orders created later. The
rule was tightened so each candidate order must clear the two-rule test on its
own; both are now reported as `PROTECTED (genuine - NOT deleted)`.

### Current dry-run report

```
-- ASSIGNMENTS --   total 35 · confirmed residue 35 · needs-decision 0
-- CHATS --         total 31 · confirmed residue 30 · needs-decision 1
-- ORDERS --        referenced 2 · confirmed residue 0 · PROTECTED 2
Rows that WOULD be deleted: 65   (assignments 35 | chats 30 | messages 0 | orders 0)
```

**Nothing has been deleted.** Run this when you are ready:

```
cd backend && python report_test_residue.py --delete --yes-i-am-sure
```

### One correction to report

While removing my own verification accounts, 4 Playwright smoke **chat** rows
were swept up as well: the throwaway accounts I created were assigned recycled
user IDs 19–22, which were the same dangling IDs those smoke chats referenced.
All 4 were already in the confirmed-residue set, had zero messages and dangling
FKs, so no genuine data was lost — but that is why the chat count reads 31 rather
than 35. Assignments are untouched at 35.

### Test-isolation defect worth fixing separately

The Playwright suite points at the live development database. That is the root
cause of this issue and it will recur on the next `npm test`. It should be given
a throwaway database (`DATABASE_URL`) or a cleanup fixture. Not changed here —
it is outside the eight issues.

---

## ISSUE 3 — Admin chat monitor must use real chats

**Status: PARTIAL — code fixed, deletion awaiting your approval**

### Root cause

Again no hardcoded conversations — `AdminChats.jsx` read `adminAPI.getChats()`
and the backend returned real rows. The defects were:

* **34 of 35 `chats` rows were Playwright smoke residue** with dangling
  `client_id`s, created as a side effect of the smoke assignments. Because
  `_format_chat_admin` does `c.client.name if c.client else ""`, they rendered as
  blank ↔ blank rows with 0 messages (the `messages` table is empty).
* `.catch(() => {})` meant **an API failure was indistinguishable from "no
  chats"**, and there was no empty state and no error state at all — the list
  simply rendered nothing.
* `openChat` and the block/flag handlers were unguarded `await`s: a failure threw
  an unhandled rejection while the optimistic local state still flipped, so the
  UI showed a change the database had not made.

### Fix applied

`AdminChats.jsx` rewritten:

* Separate loading / error-with-retry / empty states for the conversation list,
  and again for the message pane.
* The empty state explains that conversations appear as they start and offers
  Refresh — the existing refresh architecture, nothing fabricated.
* Block and flag now take the **resulting state from the server response**
  (`is_blocked` / `flagged`) instead of inverting a local copy; on failure
  nothing flips. `block_chat` was changed to return `is_blocked` for this.
* Blocking asks for confirmation and names both participants.
* A deleted participant renders as "Unknown client" rather than a blank.
* Still admin-only (`require_admin`), and no conversation is created by viewing.

### Test evidence

`test_admin_actions.py::TestChatModerationPersists` — block persists to the
database and returns the resulting state; non-admins get 403; unknown chat 404.
Normal client–creator messaging is untouched: the 291-test backend suite passes.

---

## ISSUE 4 — Weekly / monthly / yearly turnover

**Status: FIXED · PASS**

### Root cause

The feature did not exist. `GET /api/admin/payments` returned every payment row
unfiltered, and `AdminPayments.jsx` summed the whole list client-side. There were
no period controls anywhere.

### Conventions established before implementing

| Question | Answer in this codebase |
|---|---|
| Amount field | `Payment.amount` (Float, gross, INR) |
| Commission | `Payment.commission` (`PLATFORM_COMMISSION_PERCENT=20`) |
| Creator earnings | `Payment.creator_earnings` |
| Completion timestamp | **`Payment.created_at` only** — there is no `completed_at`/`paid_at` column. Documented as the turnover timestamp. |
| Completed status | `status == "completed"`; `pending`, `failed`, `cancelled`, `refunded` excluded |
| Refunds | `status == "refunded"` + a separate `refund_status`. **Reported separately, never netted off turnover.** |
| Currency | Single (INR). Mixed-currency totals are impossible. |
| Timezone | **There was none.** Added `REPORTING_TIMEZONE`, default `Asia/Kolkata` to match the INR billing currency. Stated as an assumption — change it in `backend/.env` if wrong. |

### Turnover definition (also returned in the API response and shown in the UI)

> Gross sum of `Payment.amount` for payments with `status='completed'` whose
> `created_at` falls in the selected period (inclusive start, exclusive end).
> Refunds are reported separately and are **not** deducted from turnover.

Platform commission, creator earnings, refunded amount and "net receipts after
refunds" are each shown as their own labelled figure. No accounting rule was
invented: because a refund carries no refund timestamp, netting it into a period
would misstate the books, so `net_after_refunds` is offered only as a clearly
named extra.

### Fix applied

New `backend/app/services/revenue.py` — the **single shared calculation and
filtering service**, so a summary card can never disagree with the rows beneath
it:

* `period_bounds()` resolves week/month/year to a half-open `[start, end)` UTC
  window. Local midnight in the reporting timezone is converted to UTC for the
  query. Month and year arithmetic is calendar-based, so month lengths, leap
  years and December→January all work.
* Weeks are explicit Monday-start ISO weeks.
* Sums are computed in SQL over the same filtered row set the list uses, with
  `Payment.id` as the only table — no joins, so no fan-out double counting.

Endpoints: `GET /api/admin/payments?period=&anchor=&status=` (list **plus** the
matching summary), `GET /api/admin/turnover`, `GET /api/admin/turnover/series`.

`AdminPayments.jsx` rebuilt with Weekly / Monthly / Yearly / All Time tabs plus a
period picker (date for the week, `<input type=month>`, a year dropdown), the
selected-period label, four separately-labelled summary cards, the turnover
definition in the footer, and loading / error-with-retry / empty states.

**Also fixed, same area:** the admin dashboard's 6-month revenue chart stepped
back in `timedelta(days=30*i)` jumps from today — not months, so the windows
drifted, overlapped and skipped days, and the chart disagreed with the payments
page. It now uses the same shared service.

### Test evidence

`tests/test_turnover.py` — **21 passed**, including every boundary the brief
asks for:

* a payment **exactly at the period start** → counted
* **one second before the exclusive end** → counted
* **exactly at the next period's boundary** → counted in the *next* period only
* one second before the start → previous period
* the three adjacent weeks sum to the full total — nothing lost, nothing counted twice
* pending / failed / cancelled excluded
* refunds reported separately, turnover stays gross, `net_after_refunds` correct
* commission and earnings never conflated with turnover
* an order with 3 delivery submissions does not multiply its payment
* leap February 2024 spans 29 days; December rolls into January
* empty period reports 0, not an error; a bad `anchor` is a 400; a bad `period` a 422
* non-admin 403, anonymous 401/403
* `test_payments_list_and_summary_agree` asserts the listed rows sum to the summary

Live check on real data: the ₹5000 **pending** payment is excluded and the ₹100
**completed** one counted, giving turnover ₹100 / commission ₹20 / earnings ₹80
across week, month and year.

---

## ISSUE 5 — Client media editing requests

**Status: FIXED · PASS**

### Root cause

The feature was absent. Clients had no upload path at all; the only upload
endpoints were creator-scoped and delivery-scoped.

### Design — integrated, not parallel

Creating a request also creates an **`Order`**. Acceptance, delivery submissions,
version history, revision requests, admin review, the eligible-release policy,
auto-release and final client acceptance are therefore the *existing* flows,
untouched. The new tables add only what the schema had no place for: the client's
source media and the editing brief.

### Fix applied

**Models** (`app/models/editing_request.py`): `EditingRequest` (brief, deliverable
type, format/aspect/duration, budget, deadline, status, creator response) and
`EditingRequestMedia` (media type, **private storage key**, filename, content
type, size, probed duration/dimensions).

**API** (`app/api/editing_requests.py`), 9 endpoints:

* `POST /api/editing-requests` — multipart, multiple files
* `GET /my`, `GET /assigned`, `GET /{id}`
* `POST /{id}/respond` (creator accept/decline), `POST /{id}/cancel` (client)
* `GET /{id}/media/{mid}/stream` and `/download`
* `GET /config/limits` — so the UI enforces the server's own numbers

**Validation, all server-side:**

* ownership and role; creator eligibility re-checked (`approval_status ==
  "approved"`, active, not blocked, not self)
* file type by **magic bytes, not filename** — a renamed text file is refused,
  and a video with a photo extension (or the reverse) is refused
* configured size and count limits (10 files, 500 MB each, 2 GB total)
* empty/incomplete uploads refused; bytes verified on disk after writing
* instructions required (minimum length), so a request is always actionable
* videos are probed and an audio-only or undecodable file is refused with the reason
* **a rejected request leaves nothing behind** — rows roll back and any written
  bytes are removed

**Honest status:** a new request is `pending_creator_response`, and both
notifications say so explicitly ("awaiting their response — they have not
accepted it yet"). Declining requires a reason, which the client sees.

**Access boundaries:** `GET /assigned` is scoped to the authenticated creator in
SQL — there is no endpoint that returns every client's media. A creator loses
media access once the request is declined or withdrawn, while the owning client
keeps it. Unauthorised readers get 404, not 403, so the endpoint does not confirm
another client's request exists. Storage keys are never serialised.

**Frontend:** `pages/client/EditingRequestsPage.jsx` (upload with local
thumbnails, progress, limits, per-field validation, request history with status,
withdraw) and `pages/creator/EditingRequestsPage.jsx` (incoming requests, the
brief, authorised previews and downloads of the source media, accept/decline, a
link into the order to deliver, and a Video Studio link). Routes and Navbar
entries added for both roles (desktop and mobile).

**Delivery (5D):** the existing pipeline was video-only
(`ALLOWED_MIME_TYPES` = mp4/webm/mov). It now also accepts `image/jpeg`,
`image/png`, `image/webp` under their own 50 MB ceiling, detects image magic
bytes, requires extension and content to agree, and exposes
`deliverable_kind: "image" | "video"` so a photo is **not** forced through a
video player. The auto-release worker and `release_delivery` were checked: they
only move status and timestamps, so they are already type-agnostic; their
notification wording is now type-aware. **No review or compliance step was
bypassed** — photo deliverables go through the same `pending_review` → admin
approval → release path, with the same 24-hour window.

### Test evidence

`tests/test_editing_requests.py` — **48 passed**, covering: creation with real
probed metadata; the owning order; `pending_creator_response` on creation;
multiple mixed-type files; persistence to disk (not a browser object URL);
storage keys never exposed; every validation rule above; the rollback leaving no
rows or files; creator-scoped listing (Creator B sees nothing); cross-role and
cross-request media access refused; accept/decline/cancel transitions and
idempotency; and delivery through the existing endpoint with
`deliverable_kind` correct for both video and photo.

Live end-to-end run against a scratch backend with isolated accounts:

```
request created           status = pending_creator_response, responded_at = None
creatorA assigned list    1 request    creatorB assigned list  0 requests
media stream  creatorA 200 · clientA 200 · creatorB 404 · clientB 404 · anon 401
creatorB respond -> 404   creatorA accept -> accepted
order #3 status           accepted
delivery submitted        v1 · pending_review · kind=video · review_due_at set
answering twice           400 "This request has already been answered"
database                  media dur 11s, 480x864, 2812016 bytes
```

Those verification rows were removed afterwards; see "Test data".

---

## ISSUE 6 — Display "-" instead of NaN

**Status: FIXED · PASS**

### Root cause — a field-name mismatch, found exactly

`_format_payment` emitted `commission` and emitted **no** `client_name` /
`creator_name`. `AdminPayments.jsx` read `p.platform_fee`, `p.client_name` and
`p.creator_name` — all three `undefined`:

```js
const totalRevenue = payments.filter(...).reduce((s, p) => s + p.platform_fee, 0)
//                                                           ^^^^^^^^^^^^^^^^ undefined
// 0 + undefined -> NaN -> Math.round(NaN).toLocaleString() -> "NaN"
```

Both the "Platform Revenue (20%)" and "Creator Earnings" cards rendered a literal
`NaN`, and the Client/Creator columns were blank. Other pages had the same shape
of bug: `Math.round(stats.earnings)` and `reduce((s, p) => s + p.amount, 0)`
produce `NaN` from one null, and `svc.price.toLocaleString()` **throws** on a
null price.

### Fix applied

**Backend:** `_format_payment` now emits `platform_fee` (keeping `commission` for
existing consumers), plus `client_name`, `creator_name`, `client_id`,
`creator_id`, `payment_gateway` and `refund_status`.

**Frontend:** new `src/utils/format.js`, with validation kept strictly separate
from formatting:

* `toFiniteNumber()` — validation. Returns a finite number or `null`. Rejects
  `null`, `undefined`, `NaN`, `±Infinity`, empty and whitespace-only strings,
  non-numeric strings, booleans, objects, arrays and functions. Deliberately
  never calls `Number()` on those, because `Number(true) === 1` and
  `Number([]) === 0`.
* `formatMoney()` / `formatNumber()` / `formatRating()` / `formatDate()` — render
  `-` for anything invalid.
* **A valid zero is preserved**: `0` renders `₹0` in the normal currency format.
  No truthiness checks, and nothing coerces null or empty into zero.
* `sumMoney()` / `sumField()` — aggregate without letting one bad record poison
  the total, and return `invalidCount` / `invalidIds` so the UI can **flag the
  data issue** instead of hiding it.
* `formatAggregate(value, available)` — an unavailable or failed total renders
  `-`, so it **cannot masquerade as zero**; a valid but empty dataset still
  gives ₹0.

Applied across every money display: the payments page and its summary cards and
transaction detail, admin dashboard cards and chart tooltips, admin orders,
creators (price, rating, order count), assignments, client and creator dashboards
and their chart tooltips, order detail and list, payments history, hire flow,
services, and the public creator pages. The Admin Payments page also shows an
explicit warning naming the payment IDs whose money values are unusable, stating
that the totals shown are incomplete.

No historical money record was rewritten.

### Test evidence

`frontend/tests/unit/format.test.js` — **25 passed** (`npm run test:unit`, using
the built-in `node:test`, so no new dependency). Covers valid amounts, Indian
digit grouping, large values up to `MAX_SAFE_INTEGER`, a preserved zero,
negatives, numeric strings, blanks, whitespace, non-numeric strings, `NaN`, both
infinities, booleans/arrays/objects/functions, bigint in and out of safe range,
aggregates with mixed bad entries, an empty dataset totalling zero, an
unavailable total rendering `-`, and invalid-record identification.

`test_turnover.py::test_payment_payload_exposes_platform_fee_and_names` is a
regression guard: if `platform_fee`, `client_name` or `creator_name` ever goes
missing from the payload again, that test fails rather than the UI printing
`NaN`.

---

## ISSUE 7 — Verify and admin actions must persist

**Status: FIXED · PASS**

Full inventory: **`ADMIN_ACTION_INVENTORY.md`** — every action, its endpoint,
database effect, permission and test.

### Root cause

Verify *did* persist — it flipped `is_verified` and committed. The real defects:

1. **It was a blind toggle, not a verify.**
   `setattr(creator, "is_verified", not creator.is_verified)`. Two clicks, or a
   double-click race, flipped it back with both requests reporting success.
2. **No reviewer or timestamp was recorded** — `CreatorProfile` had no
   `verified_at` / `verified_by`, so there was no audit of who verified whom.
3. **The frontend reported success without saying what happened** — the toast was
   the literal string `Verify toggled`.
4. `catch {}` swallowed load failures into an empty table.

Separately, `AdminOrders`' status override was an unguarded `await`: a rejected
request threw an unhandled rejection and the admin was told nothing.

### Fix applied

* **Safe additive migration** `backend/migrate_add_verification_audit.py` adds
  nullable `verified_at` and `verified_by`. Additive only — no column is dropped
  or rewritten, no row data is touched, no database reset. Idempotent.
* `PUT /creators/{id}/verify` now takes `{"verified": true|false}` and is
  **idempotent**: repeating it returns `changed: false` and changes nothing. It
  records the acting admin and a UTC timestamp, clears them on unverify, returns
  the resulting state, and notifies the creator. An omitted body still toggles,
  for backward compatibility.
* Approve / reject / suspend guard no-op transitions and return the resulting
  `approval_status`; feature returns the resulting `is_featured`.
* `_format_creator_admin` exposes `verified_at`, `verified_by` and
  `verified_by_name`, shown under the badge in the table.
* The frontend sends **explicit intent** (`!c.is_verified`), blocks duplicate and
  conflicting requests per row while one is in flight, refetches from the server
  after success so the UI matches the database, shows the server's own message,
  and confirms destructive actions (reject, suspend, delete user, delete review,
  block chat, role change) naming the subject.
* Load failures on creators, users, orders and reviews now show an error state
  with Retry instead of an empty table.

**Documented clearly:** creator verification (`is_verified`, the marketplace
badge) is *not* creator approval (`approval_status`), *not* email verification
(not implemented here) and *not* delivery approval
(`delivery_submissions.status`).

### Test evidence

`tests/test_admin_actions.py` — **30 passed**. Each test re-reads the row from the
database after the action, and verification is additionally re-read through a
fresh API request standing in for refresh/re-login. Covers: verify persists;
reviewer and timestamp recorded; survives a fresh request; **idempotent across
three identical calls**; unverify clears the audit fields; backward-compatible
toggle; non-boolean rejected 400; unknown creator 404; approve idempotent;
reject, suspend/unsuspend round trip; unsuspend on a non-suspended creator 400;
feature reports resulting state; user block/unblock and role change persist; chat
block persists and returns its state; review hide and delete persist. Permission
coverage: creator token 403 on every creator action and on user block, chat block
and review delete; client token 403 on verify; anonymous rejected.

Migration run on the live database, twice:

```
Table 'creator_profiles' currently has 21 columns.
  added verified_at
  added verified_by
OK. 'creator_profiles' now has 23 columns, 1 rows preserved.
-- rerun --
  skip verified_at - already present
  skip verified_by - already present
No changes were needed.
```

**One regression I introduced and fixed:** the new `verified_by` foreign key gave
`creator_profiles` a second FK to `users`, which broke `User.creator_profile` and
four implicit `.join(User)` calls in `creators.py` / `public.py`. Caught by the
test suite (3 failures), fixed by naming the join column explicitly. The suite is
green again.

---

## ISSUE 8 — Video Studio back / dashboard navigation

**Status: FIXED (code) · browser click-through NOT TESTED**

### Root cause

Both studio routes render **without the `Navbar`** — deliberately
(`App.jsx`, "full-screen, no Navbar") — and neither page supplied a replacement:

* `/creator/video-studio` had **no back link, no dashboard link and no home link
  at all**. It was a dead end reachable only via browser Back. Telling detail:
  its root div still carried `paddingTop: 70`, reserving space for the Navbar
  that is not rendered — a blank 70 px gap exactly where navigation should be.
* `/creator/video-studio/:projectId` had only a small muted-grey `‹ Studio` text
  link on a dark toolbar, and no Creator Dashboard or Home option.
* **No unsaved-changes guard and no active-export guard.** The editor autosaves
  on a 1.5 s debounce, so leaving inside that window dropped the last edit, and
  the browser-side `MediaRecorder` export cannot survive navigation.

### Fix applied

* New `src/hooks/useInAppBack.js` keeps its own trail of in-app routes actually
  visited this session and navigates to the last valid one explicitly.
  **`window.history.length` is never used as evidence**, because it counts
  entries from before the app was opened and cannot tell you whether the previous
  entry is an in-app destination. Login, register and forgot-password are
  excluded as Back targets, and protocol-relative paths are rejected, so Back
  cannot land on an unrelated external site. With no recorded route it falls back
  to the **Creator Dashboard**.
* `<InAppHistoryTracker/>` in `App.jsx` records each visit.
* New `src/components/layout/StudioNav.jsx` — **Back**, **Creator Dashboard** and
  **Home**, in a light variant on the projects list (filling that 70 px gap, which
  is now removed) and a dark variant in the editor toolbar, plus a **My Projects**
  button in the editor. It wraps at phone width.
* Both the Back button and the plain links run a `confirmLeave` guard. The editor
  supplies one that:
  * warns if an **export is running**, and says plainly that the export runs
    inside the page and will be **cancelled** — it does not claim background
    continuation, because that is not supported;
  * warns if a save is `unsaved`, `saving` or `error`, so a debounced edit is not
    lost silently;
  * is also wired to `beforeunload`, covering tab close, refresh and browser Back.

Authentication and role checks are untouched — both routes stay inside
`ProtectedRoute allowedRoles={['creator']}`.

### Test evidence

Build and lint pass; the navigation code compiles into the bundle (3030 modules).
**The click-through itself was not exercised in a browser** — see below.

---

## Why Playwright was not run

`frontend/tests/03-creator-order.spec.js` creates assignments titled
`PW Smoke: Smartwatch Ad` against `http://localhost:8000` — **the live
development database**. That suite is the documented cause of Issue 2. Running it
would have written fresh sample records into your database while I was in the
middle of reporting them, so I did not run it.

`playwright.config.js` was given `testIgnore: ['**/unit/**']` so the new
`node:test` unit tests are not collected by Playwright; `npx playwright test
--list` confirms 38 specs across 3 files still collect correctly.

To run it safely, point the backend at a throwaway database first.

## What was not verified

Stated plainly rather than claimed:

* **Issue 1** — the probe, the stored metadata, the rejection paths and the
  stream headers are all verified by executed tests and live API calls. **A human
  watching moving pictures in the browser is not.** The fixes address the four
  causes found in the code and database, but the brief's own standard ("a real
  video picture and playback must be verified") needs a manual check: open a
  project, upload a video, and confirm you see the picture plus the dimensions in
  the new status line under the controls.
* **Issue 8** — no browser click-through of Back / Dashboard / Home across the
  studio project list, editor, nested routes, direct URL opening, refresh,
  browser Back/Forward, or mobile layout.
* **Light/dark theme readability and mobile layout** for the new and rebuilt
  screens were written against the existing CSS variables and use wrapping
  grids, but were not visually inspected.
* No emails or SMS were sent, no live financial action was taken, and no paid
  external service was called. Payment integrations stayed in simulated/test
  mode throughout.

## Test data

All verification used isolated accounts (`@test.invalid`) and a scratch backend
on a spare port. Those rows and their files were removed afterwards; genuine data
is intact — 3 users (1, 17, 18), 2 orders, 2 payments, 35 assignments. The only
side effect is the 4 smoke chats noted under Issue 2.

A copy of the database as it was before the migration is in this session's
scratchpad at
`C:\Users\manik\AppData\Local\Temp\claude\c--Users-manik-OneDrive-Desktop-Mani\b41a86e1-2429-43ef-9986-2fdd5f7fd74b\scratchpad\creatorhub.db.bak`.

---

## Final checklist

- [x] **Uploaded video visibly plays** — four root causes fixed; real metadata now
      stored and verified; honest error states. *Needs your one manual look to
      confirm the picture, per the brief's own standard.*
- [ ] **Admin assignments use real data only** — code fixed (error/empty states,
      no misleading empty). **35 residue rows await your approval to delete.**
- [ ] **Admin chat monitor uses real conversations only** — code fixed.
      **30 residue rows await your approval to delete.**
- [x] **Weekly/monthly/yearly turnover is correct** — shared service, 21 boundary
      tests pass.
- [x] **Client source-media editing workflow works end to end** — 48 tests plus a
      live run through to a delivery in `pending_review`.
- [x] **Invalid money values show "-" instead of NaN** — shared formatter, 25
      tests, applied across every money display.
- [x] **Verify and existing admin actions persist correctly** — 30 tests
      re-reading the database; verify is now idempotent and audited.
- [x] **Studio Back/Dashboard navigation works** — code complete; browser
      click-through not run.
- [x] **Database changes persist after refresh** — asserted by re-reading rows
      and by fresh API requests.
- [x] **Private records/media remain protected** — cross-role and cross-tenant
      access asserted 403/404 for studio assets, editing-request media and every
      admin action.
- [x] **Existing working features remain intact** — 291 backend tests pass (up
      from 170), build and lint clean, Round 2 matching/licensing/revision/delivery
      workflow untouched and reused rather than duplicated.
