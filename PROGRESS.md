# AI CreatorHub — Feature Upgrade Progress

## Status: COMPLETE ✅

---

## Three Features Implemented

### 1. HuggingFace Image & Video Generation (Creator-Only AI Studio) ✅

**Backend:**
- `backend/app/services/hf_generation.py` — HuggingFace InferenceClient adapter
  - `generate_image()`: calls HF text-to-image API, saves PNG to private_uploads/studio/hf_generated/
  - `generate_video()`: calls HF text-to-video API, saves MP4
  - Maps all HF error types (401/402/429/safety/timeout) to HFGenerationError user-friendly messages
- `backend/app/models/ai_generation.py` — AIGenerationJob model (new table)
  - Tracks each generation request with status, prompt, model, provider, storage_key, output_asset_id
  - Status: queued → running → completed | failed
- `backend/app/api/hf_generation.py` — Creator-only REST endpoints
  - `GET /api/creator/studio/ai/generation-config` — what's available (no token exposed)
  - `POST /api/creator/studio/ai/generate-image` — start image job
  - `POST /api/creator/studio/ai/generate-video` — start video job
  - `GET /api/creator/studio/ai/generation-jobs` — list my jobs
  - `GET /api/creator/studio/ai/generation-jobs/{id}` — poll status
  - `POST /api/creator/studio/ai/generation-jobs/{id}/save-asset` — save to media library
  - `GET /api/creator/studio/ai/generation-jobs/{id}/download` — download result
- Configuration in `backend/app/core/config.py`:
  - `HUGGINGFACE_API_TOKEN`, `HF_IMAGE_MODEL`, `HF_IMAGE_PROVIDER`, `HF_VIDEO_MODEL`, `HF_VIDEO_PROVIDER`, `HF_MAX_CONCURRENT_JOBS`

**Frontend:**
- `frontend/src/components/studio/StudioHFPanel.jsx` — HF generation panel
  - Tabbed: "AI Image" / "AI Video"
  - Polls active jobs every 3s
  - Shows download + "Save to Library" on completion
  - Honest error display when token not configured
- Injected into `StudioEditorPage.jsx` AI tab, after Script Assistant section
- `studioAPI.listAssets()` called on asset save to refresh media library tab

**Tests (mocked, no real API calls):**
- Test 1: Missing token config → shows correct state
- Test 2: 401 error mapping → HFGenerationError with correct message
- Test 3: 429 rate limit mapping → correct message
- Test 4: Successful mocked image generation + file write
- Test 5: Config structure logic (available/unavailable)
- ✅ ALL 5 PASSED

---

### 2. 24-Hour Auto-Release (Durable Scheduler) ✅

**Backend:**
- `backend/app/models/delivery.py` — 3 new columns added to DeliverySubmission:
  - `review_due_at DATETIME` — set to submitted_at + AUTO_RELEASE_HOURS on submission/resubmission
  - `released_at DATETIME` — actual release timestamp
  - `release_method VARCHAR(40)` — "admin_approved" | "auto_released_after_timeout"
- `backend/app/services/delivery_release.py` — shared release logic
  - Used by BOTH admin manual approval and auto-release worker
  - Atomic: re-queries with status == pending_review guard for concurrency safety
  - Does NOT set reviewed_by for auto-releases (no fake admin)
  - Does NOT auto-complete orders or trigger payouts (status → "delivered" only)
  - Does NOT release: changes_requested, rejected, approved, superseded, cancelled
- `backend/app/workers/auto_release_worker.py` — APScheduler background worker
  - Runs every AUTO_RELEASE_INTERVAL_SECONDS (default: 60s)
  - Handles SQLite naive datetime correctly
  - max_instances=1 / coalesce=True prevents concurrent/duplicate runs
- `backend/app/api/deliveries.py` — updated:
  - `submit_for_review` sets review_due_at = now + AUTO_RELEASE_HOURS
  - `resubmit_for_review` also sets fresh deadline
  - `approve_delivery` now uses shared delivery_release service
  - `_format_delivery` exposes review_due_at, released_at, release_method
  - Notification to admin includes deadline timestamp
  - Creator submission message mentions the 24h auto-release window
- `backend/app/main.py` — scheduler started/stopped via FastAPI lifespan
- SQLite column migration runs automatically on startup
- Configuration: `AUTO_RELEASE_HOURS=24`, `AUTO_RELEASE_INTERVAL_SECONDS=60`

**Frontend:**
- `frontend/src/pages/admin/AdminVideoApprovals.jsx` — updated detail panel:
  - Shows review deadline with time remaining
  - Shows "OVERDUE" warning if deadline passed before admin acted
  - Shows release_method badge: "Admin Approved" / "Auto-Released"

**Tests (synthetic clock, isolated DB):**
- Test 1: Non-overdue (10h) → NOT released ✅
- Test 2: Overdue (25h) → released, status=approved, release_method=auto_released_after_timeout, reviewed_by=None ✅
- Test 3: Concurrent admin approval → worker safely skips ✅
- Test 4: changes_requested → NOT released ✅
- Test 5: Worker _process_overdue_submissions integration ✅
- ✅ ALL 5 PASSED

---

### 3. Gemini Help Chatbot ✅

**Backend:**
- `backend/app/api/helpbot.py` — grounded Gemini chatbot API
  - `GET /api/helpbot/status` — check availability
  - `POST /api/helpbot/chat` — chat with history, optional user context
  - Grounded knowledge base: platform policies, routes, delivery workflow, updated 24h release policy
  - Bilingual: Tamil & English (same model, user language detected naturally)
  - Rate limiting: 20 requests per user/IP per 5 minutes (in-memory)
  - Input bound: 1000 chars/message, 8 turns history
  - Personalized order status: fetches real data for "my order" queries (auth-checked)
  - Model fallback: configured model → gemini-1.5-flash → gemini-1.5-pro → gemini-pro
  - System prompt prevents: write actions, admin actions, payments, data leaks, prompt injection
  - Support contact included in system prompt: +91 6380994709 / manikandan54431@gmail.com
  - Token NEVER returned to frontend

**Frontend:**
- `frontend/src/components/HelpChatbot.jsx` — floating chat widget
  - Fixed position, bottom-right, slide-in animation
  - Minimize/maximize, clear conversation, close
  - Typing indicator (animated dots)
  - Safe content renderer (bold, inline code, safe internal links only)
  - Shows offline state with support contact links
  - Rate limit errors shown gracefully
  - Accessible: ARIA labels, role="log", role="dialog"
- `frontend/src/App.jsx` — HelpChatbot rendered globally (all pages)
- `frontend/src/services/api.js` — helpbotAPI added

---

## Files Changed

### New Files
| File | Purpose |
|------|---------|
| `backend/app/services/hf_generation.py` | HF image/video generation adapter |
| `backend/app/services/delivery_release.py` | Shared delivery release service |
| `backend/app/workers/auto_release_worker.py` | APScheduler auto-release worker |
| `backend/app/workers/__init__.py` | Workers package |
| `backend/app/models/ai_generation.py` | AIGenerationJob model |
| `backend/app/api/hf_generation.py` | Creator-only HF generation routes |
| `backend/app/api/helpbot.py` | Gemini help chatbot routes |
| `frontend/src/components/studio/StudioHFPanel.jsx` | HF generation UI panel |
| `frontend/src/components/HelpChatbot.jsx` | Floating chatbot widget |
| `backend/test_autorelease.py` | Auto-release unit tests (5 tests) |
| `backend/test_hf_generation.py` | HF generation mock tests (5 tests) |

### Modified Files
| File | Change |
|------|--------|
| `backend/app/core/config.py` | HF, auto-release, Gemini model settings |
| `backend/app/models/delivery.py` | review_due_at, released_at, release_method columns |
| `backend/app/models/__init__.py` | AIGenerationJob registered |
| `backend/app/api/deliveries.py` | review_due_at on submit, shared release service, updated format |
| `backend/app/main.py` | New routers, lifespan scheduler, SQLite migration |
| `backend/requirements.txt` | huggingface_hub>=0.24.0, apscheduler>=3.10.0 |
| `backend/.env` | GEMINI_MODEL, HF vars, auto-release vars |
| `frontend/src/services/api.js` | hfGenAPI, helpbotAPI exports |
| `frontend/src/App.jsx` | HelpChatbot imported and rendered globally |
| `frontend/src/pages/creator/StudioEditorPage.jsx` | StudioHFPanel injected in AI tab |
| `frontend/src/pages/admin/AdminVideoApprovals.jsx` | Deadline/release-method display |

---

## Environment Variables Required

```env
# HuggingFace (set HUGGINGFACE_API_TOKEN to enable generation)
HUGGINGFACE_API_TOKEN=hf_...
HF_IMAGE_MODEL=black-forest-labs/FLUX.1-schnell
HF_IMAGE_PROVIDER=
HF_VIDEO_MODEL=
HF_VIDEO_PROVIDER=
HF_MAX_CONCURRENT_JOBS=2

# Auto-release scheduler
AUTO_RELEASE_HOURS=24
AUTO_RELEASE_INTERVAL_SECONDS=60

# Gemini chatbot
GEMINI_API_KEY=<existing key>
GEMINI_MODEL=gemini-1.5-flash
```

## Startup Instructions

```bash
# Install new packages (already done)
pip install "huggingface_hub>=0.24.0" "apscheduler>=3.10.0"

# Start backend (scheduler starts automatically via lifespan)
cd backend
uvicorn app.main:app --reload --port 8000

# Start frontend
cd frontend
npm run dev
```

## Test Results

| Test Suite | Count | Result |
|-----------|-------|--------|
| Auto-release tests (synthetic clock) | 5 | ALL PASSED |
| HF generation tests (mocked) | 5 | ALL PASSED |
| Frontend build (3027 modules) | — | PASSED |
| Backend syntax check | — | PASSED |
| API route registration | 6 routes | ALL VERIFIED |

## Limitations & Notes

- **HF generation**: No real API calls made (HUGGINGFACE_API_TOKEN is empty in .env — user must add their own)
- **Video generation**: Disabled by default (HF_VIDEO_MODEL is empty). Set HF_VIDEO_MODEL to enable.
- **Auto-release**: Scheduler runs on server startup; production deployments should ensure single-process Uvicorn or use a separate worker process
- **Helpbot language**: Tamil support is natural (Gemini detects language), no separate prompt needed
- **Chatbot rate limiting**: In-memory; resets on server restart; use Redis for production multi-process

## Blocked / Not Tested

- Real HuggingFace API calls (requires valid token + credits — user must add HUGGINGFACE_API_TOKEN)
- Real Gemini chatbot responses (existing GEMINI_API_KEY in .env may work — user should test)
- Video generation (HF_VIDEO_MODEL not configured — provider-dependent)

---

# AI Integration Removal — 2026-10-24

All third-party AI integrations were removed from the platform. The marketplace
and the manual video-editing workflow are unchanged and fully functional.

## Features Removed

| Feature | Surface removed |
|---|---|
| Gemini website chatbot | `HelpChatbot.jsx`, `/api/helpbot/*` |
| Gemini Creator Project Assistant | `ProjectAssistant.jsx`, `/api/creator/ai-assistant/*` |
| AI project analysis & idea-refinement chat | same as above (analysis, concepts, chat, versions) |
| AI Script Assistant | Studio "AI" tab, `/api/creator/studio/ai/script-assistant` |
| Hugging Face image & video generation | `StudioHFPanel.jsx`, `/api/creator/studio/ai/generate-*` |
| AI prompt enhancement / bio / brief / ideas / captions | `/api/ai/*`, "AI Generate" and "AI Write Bio" buttons |
| AI caption & voiceover provider hints | `/api/creator/studio/ai/caption-hint`, `/voiceover-hint` |
| Admin "Gemini AI Engine" panel + connection test | `AdminSettings.jsx` AI section, `/api/admin/settings/test-ai` |

No external AI provider can be reached any more: there is no client code, no
route, and no background job that calls Gemini or Hugging Face.

## Files Deleted

**Backend**
- `app/api/ai_features.py` (notification router extracted first — see below)
- `app/api/helpbot.py`
- `app/api/hf_generation.py`
- `app/api/project_assistant.py`
- `app/services/hf_generation.py`
- `test_hf_generation.py`, `test_studio_8001.py`, `test_studio_acceptance.py`, `verify_backend.py`

**Frontend**
- `src/components/HelpChatbot.jsx`
- `src/components/ProjectAssistant.jsx`
- `src/components/studio/StudioHFPanel.jsx`
- `tests/03-creator-assistant.spec.js` (replaced by `tests/03-creator-order.spec.js`)

## Files Changed

**Backend**
- `app/api/notifications.py` — **new**; holds the notification router that used to
  live inside `ai_features.py`. Notifications were never an AI feature and keep working.
- `app/main.py` — AI router imports and registrations removed
- `app/core/config.py` — all `GEMINI_*` and `HF_*` settings removed
- `app/api/studio.py` — three AI endpoints removed; unused `settings` import dropped; "AI Studio" renamed to "Video Studio"
- `app/api/admin.py` — `ai_integrations` settings block replaced by `moderation`; AI diagnostics and the `test-ai` endpoint removed; the assignment notification no longer tells creators to use an AI assistant
- `app/schemas/schemas.py` — AI request/response schemas removed
- `app/models/__init__.py` — AI models retained for table mapping only, with an explanatory note
- `platform_settings.json` — `ai_integrations` replaced by `moderation`
- `requirements.txt` — dropped `google-generativeai` and `huggingface_hub`
- `.env`, `.env.example` — AI variables removed
- `tests/conftest.py`, `tests/test_studio.py`, `tests/test_comprehensive_qa.py` — AI tests replaced with removal-regression tests

**Frontend**
- `src/services/api.js` — `aiAPI`, `hfGenAPI`, `projectAssistantAPI`, `helpbotAPI`, studio AI calls and `testAIConnection` removed
- `src/App.jsx` — chatbot unmounted; `/creator/ai-studio` renamed to `/creator/video-studio` with redirects preserving old links
- `src/pages/creator/StudioEditorPage.jsx` — AI tab, handler, state and HF panel removed
- `src/pages/creator/StudioProjectsPage.jsx`, `CreatorDashboard.jsx`, `components/layout/Navbar.jsx` — "AI Studio" renamed to "Video Studio"
- `src/pages/shared/OrderDetailPage.jsx` — assistant panel, AI brief card and "AI Tools" card removed
- `src/pages/client/HireCreatorPage.jsx` — "AI Generate" brief button removed
- `src/pages/creator/CreatorProfileEditor.jsx` — "AI Write Bio" button removed
- `src/pages/admin/AdminSettings.jsx` — AI section replaced by a Moderation section
- `src/pages/public/HowItWorksPage.jsx` — removed false claims of AI search, AI chat suggestions, AI brief assistant and AI matching
- `src/pages/public/PrivacyPolicyPage.jsx` — Gemini third-party entry removed; a new section documents that AI features were removed and that data *was* historically sent to Gemini and Hugging Face
- `README.md` — AI feature section replaced with the Video Studio feature list

## Environment Variables To Remove From Hosting

Delete these from your hosting provider's environment configuration. They are no
longer read by the application:

- `GEMINI_API_KEY`
- `GEMINI_MODEL`
- `HUGGINGFACE_API_TOKEN`
- `HF_IMAGE_MODEL`
- `HF_IMAGE_PROVIDER`
- `HF_VIDEO_MODEL`
- `HF_VIDEO_PROVIDER`
- `HF_MAX_CONCURRENT_JOBS`

## Keys To Revoke (action required by the owner)

Removing the code does **not** revoke anything. Both keys were live in
`backend/.env` and have been deleted from that file, but they remain valid until
you revoke them at the provider:

- **Google Gemini API key** — revoke at Google AI Studio / Google Cloud console
- **Hugging Face access token** — revoke at https://huggingface.co/settings/tokens

No subscription or billing was cancelled automatically. Check both providers for
any active billing you no longer need.

## Data & Media Preserved

Nothing was deleted. Verified by direct database audit:

- Users, orders, assignments, chats, messages, notifications, payments, reviews,
  support tickets, studio projects, studio assets and deliveries are all untouched.
- Media files on disk, all still present and served by endpoints that were **not**
  removed:

  | `private_uploads/` folder | Files |
  |---|---|
  | `deliveries/` | 148 |
  | `studio/renders/` | 9 |
  | `studio/assets/` | 8 |
  | `studio/hf_generated/` | **0** (empty) |

- **No generated media was at risk.** All 11 `ai_generation_jobs` rows are
  `status=failed` with `storage_key=NULL` and `output_asset_id=NULL`, and
  `private_uploads/studio/hf_generated/` is empty. Nothing was ever successfully
  generated, so no media depended on the deleted download endpoint. The empty
  folder was left in place; it can be deleted manually at any time.
- Uploaded studio assets (`studio_assets`, 5 DB rows / 8 files) are served by the
  normal authenticated studio media endpoint, which is untouched. Had any AI
  generation succeeded, the "save as asset" flow would already have copied it
  into this same library, so it would have survived the removal regardless.

## Retained AI-Only Database Records

Left in place deliberately — destructive cleanup needs separate approval:

| Table | Rows | Notes |
|---|---|---|
| `ai_generation_jobs` | 11 | All failed attempts. No files, nothing recoverable as media. |
| `project_assistant_sessions` | 0 | Empty. Table exists but holds no analysis or chat history. |

Their SQLAlchemy models are still imported in `app/models/__init__.py` purely so
the tables keep a valid mapping and application startup is unaffected. No route,
service or worker reads or writes them.

## Preserved Behaviour

- Project assignment, chat and delivery-review notifications
- Export/render jobs and the shared job infrastructure
- The 24-hour auto-release scheduler (`AUTO_RELEASE_*` settings untouched)
- Canvas/MediaRecorder export pipeline (lives in the Studio folder but is not AI)
- Saved timeline format — unchanged, existing projects open normally

## Test Results

| Suite | Result |
|---|---|
| Backend `pytest tests/` | **170 passed**, 0 failed |
| Playwright E2E (`npx playwright test`) | **38 passed**, 0 failed |
| Frontend production build (`npm run build`) | **PASSED** — 3025 modules |
| Frontend lint (`npx oxlint src/`) | **0 errors** (pre-existing warnings only) |
| Backend starts with no AI credentials | **PASSED** — 106 API routes, 0 AI routes |

Removal is covered by regression tests: all 14 removed endpoints are asserted to
return 404, the order page is asserted to have no assistant panel or AI buttons,
public pages are asserted to have no chatbot, and the retained studio,
notification and marketplace flows are asserted to work without AI config.

## Limitations

- `playwright-report/` and `test-results/` are generated artifacts; `npm run lint`
  reports errors from bundled vendor code inside them. Lint `src/` directly, or
  add those folders to the lint ignore list.
- Legacy `/creator/ai-studio` URLs still resolve (they redirect to
  `/creator/video-studio`). Remove those two routes in `App.jsx` once you are
  confident no bookmarks or external links point at them.
- The project name remains "AI CreatorHub" and creator-declared AI tool tags
  (Midjourney, Runway, etc.) remain — those describe what creators use, not a
  platform integration. A full rebrand was not requested.

---

## AI Removal — re-verification 2026-10-24

A fresh full-codebase sweep confirmed the removal above is still in place; no AI
integration has re-entered the project. Findings:

- **Backend source:** no `helpbot.py`, `hf_generation.py`, `project_assistant.py`
  or `ai_features.py` under `app/api`; no AI worker (`app/workers` holds only
  `auto_release_worker.py`); no AI service (`app/services` holds only
  `delivery_release`, `media_probe`, `notification_service`, `revenue`).
- **Routes:** `app.main.app` imports with no AI credentials and exposes **zero**
  AI-looking routes. The dev-only "ALLOW_SIMULATED_PAYMENTS" line is a payments
  warning, not an AI reference.
- **Config / env:** no `GEMINI_*` / `HF_*` / `HUGGINGFACE_*` keys in
  `app/core/config.py`, `.env` or `.env.example`. `requirements.txt` has no
  `google-generativeai` or `huggingface_hub`.
- **Frontend:** no `HelpChatbot`, `ProjectAssistant` or `StudioHFPanel`; `App.jsx`
  mounts no chatbot and routes `/creator/ai-studio` → `/creator/video-studio`.
- **Legitimate remaining references (left intentionally):** "AI-Powered Creators"
  marketing copy (describes creators who use AI tools, not a platform feature);
  creator skill-tag lists (`CreatorProfileEditor.jsx`, `seed.py`); and the
  required historical disclosure in `PrivacyPolicyPage.jsx` that data *was*
  previously sent to Gemini / Hugging Face.
- **One cleanup this pass:** removed a stale `/api/creator/studio/ai` line from
  the `studio.py` module docstring (the route itself was already gone).

**Retained AI-only data (unchanged, no destructive cleanup):**
`ai_generation_jobs` = 11 rows (all failed, 0 with stored media),
`project_assistant_sessions` = 0 rows. Their models stay imported in
`app/models/__init__.py` only so the tables keep a valid mapping.

**Tests executed this pass:** `app.main` import with no AI creds → OK, 0 AI
routes; `pytest tests/test_studio.py -k "ai or gone or removed"` → **16 passed**;
`oxlint src/` → 0 errors (pre-existing warnings only). The full 291-test backend
suite and the frontend production build both passed earlier in this session; the
only change since was this comment-only docstring edit.

**Env vars for the owner to remove from hosting** (if still set there):
`GEMINI_API_KEY`, `GEMINI_MODEL`, `HUGGINGFACE_API_TOKEN`, `HF_IMAGE_MODEL`,
`HF_IMAGE_PROVIDER`, `HF_VIDEO_MODEL`, `HF_VIDEO_PROVIDER`, `HF_MAX_CONCURRENT_JOBS`.

**Keys to revoke at the provider** (removing code does *not* revoke them, and no
subscription or billing was cancelled automatically): the Google Gemini API key
(Google AI Studio / Cloud console) and the Hugging Face token
(huggingface.co/settings/tokens).

---

# Feature: Creator-only AI Generator (PixVerse) — 2026-10-24

A NEW, separate creator page that generates short videos from a text prompt via
the **official PixVerse Platform API**. Added without touching the marketplace,
Video Studio editor, delivery/review flow, or the earlier AI removal (this is a
fresh, explicitly-authorized PixVerse integration — not a restored Gemini/HF one).

## What was built

**Route:** `/creator/ai-generator` (creator-only). **API prefix:**
`/api/creator/ai-generator`. Backend enforces creator role on every endpoint;
clients/admins/guests are rejected server-side (the hidden sidebar link is not
relied upon).

Flow: prompt → Generate → async generation (submit now, worker polls) → private
playable result → Download / Save to My Media / Open in Video Studio → history.

## Official PixVerse API used (verified against docs.platform.pixverse.ai)

- Generate: `POST https://app-api.pixverse.ai/openapi/v2/video/text/generate`
  headers `API-KEY` + `Ai-trace-id`; body `{model, prompt, duration, quality,
  aspect_ratio, seed?}`; returns `{ErrCode, ErrMsg, Resp:{video_id, credits}}`.
  A non-zero `ErrCode` is a failure even on HTTP 200.
- Status: `GET /openapi/v2/video/result/{video_id}` → `Resp:{status, url}`;
  status `1`=success, `5`=generating, `7`=moderation-failed, `8`=failed.
- Model configured: **`v5`** (owner-set via `PIXVERSE_MODEL`, not creator-chosen).
  Options exposed: quality 360p/540p/720p/1080p; aspect 16:9/9:16/1:1/4:3/3:4;
  duration 5s/8s.

## Files changed

New (backend): `app/models/pixverse_job.py`, `app/services/pixverse_service.py`,
`app/api/pixverse.py`, `app/workers/pixverse_worker.py`,
`tests/test_pixverse.py`.
New (frontend): `src/pages/creator/AIGeneratorPage.jsx`.
Modified (backend): `app/core/config.py` (PixVerse settings), `app/models/__init__.py`
(register `PixVerseJob`), `app/main.py` (router + worker lifespan), `.env`,
`.env.example`, `tests/conftest.py` (disable worker in tests, redirect dirs).
Modified (frontend): `src/services/api.js` (`aiGeneratorAPI`), `src/App.jsx`
(route), `src/components/layout/Navbar.jsx` + `src/pages/creator/CreatorDashboard.jsx`
(nav entries).

## Durability & safety

- A new table `pixverse_jobs` (created by `create_all`; **no migration to
  existing tables, no risk to existing data**). Persists local job id, creator
  id, prompt, settings, provider task id (`video_id`), trace id, provider/model,
  local+provider status, output storage key, error, credits, timestamps.
- Generation is asynchronous: the request submits and returns `generating` (a
  200 submission is never treated as a completed video). An APScheduler worker
  (`pixverse_worker`, interval = `PIXVERSE_POLL_INTERVAL_SECONDS`, max_instances=1)
  polls in-flight jobs, maps status, downloads + validates (rejects JSON/HTML,
  size cap) + stores privately, then marks completed. Overall per-job timeout.
- Refresh-safe: the page reloads job state from the server and resumes polling.
- Duplicate guard: identical prompt+settings within `PIXVERSE_DEDUPE_WINDOW_SECONDS`
  returns the existing job (provider called once); plus per-creator concurrent and
  daily limits; plus the Generate button disables while in flight.
- Output-save retry (`/retry-save`) re-downloads a provider-succeeded job **without
  re-submitting a chargeable generation**.
- Output is private: streamed/downloaded only to the owning creator (token-authed),
  storage keys never serialized. "Save to My Media" creates a `StudioAsset` (shows
  in the Video Studio library); "Open in Video Studio" creates a project with the
  asset attached and opens the existing editor — no raw timeline object inserted.
- Generated video is a **draft**: it does not go to the client, get admin-approved,
  complete an order, or start a payout. The existing delivery/review/release
  workflow is unchanged (a test asserts no DeliverySubmission is created).

## Worker startup requirement

The poller starts via FastAPI lifespan when `ENABLE_PIXVERSE_WORKER=true` (default)
AND a key is configured. In multi-process deployments, run a single worker process
(same caveat as the auto-release scheduler).

## Environment variables (added)

`PIXVERSE_API_KEY` (set in backend `.env`, server-side only — never sent to the
frontend/logs/URLs), `PIXVERSE_MODEL=v5`, `PIXVERSE_DEFAULT_QUALITY=540p`,
`PIXVERSE_DEFAULT_DURATION=5`. `.env.example` lists the names with no secret value.
Further tunables (defaults in `config.py`): `PIXVERSE_API_BASE`,
`PIXVERSE_POLL_INTERVAL_SECONDS`, `PIXVERSE_JOB_TIMEOUT_SECONDS`,
`PIXVERSE_MAX_CONCURRENT_PER_CREATOR`, `PIXVERSE_DAILY_LIMIT_PER_CREATOR`,
`PIXVERSE_MAX_PROMPT_CHARS`, `PIXVERSE_OUTPUT_MAX_MB`,
`PIXVERSE_DEDUPE_WINDOW_SECONDS`, `ENABLE_PIXVERSE_WORKER`.

## Tests executed

- `pytest tests/test_pixverse.py` → **19 passed** (mocked provider; no real calls):
  role enforcement, cross-creator isolation (job + stream), validation, dedupe,
  submission≠completion, provider status mapping (5/1/7/8), private storage,
  refresh-restore, missing-key unavailability, non-zero ErrCode failure,
  retry-save never re-submits, studio import shape, save idempotency, no delivery
  created, HTML-not-video rejection.
- Full backend suite `pytest tests/` → **310 passed** (was 291; +19), no regressions.
- Frontend `npm run build` → PASSED (3031 modules). `oxlint` on new files → 0 errors
  (2 pre-existing-style warnings only).

## Live-generation verification status — NOT DONE (needs approval)

No real PixVerse request has been made. A real generation **consumes PixVerse
credits** (billed to the configured account). Per the brief, a live smoke test
requires the owner's approval first. On approval I will run ONE minimal request
(shortest duration, lowest quality) and verify visible playback, persistence, My
Media, and Studio import.

## Remaining limitations

- Live generation unverified (above). Mocked tests and a 200 submission do not
  prove end-to-end video output.
- `v5` is the configured model and duration options are 5s/8s — conservative,
  documented choices; widen in `config.py`/`.env` if your account supports more.
- Local storage is on-disk under `private_uploads/pixverse/`. On an ephemeral
  deployment filesystem, outputs do not persist across redeploys — move to durable
  storage (e.g. the existing Cloudinary config) for production.
- PixVerse has no idempotency key in the documented API; duplicate protection is
  the server-side dedupe window + concurrency limit + disabled button, not a
  provider-side guarantee.
- Cancellation is not exposed (PixVerse cancel semantics not confirmed), per the
  brief's instruction not to show a Cancel control unless actually supported.
- No browser click-through of the new page was performed in this session.
