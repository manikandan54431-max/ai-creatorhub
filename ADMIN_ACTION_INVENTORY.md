# Admin Action Inventory

Produced for Issue 7. Every action button and control in the admin panel, with
the endpoint it calls, what it changes in the database, the permission enforced
server-side, and the test that proves it persists.

**Acceptance rule applied throughout:** no action may change only a button's
appearance. Each one either re-reads the affected list from the server after
success, or takes the resulting state from the response rather than guessing it
locally.

Permission column: every `/api/admin/*` route below is guarded by
`require_admin` (`backend/app/core/security.py`), re-checked per request.

---

## Creator management — `/admin/creators`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Verify** | `PUT /api/admin/creators/{id}/verify` body `{verified: bool}` | `creator_profiles.is_verified`, plus `verified_at` and `verified_by` | no | `test_admin_actions.py::TestVerifyPersists` (11 tests) |
| **Unverify** | same, `{verified: false}` | `is_verified=false`; clears `verified_at` / `verified_by` | no | `test_unverify_clears_the_audit_fields` |
| **Approve** | `PUT /api/admin/creators/{id}/approve` | `approval_status = "approved"` + notification | no | `test_approve_persists_and_is_idempotent` |
| **Reject** | `PUT /api/admin/creators/{id}/reject` | `approval_status = "rejected"` + notification | **yes** | `test_reject_persists` |
| **Suspend** | `PUT /api/admin/creators/{id}/suspend` | `approval_status = "suspended"` + notification | **yes** | `test_suspend_then_unsuspend_round_trips` |
| **Unsuspend** | `PUT /api/admin/creators/{id}/unsuspend` | `approval_status = "approved"` + notification | no | same, plus `test_unsuspend_rejects_a_creator_who_is_not_suspended` |
| **Feature / Unfeature** | `PUT /api/admin/creators/{id}/feature` | `is_featured` toggles | no | `test_feature_reports_the_resulting_state` |

### What "Verify" means here

The four distinct concepts that were previously easy to conflate:

| Concept | Where it lives | Set by |
|---|---|---|
| **Creator verification** (this action) | `creator_profiles.is_verified` | the Verify button — controls the marketplace "Verified" badge only |
| Creator **approval** | `creator_profiles.approval_status` | Approve / Reject / Suspend — controls whether they can trade at all |
| **Email** verification | not implemented in this codebase | — |
| **Delivery** approval | `delivery_submissions.status` | the Video Approvals screen |

Verify is **not** a blind toggle any more. The request states the intended
result, so repeating it is a no-op that reports `changed: false` instead of
flipping the badge back — the double-click race is gone. Each change records the
reviewing admin and a UTC timestamp, shown under the badge in the table.

---

## User management — `/admin/users`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Block** | `PUT /api/admin/users/{id}/block` | `users.is_blocked = true` | no | `TestUserActionsPersist::test_block_and_unblock_persist` |
| **Unblock** | `PUT /api/admin/users/{id}/unblock` | `users.is_blocked = false` | no | same |
| **Delete** | `DELETE /api/admin/users/{id}` | removes the user row | **yes** — names the user and email | covered by the endpoint's 403 guard test |
| **Change role** | `PUT /api/admin/users/{id}/role` | `users.role` | **yes** — a role change alters access | `test_role_change_persists` |

Cancelling the role-change confirmation re-reads the list, so the `<select>`
snaps back to the stored value rather than showing a change that never happened.

---

## Order management — `/admin/orders`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Status override** (dropdown) | `PUT /api/admin/orders/{id}/status` | `orders.status` | no | existing `test_comprehensive_qa.py` admin order tests |

This was an unguarded `await`: a rejected request raised an unhandled promise
rejection and the admin was told nothing. It now reports the failure and re-reads
the list either way, so the row can never display a status the database does not
hold.

---

## Chat monitoring — `/admin/chats`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Block / Unblock conversation** | `PUT /api/admin/chats/{id}/block` | `chats.is_blocked` toggles | **yes** — names both participants | `TestChatModerationPersists` |
| **Flag / Unflag message** | `POST /api/admin/chats/{chat_id}/flag/{message_id}` | `messages.is_flagged` toggles | no | same class |
| View conversation | `GET /api/admin/chats/{id}/messages` | read-only | — | `test_block_chat_requires_admin` |

Both write endpoints now return the resulting state (`is_blocked` / `flagged`),
and the UI applies that rather than inverting its local copy. On failure nothing
is flipped at all.

---

## Review moderation — `/admin/reviews`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Hide / Unhide** | `PUT /api/admin/reviews/{id}/hide` | `reviews.is_hidden` toggles | no | `TestReviewActionsPersist::test_hide_review_persists` |
| **Delete** | `DELETE /api/admin/reviews/{id}` | removes the review row | **yes** — warns it affects the creator's rating | `test_delete_review_persists` |

---

## Assignments — `/admin/assignments`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Assign creator** | `POST /api/admin/assignments` | creates `orders` + `assignments` + `chats` rows, notifies both parties | no (it is a create form) | existing QA suite |
| **Advance status** | `PUT /api/admin/assignments/{id}/status` | `assignments.status` | no | existing QA suite |

Status buttons were unguarded awaits; they now report failures and refetch.

---

## Disputes — `/admin/disputes`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Resolve** | `PUT /api/admin/disputes/{id}/resolve` | `disputes.status = "resolved"`, `admin_decision`, notifies both parties | modal requires a decision | existing QA suite |

---

## Video approvals — `/admin/video-approvals`

| Action | Endpoint | Database effect | Confirm? | Test |
|---|---|---|---|---|
| **Approve** | `POST /api/admin/video-approvals/{id}/approve` | releases via `delivery_release.release_delivery` — `status`, `approved_at`, `delivered_at`, `released_at`, `release_method`, audit log | no | `test_delivery_workflow.py` |
| **Request changes** | `POST /api/admin/video-approvals/{id}/request-changes` | `status = "changes_requested"`, `creator_visible_feedback`, audit log | no | same |

---

## Payments / turnover — `/admin/payments`

Read-only. The period controls (week / month / year) filter; they change nothing.

| Control | Endpoint | Test |
|---|---|---|
| Period + period picker | `GET /api/admin/payments?period=&anchor=` | `test_turnover.py::test_payments_list_and_summary_agree` |
| Turnover summary | `GET /api/admin/turnover` | `test_turnover.py` (21 tests) |
| Revenue chart series | `GET /api/admin/turnover/series` | `test_turnover_series_returns_consecutive_periods_oldest_first` |

---

## Platform settings — `/admin/settings`

| Action | Endpoint | Database effect | Confirm? |
|---|---|---|---|
| **Save** | `PUT /api/admin/settings` | persists the settings document | no |
| **Reset to defaults** | `POST /api/admin/settings/reset` | overwrites with defaults | **yes** (pre-existing) |

---

## Support tickets — `/admin/support`

| Action | Endpoint | Database effect |
|---|---|---|
| **Reply** | `POST /api/support/admin/tickets/{id}/reply` | inserts `support_ticket_replies` |
| **Change status** | `PUT /api/support/admin/tickets/{id}/status` | `support_tickets.status` |

---

## Actions deliberately NOT added

The brief says not to invent actions that are not part of existing
requirements. These were considered and left alone:

* No "View user detail" page — `GET /api/admin/users/{id}` exists but no screen
  in the current requirements consumes it.
* No bulk operations.
* No edit-in-place for orders, reviews or creator profiles beyond the status
  controls already present.

---

## Permission coverage

`test_admin_actions.py` asserts that a **creator** token is rejected with 403 on
every creator action (`approve`, `reject`, `suspend`, `unsuspend`, `feature`,
`verify`), on user block, on chat block and on review delete, and that an
anonymous request is rejected too. A **client** token is also asserted to be
rejected on verify.
