"""
Test-residue report (Issues 2 & 3).

Identifies assignment and chat rows that were left in the live database by
automated Playwright smoke runs, and which show up in the admin Creator
Assignment and Chat Monitoring pages as default/sample business records.

**Dry run by default. Nothing is deleted unless you pass --delete --yes-i-am-sure.**

    python report_test_residue.py              # report only (safe)
    python report_test_residue.py --delete --yes-i-am-sure

Provenance rules — a row is only classified as test residue when BOTH hold:

  1. Its project title matches a known automated-test prefix ("PW Smoke:"), and
  2. Its client_id or creator_id is dangling — it references a user row that no
     longer exists.

Requiring both means a genuine user's project can never be classified as test
data by title alone, and an orphaned-but-real record is never deleted just for
being orphaned. Anything matching only one rule is reported separately as
"needs a human decision" and is never touched.
"""

import argparse
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
os.chdir(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.user import User
from app.models.order import Assignment, Chat, Message, Order

TEST_TITLE_PREFIXES = ("PW Smoke:", "PW E2E:", "Playwright ")

def _is_test_title(title):
    return bool(title) and any(title.startswith(p) for p in TEST_TITLE_PREFIXES)

def main():
    ap = argparse.ArgumentParser(description="Report (and optionally remove) automated-test residue.")
    ap.add_argument("--delete", action="store_true", help="Actually delete the confirmed residue rows.")
    ap.add_argument("--yes-i-am-sure", action="store_true", help="Required alongside --delete.")
    args = ap.parse_args()

    db = SessionLocal()
    live_user_ids = {uid for (uid,) in db.query(User.id).all()}

    print("=" * 72)
    print("AI CreatorHub - automated-test residue report")
    print("=" * 72)
    print(f"\nLive users in database: {len(live_user_ids)} -> {sorted(live_user_ids)}")

    confirmed_assignments = []
    ambiguous_assignments = []

    for a in db.query(Assignment).order_by(Assignment.id).all():
        test_title = _is_test_title(a.project_title)
        dangling = (a.client_id not in live_user_ids) or (
            a.creator_id is not None and a.creator_id not in live_user_ids
        )
        if test_title and dangling:
            confirmed_assignments.append(a)
        elif test_title or dangling:
            ambiguous_assignments.append((a, test_title, dangling))

    print(f"\n-- ASSIGNMENTS --")
    print(f"total rows                      : {db.query(Assignment).count()}")
    print(f"confirmed test residue          : {len(confirmed_assignments)}")
    print(f"matches only one rule (KEEP)    : {len(ambiguous_assignments)}")

    if confirmed_assignments:
        print("\n  Confirmed residue (test title AND dangling participant):")
        for a in confirmed_assignments[:10]:
            print(f"    id={a.id:<4} title={a.project_title!r} client_id={a.client_id} "
                  f"creator_id={a.creator_id} order_id={a.order_id} status={a.status}")
        if len(confirmed_assignments) > 10:
            print(f"    ... and {len(confirmed_assignments) - 10} more")

    if ambiguous_assignments:
        print("\n  Needs a human decision - NOT deleted:")
        for a, t, d in ambiguous_assignments[:10]:
            why = "test title only" if t else "dangling participant only"
            print(f"    id={a.id:<4} title={a.project_title!r} ({why})")

    residue_order_ids = {a.order_id for a in confirmed_assignments if a.order_id}
    confirmed_chats = []
    ambiguous_chats = []

    for c in db.query(Chat).order_by(Chat.id).all():
        dangling = (c.client_id not in live_user_ids) or (c.creator_id not in live_user_ids)
        from_residue = c.order_id in residue_order_ids
        test_last_msg = bool(c.last_message) and any(
            p in c.last_message for p in TEST_TITLE_PREFIXES
        )
        if dangling and (from_residue or test_last_msg):
            confirmed_chats.append(c)
        elif dangling or from_residue or test_last_msg:
            ambiguous_chats.append(c)

    msg_count = (
        db.query(Message)
        .filter(Message.chat_id.in_([c.id for c in confirmed_chats]))
        .count()
        if confirmed_chats else 0
    )

    print(f"\n-- CHATS --")
    print(f"total rows                      : {db.query(Chat).count()}")
    print(f"confirmed test residue          : {len(confirmed_chats)}")
    print(f"matches only one rule (KEEP)    : {len(ambiguous_chats)}")
    print(f"messages inside residue chats   : {msg_count}")

    if confirmed_chats:
        print("\n  Confirmed residue chats:")
        for c in confirmed_chats[:10]:
            print(f"    id={c.id:<4} client_id={c.client_id} creator_id={c.creator_id} "
                  f"order_id={c.order_id} last_message={(c.last_message or '')[:48]!r}")
        if len(confirmed_chats) > 10:
            print(f"    ... and {len(confirmed_chats) - 10} more")

    referenced_orders = (
        db.query(Order).filter(Order.id.in_(residue_order_ids)).all()
        if residue_order_ids else []
    )
    residue_orders = []
    protected_orders = []
    for o in referenced_orders:
        dangling = (o.client_id not in live_user_ids) or (
            o.creator_id is not None and o.creator_id not in live_user_ids
        )
        if _is_test_title(o.title) and dangling:
            residue_orders.append(o)
        else:
            protected_orders.append(o)

    print(f"\n-- ORDERS referenced by residue assignments --")
    print(f"referenced by a residue assignment : {len(referenced_orders)}")
    print(f"confirmed residue                  : {len(residue_orders)}")
    print(f"PROTECTED (genuine - NOT deleted)  : {len(protected_orders)}")
    for o in residue_orders[:10]:
        print(f"    residue   id={o.id:<4} title={o.title!r} client_id={o.client_id} "
              f"creator_id={o.creator_id} status={o.status} budget={o.budget}")
    for o in protected_orders[:10]:
        print(f"    PROTECTED id={o.id:<4} title={o.title!r} client_id={o.client_id} "
              f"creator_id={o.creator_id} status={o.status} budget={o.budget}")
    if protected_orders:
        print("\n  These orders share an ID with a deleted test order (SQLite reuses")
        print("  primary keys). They belong to live users and are left untouched.")

    delete_order_ids = {o.id for o in residue_orders}

    total = len(confirmed_assignments) + len(confirmed_chats) + len(residue_orders) + msg_count
    print("\n" + "=" * 72)
    print(f"Rows that WOULD be deleted: {total}")
    print(f"  assignments {len(confirmed_assignments)} | chats {len(confirmed_chats)} "
          f"| messages {msg_count} | orders {len(residue_orders)}")
    print("=" * 72)

    if not args.delete:
        print("\nDRY RUN - nothing was changed.")
        print("Re-run with  --delete --yes-i-am-sure  to remove the confirmed rows.")
        db.close()
        return

    if not args.yes_i_am_sure:
        print("\nREFUSED: --delete also requires --yes-i-am-sure.")
        db.close()
        sys.exit(1)

    if total == 0:
        print("\nNothing to delete.")
        db.close()
        return

    chat_ids = [c.id for c in confirmed_chats]
    if chat_ids:
        db.query(Message).filter(Message.chat_id.in_(chat_ids)).delete(synchronize_session=False)
        db.query(Chat).filter(Chat.id.in_(chat_ids)).delete(synchronize_session=False)
    if confirmed_assignments:
        db.query(Assignment).filter(
            Assignment.id.in_([a.id for a in confirmed_assignments])
        ).delete(synchronize_session=False)
    if delete_order_ids:
        db.query(Order).filter(Order.id.in_(delete_order_ids)).delete(synchronize_session=False)
    db.commit()

    print(f"\nDeleted {total} rows.")
    print(f"Assignments remaining: {db.query(Assignment).count()}")
    print(f"Chats remaining      : {db.query(Chat).count()}")
    print(f"Orders remaining     : {db.query(Order).count()}")
    db.close()

if __name__ == "__main__":
    main()
