# Manual QA & Visual Test Checklist: AI CreatorHub

This checklist covers items that require manual human interaction or visual verification in the browser (such as hardware video decoding, live user gestures, and production third-party webhooks).

---

## 1. Local Server Prerequisites

Ensure the servers are active before beginning manual testing:
- **Backend:** `http://localhost:8000` (API Docs: `http://localhost:8000/api/docs`)
- **Frontend:** `http://localhost:5173`

---

## 2. Creator Delivery & Admin Approval Workflow

| Check # | Workflow Step | Instructions | Expected Visual / Behavioral Result | Status |
|---------|---------------|--------------|-------------------------------------|--------|
| M-01 | Creator Delivery Upload | Log in as Creator (`priya@example.com` / `Creator@123`). Go to an active order. | The upload zone accepts an `.mp4` video. Progress bar displays upload percentage. | [ ] |
| M-02 | In-Browser Video Preview | In the creator delivery drawer, click play on the uploaded draft. | HTML5 video player plays video smoothly with sound and duration controls. | [ ] |
| M-03 | Client Pre-Approval State | Open an incognito window. Log in as Client (`aisha@example.com` / `Client@123`). Navigate to the same order. | The message *"Your project is in progress. The final video will appear here after quality review."* is visible. **No video player or download link appears.** | [ ] |
| M-04 | Admin Video Review | Log in as Admin (`admin@aicreatorhub.com` / `Admin@1234`). Go to `/admin/video-approvals`. | The uploaded delivery appears in the *Pending Review* tab. Clicking *Review* opens the review modal with embedded video player. | [ ] |
| M-05 | Admin Change Request | In the admin review modal, click *Request Changes* and submit notes (e.g., *"Please trim the intro"*). | Delivery status shifts to *Changes Requested*. Creator sees admin notes card on their order page. | [ ] |
| M-06 | Creator Revision Submission | As Creator, upload a revised video and submit for review. | Version number increments to `v2`. Order moves back to *Pending Review* for admin. | [ ] |
| M-07 | Admin Video Approval | As Admin, review `v2` and click *Approve Delivery*. | Delivery status marks *Approved*. | [ ] |
| M-08 | Client Approved Delivery Release | Refresh the Client order view. | Embedded player renders with an **"Admin Verified"** badge, delivery notes, download button, and *Accept Delivery* button. | [ ] |

---

## 3. UI Theme & Visual Polish Checks

| Check # | Area | Instructions | Expected Result | Status |
|---------|------|--------------|-----------------|--------|
| M-09 | Light Mode | Click the sun/moon icon in the navigation bar to toggle to Light Mode. | Microsoft-inspired Fluent styling (`#0078D4` accents, crisp white cards, `#323130` text) with high contrast. | [ ] |
| M-10 | Dark Mode | Click the sun/moon icon to switch to Dark Mode. | Deep obsidian background (`#0B0F19`), legible high-contrast typography, distinct card borders. | [ ] |
| M-11 | Theme Persistence | Refresh the browser page (`F5`). | Selected theme persists across page reload from `localStorage`. | [ ] |
| M-12 | Responsive Mobile View | Open DevTools (`F12`), toggle device toolbar (`Ctrl+Shift+M`), set size to iPhone 14 (`390 x 844`). | Navigation collapses into a hamburger menu, hero text wraps cleanly, cards stack vertically, **no horizontal scrollbar**. | [ ] |

---

## 4. Real-Time Chat & Customer Support

| Check # | Area | Instructions | Expected Result | Status |
|---------|------|--------------|-----------------|--------|
| M-13 | Real-Time Chat | Open Client in regular window and Creator in incognito window on `/chat`. Send a message. | Message appears immediately in the conversation thread with timestamp. | [ ] |
| M-14 | Support Ticket Submission | Go to `/support`. Fill in name, email, category, and issue description. Submit. | Success toast appears. Ticket is assigned an ID. | [ ] |
| M-15 | Admin Support Dashboard | Go to `/admin/support` as Admin. Open the ticket and reply. | Admin reply appears in the ticket thread with an "Admin Support" badge. | [ ] |

---

## 5. Live Production Readiness (Post-Hackathon)

| Check # | Feature | Notes for Production Deployment | Status |
|---------|---------|--------------------------------|--------|
| P-01 | Stripe / Razorpay Live Keys | Swap sandbox simulated keys with live verified merchant keys in `.env`. | Future |
| P-02 | Gemini / Claude API Quotas | Ensure production billing and tier-1 quota limits are enabled on Google AI Studio / Gemini API. | Future |
| P-03 | S3 / Cloudflare R2 Storage | Mount private video storage to AWS S3 or Cloudflare R2 bucket for large production media streaming. | Future |
