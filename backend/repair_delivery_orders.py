"""
Repair script: for any existing approved delivery submission where
the linked order is still in-progress, advance the order to 'delivered'.
Safe and idempotent — only touches orders with an approved delivery
that are in a pre-delivery state.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal
from app.models.delivery import DeliverySubmission
from app.models.order import Order

db = SessionLocal()

approved = db.query(DeliverySubmission).filter(
    DeliverySubmission.status == "approved"
).all()

repaired = 0
for d in approved:
    order = db.query(Order).filter(Order.id == d.order_id).first()
    if order and order.status in ("in_progress", "assigned", "accepted", "revision_requested"):
        print(f"  Repairing order #{order.id}: {order.status!r} -> 'delivered'  (delivery #{d.id} v{d.version_number})")
        setattr(order, "status", "delivered")
        repaired += 1

db.commit()
print(f"\nDone. {repaired} order(s) repaired.")

print("\nFinal state of approved deliveries:")
for d in approved:
    order = db.query(Order).filter(Order.id == d.order_id).first()
    print(f"  Delivery #{d.id} order #{d.order_id} v{d.version_number}  delivery.status={d.status!r}  order.status={order.status if order else 'N/A'!r}")

db.close()
