from datetime import date, datetime, timedelta

from sqlmodel import Session, select

from db import engine
from models import AppSetting, Customer, Invoice, Subscription


CUSTOMERS = [
    ("CUST-001", "Apex Retail Pvt Ltd", "Enterprise", "active"),
    ("CUST-002", "Northwind Traders", "Mid-market", "active"),
    ("CUST-003", "Initech Systems", "SMB", "at_risk"),
    ("CUST-004", "Globex Corporation", "Enterprise", "active"),
    ("CUST-005", "Soylent Industries", "Mid-market", "new"),
    ("CUST-006", "Umbrella Logistics", "SMB", "active"),
    ("CUST-007", "Stark Manufacturing", "Enterprise", "active"),
    ("CUST-008", "Wayne Holdings", "Mid-market", "new"),
]

INVOICES = [
    ("INV-0001", "CUST-001", 248000, "paid",     -20, "UPI"),
    ("INV-0002", "CUST-001", 312500, "sent",       2, "Bank transfer"),
    ("INV-0003", "CUST-002",  84500, "paid",     -14, "Card"),
    ("INV-0004", "CUST-002",  62000, "overdue", -10, "Bank transfer"),
    ("INV-0005", "CUST-003",  18500, "draft",    14, "-"),
    ("INV-0006", "CUST-003",  21000, "sent",      4, "UPI"),
    ("INV-0007", "CUST-004", 540000, "paid",     -7, "Bank transfer"),
    ("INV-0008", "CUST-004", 478000, "sent",      9, "Bank transfer"),
    ("INV-0009", "CUST-005", 132000, "paid",     -2, "Card"),
    ("INV-0010", "CUST-005",  96000, "draft",    21, "-"),
    ("INV-0011", "CUST-006",  44000, "sent",      6, "UPI"),
    ("INV-0012", "CUST-006",  38500, "overdue", -18, "UPI"),
    ("INV-0013", "CUST-007", 712000, "paid",    -30, "Bank transfer"),
    ("INV-0014", "CUST-007", 689000, "sent",     12, "Bank transfer"),
    ("INV-0015", "CUST-008", 152000, "draft",    28, "-"),
    ("INV-0016", "CUST-008", 165000, "sent",      3, "Card"),
    ("INV-0017", "CUST-002",  72500, "paid",     -5, "UPI"),
    ("INV-0018", "CUST-004", 410000, "paid",    -45, "Bank transfer"),
    ("INV-0019", "CUST-007", 528000, "overdue", -22, "Bank transfer"),
    ("INV-0020", "CUST-001", 295000, "draft",    14, "-"),
]

SUBSCRIPTIONS = [
    ("SUB-0001", "Enterprise", "CUST-001", 49999, "active"),
    ("SUB-0002", "Growth",     "CUST-002", 14999, "active"),
    ("SUB-0003", "Starter",    "CUST-003",  4999, "past_due"),
    ("SUB-0004", "Enterprise", "CUST-004", 89999, "active"),
    ("SUB-0005", "Growth",     "CUST-007", 24999, "active"),
    ("SUB-0006", "Starter",    "CUST-008",  6999, "active"),
]


def seed_if_empty() -> None:
    with Session(engine) as session:
        if not session.get(AppSetting, 1):
            session.add(AppSetting(
                id=1,
                company_name="FluxBill",
                invoice_prefix="INV",
                updated_at=datetime.utcnow(),
            ))
            session.commit()

        if session.exec(select(Customer)).first() is None:
            invoice_counts = {cid: 0 for cid, *_ in CUSTOMERS}
            for _, customer_ref, *_ in INVOICES:
                invoice_counts[customer_ref] = invoice_counts.get(customer_ref, 0) + 1
            for cid, name, tier, status in CUSTOMERS:
                session.add(Customer(
                    id=cid,
                    name=name,
                    tier=tier,
                    status=status,
                    invoices=invoice_counts.get(cid, 0),
                    created_at=datetime.utcnow(),
                ))
            session.commit()

        if session.exec(select(Invoice)).first() is None:
            today = date.today()
            for inv_id, customer_ref, amount, status, due_offset_days, method in INVOICES:
                created = today + timedelta(days=min(due_offset_days, 0) - 14)
                due = today + timedelta(days=due_offset_days)
                session.add(Invoice(
                    id=inv_id,
                    customer=customer_ref,
                    amount=amount,
                    currency="INR",
                    status=status,
                    created=created,
                    due=due,
                    method=method,
                ))
            session.commit()

        if session.exec(select(Subscription)).first() is None:
            for sub_id, plan, customer_ref, mrr, status in SUBSCRIPTIONS:
                session.add(Subscription(
                    id=sub_id,
                    plan=plan,
                    customer=customer_ref,
                    mrr=mrr,
                    status=status,
                    created_at=datetime.utcnow(),
                ))
            session.commit()
