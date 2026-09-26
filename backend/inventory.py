import sqlite3
from datetime import datetime, timezone


OPERATION_TYPES = {"receipt", "delivery", "internal", "adjustment"}
STATUSES = {"draft", "waiting", "ready", "done", "canceled"}


class InventoryError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def row_dict(row):
    return dict(row) if row else None


def _location(db, value, label, required):
    if value is None and not required:
        return None
    if value is None:
        raise InventoryError(f"{label} is required.")
    if not db.execute("SELECT id FROM locations WHERE id=?", (value,)).fetchone():
        raise InventoryError(f"{label} was not found.", 404)
    return value


def create_operation(db, user_id, payload):
    kind = str(payload.get("type", "")).lower()
    if kind not in OPERATION_TYPES:
        raise InventoryError("Choose a valid operation type.")
    items = payload.get("items")
    if not isinstance(items, list) or not items:
        raise InventoryError("Add at least one product.")

    source_required = kind in {"delivery", "internal", "adjustment"}
    destination_required = kind in {"receipt", "internal"}
    source_id = _location(db, payload.get("source_location_id"), "Source location", source_required)
    destination_id = _location(db, payload.get("destination_location_id"), "Destination location", destination_required)
    if kind == "internal" and source_id == destination_id:
        raise InventoryError("Choose different source and destination locations.")

    reference_prefix = {"receipt": "REC", "delivery": "DEL", "internal": "TRF", "adjustment": "ADJ"}[kind]
    date_code = datetime.now(timezone.utc).strftime("%y%m%d")
    next_number = db.execute("SELECT COUNT(*) FROM operations WHERE reference LIKE ?", (f"{reference_prefix}-{date_code}-%",)).fetchone()[0] + 1
    reference = f"{reference_prefix}-{date_code}-{next_number:03}"
    cursor = db.execute(
        """INSERT INTO operations(reference, type, partner, source_location_id,
        destination_location_id, scheduled_at, notes, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (reference, kind, str(payload.get("partner", "")).strip(), source_id,
         destination_id, payload.get("scheduled_at") or None,
         str(payload.get("notes", "")).strip(), user_id),
    )
    operation_id = cursor.lastrowid
    for item in items:
        try:
            product_id = int(item.get("product_id"))
            quantity = float(item.get("quantity"))
            counted = float(item["counted_quantity"]) if item.get("counted_quantity") is not None else None
        except (TypeError, ValueError):
            raise InventoryError("Each product needs a valid quantity.")
        if quantity < 0 or (kind != "adjustment" and quantity == 0):
            raise InventoryError("Quantities must be greater than zero.")
        if not db.execute("SELECT id FROM products WHERE id=?", (product_id,)).fetchone():
            raise InventoryError("A selected product was not found.", 404)
        if kind == "adjustment" and (counted is None or counted < 0):
            raise InventoryError("Enter the physical counted quantity for each adjustment.")
        db.execute(
            "INSERT INTO operation_lines(operation_id, product_id, quantity, counted_quantity) VALUES (?, ?, ?, ?)",
            (operation_id, product_id, quantity, counted),
        )
    return operation_id


def validate_operation(db, operation_id, user_id):
    operation = db.execute("SELECT * FROM operations WHERE id=?", (operation_id,)).fetchone()
    if not operation:
        raise InventoryError("Operation not found.", 404)
    if operation["status"] == "done":
        raise InventoryError("This operation has already been validated.", 409)
    if operation["status"] == "canceled":
        raise InventoryError("Canceled operations cannot be validated.", 409)
    lines = db.execute("SELECT * FROM operation_lines WHERE operation_id=?", (operation_id,)).fetchall()
    if not lines:
        raise InventoryError("Add at least one product before validating.")

    kind = operation["type"]
    source = operation["source_location_id"]
    destination = operation["destination_location_id"]
    for line in lines:
        product_id = line["product_id"]
        quantity = line["quantity"]
        if kind == "adjustment":
            existing = db.execute(
                "SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?",
                (product_id, source),
            ).fetchone()
            current = existing["quantity"] if existing else 0
            difference = line["counted_quantity"] - current
        elif kind in {"delivery", "internal"}:
            existing = db.execute(
                "SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?",
                (product_id, source),
            ).fetchone()
            available = existing["quantity"] if existing else 0
            if available < quantity:
                product = db.execute("SELECT name FROM products WHERE id=?", (product_id,)).fetchone()
                raise InventoryError(f"Not enough stock for {product['name']} at the source location (available: {available:g}).", 409)

    for line in lines:
        product_id = line["product_id"]
        quantity = line["quantity"]
        if kind == "adjustment":
            existing = db.execute(
                "SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?",
                (product_id, source),
            ).fetchone()
            current = existing["quantity"] if existing else 0
            difference = line["counted_quantity"] - current
            db.execute(
                """INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)
                ON CONFLICT(product_id, location_id) DO UPDATE SET quantity=excluded.quantity""",
                (product_id, source, line["counted_quantity"]),
            )
            db.execute(
                "INSERT INTO ledger(operation_id, product_id, from_location_id, to_location_id, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)",
                (operation_id, product_id, source if difference < 0 else None,
                 source if difference > 0 else None, difference, user_id),
            )
        elif kind == "receipt":
            _change_stock(db, product_id, destination, quantity)
            _ledger(db, operation_id, product_id, None, destination, quantity, user_id)
        elif kind == "delivery":
            _change_stock(db, product_id, source, -quantity)
            _ledger(db, operation_id, product_id, source, None, -quantity, user_id)
        else:
            _change_stock(db, product_id, source, -quantity)
            _change_stock(db, product_id, destination, quantity)
            _ledger(db, operation_id, product_id, source, destination, quantity, user_id)
    db.execute("UPDATE operations SET status='done' WHERE id=?", (operation_id,))


def _change_stock(db, product_id, location_id, amount):
    updated = db.execute(
        "UPDATE stock_levels SET quantity=quantity + ? WHERE product_id=? AND location_id=?",
        (amount, product_id, location_id),
    )
    if updated.rowcount == 0:
        db.execute(
            "INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)",
            (product_id, location_id, amount),
        )


def _ledger(db, operation_id, product_id, source, destination, quantity, user_id):
    db.execute(
        "INSERT INTO ledger(operation_id, product_id, from_location_id, to_location_id, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)",
        (operation_id, product_id, source, destination, quantity, user_id),
    )


def operation_detail(db, operation_id):
    row = db.execute(
        """SELECT o.*, sl.name AS source_location, sw.name AS source_warehouse,
        dl.name AS destination_location, dw.name AS destination_warehouse
        FROM operations o
        LEFT JOIN locations sl ON sl.id=o.source_location_id
        LEFT JOIN warehouses sw ON sw.id=sl.warehouse_id
        LEFT JOIN locations dl ON dl.id=o.destination_location_id
        LEFT JOIN warehouses dw ON dw.id=dl.warehouse_id
        WHERE o.id=?""",
        (operation_id,),
    ).fetchone()
    if not row:
        return None
    result = dict(row)
    result["items"] = [dict(line) for line in db.execute(
        """SELECT ol.id, ol.product_id, p.name AS product_name, p.sku, p.unit,
        ol.quantity, ol.counted_quantity
        FROM operation_lines ol JOIN products p ON p.id=ol.product_id
        WHERE ol.operation_id=?""",
        (operation_id,),
    )]
    return result
