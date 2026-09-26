import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.database import connect, initialize
from backend.inventory import InventoryError, create_operation, operation_detail, validate_operation
from backend.security import hash_password, issue_token, read_token, verify_password

ROOT = Path(__file__).resolve().parent.parent
WEB_ROOT = ROOT / "frontend"
MAX_BODY = 1_000_000


def payload_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length > MAX_BODY:
        raise InventoryError("Request body is too large.", 413)
    if length == 0:
        return {}
    try:
        return json.loads(handler.rfile.read(length).decode("utf-8"))
    except (json.JSONDecodeError, UnicodeDecodeError):
        raise InventoryError("Request body must be valid JSON.")


class StockSenseHandler(BaseHTTPRequestHandler):
    server_version = "StockSense/1.0"

    def log_message(self, fmt, *args):
        print(f"{self.log_date_time_string()} {self.address_string()} {fmt % args}")

    def send_json(self, status, data):
        body = json.dumps(data, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", os.environ.get("STOCKSENSE_ORIGIN", "*"))
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, status, message):
        self.send_json(status, {"error": message})

    def do_OPTIONS(self):
        self.send_json(204, {})

    def do_GET(self):
        path = urlparse(self.path).path.rstrip("/") or "/"
        try:
            if path == "/api/health":
                return self.send_json(200, {"status": "ok", "app": "StockSense"})
            if path.startswith("/api/"):
                user_id = self.require_user()
                with connect() as db:
                    if path == "/api/bootstrap":
                        return self.send_json(200, bootstrap(db, user_id))
                    if path == "/api/profile":
                        return self.send_json(200, dict(db.execute(
                            "SELECT id, name, email, created_at FROM users WHERE id=?", (user_id,)
                        ).fetchone()))
                    if path == "/api/products":
                        return self.send_json(200, products(db))
                    if path == "/api/categories":
                        return self.send_json(200, [dict(r) for r in db.execute("SELECT * FROM categories ORDER BY name")])
                    if path == "/api/warehouses":
                        return self.send_json(200, warehouses(db))
                    if path == "/api/operations":
                        rows = db.execute("SELECT id FROM operations ORDER BY created_at DESC, id DESC").fetchall()
                        return self.send_json(200, [operation_detail(db, row["id"]) for row in rows])
                    if path == "/api/ledger":
                        return self.send_json(200, ledger(db))
                    match = re.fullmatch(r"/api/operations/(\d+)", path)
                    if match:
                        item = operation_detail(db, int(match.group(1)))
                        if not item:
                            return self.send_error_json(404, "Operation not found.")
                        return self.send_json(200, item)
                    return self.send_error_json(404, "API endpoint not found.")
            return self.serve_frontend(path)
        except InventoryError as error:
            self.send_error_json(error.status, str(error))
        except (sqlite3_error(),) as error:
            print(f"Database error: {error}", file=sys.stderr)
            self.send_error_json(500, "The database request could not be completed.")

    def do_POST(self):
        path = urlparse(self.path).path.rstrip("/")
        try:
            body = payload_json(self)
            if path == "/api/auth/signup":
                name = str(body.get("name", "")).strip()
                email = str(body.get("email", "")).strip().lower()
                password = str(body.get("password", ""))
                if len(name) < 2 or len(name) > 80:
                    raise InventoryError("Name must be between 2 and 80 characters.")
                if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
                    raise InventoryError("Enter a valid email address.")
                validate_password(password)
                with connect() as db:
                    try:
                        cursor = db.execute(
                            "INSERT INTO users(name, email, password_hash) VALUES (?, ?, ?)",
                            (name, email, hash_password(password)),
                        )
                    except sqlite3_error() as error:
                        if "UNIQUE constraint failed" in str(error):
                            raise InventoryError("An account with this email already exists.", 409)
                        raise
                    user = {"id": cursor.lastrowid, "name": name, "email": email}
                return self.send_json(201, {"token": issue_token(user["id"]), "user": user})
            if path == "/api/auth/login":
                email = str(body.get("email", "")).strip().lower()
                password = str(body.get("password", ""))
                with connect() as db:
                    user = db.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
                if not user or not verify_password(password, user["password_hash"]):
                    raise InventoryError("Email or password is incorrect.", 401)
                return self.send_json(200, {
                    "token": issue_token(user["id"]),
                    "user": {"id": user["id"], "name": user["name"], "email": user["email"]},
                })
            if path == "/api/auth/forgot-password":
                email = str(body.get("email", "")).strip().lower()
                code = f"{secrets.randbelow(1_000_000):06}"
                with connect() as db:
                    user = db.execute("SELECT id FROM users WHERE email=?", (email,)).fetchone()
                    if user:
                        digest = hashlib.sha256(code.encode()).hexdigest()
                        db.execute(
                            """INSERT INTO password_resets(email, code_hash, expires_at, attempts)
                            VALUES (?, ?, ?, 0) ON CONFLICT(email) DO UPDATE SET
                            code_hash=excluded.code_hash, expires_at=excluded.expires_at, attempts=0""",
                            (email, digest, int(time.time()) + 600),
                        )
                        print(f"Password reset code for {email}: {code}", flush=True)
                return self.send_json(200, {"message": "If that account exists, a reset code has been issued. In local development, check the API terminal."})
            if path == "/api/auth/reset-password":
                email = str(body.get("email", "")).strip().lower()
                code = str(body.get("code", "")).strip()
                password = str(body.get("password", ""))
                validate_password(password)
                with connect() as db:
                    reset = db.execute("SELECT * FROM password_resets WHERE email=?", (email,)).fetchone()
                    if not reset or reset["expires_at"] < time.time() or reset["attempts"] >= 5:
                        raise InventoryError("Reset code is invalid or expired.", 400)
                    submitted = hashlib.sha256(code.encode()).hexdigest()
                    if not hmac.compare_digest(submitted, reset["code_hash"]):
                        db.execute("UPDATE password_resets SET attempts=attempts + 1 WHERE email=?", (email,))
                        db.commit()
                        raise InventoryError("Reset code is invalid or expired.", 400)
                    db.execute("UPDATE users SET password_hash=? WHERE email=?", (hash_password(password), email))
                    db.execute("DELETE FROM password_resets WHERE email=?", (email,))
                return self.send_json(200, {"message": "Password updated. You can now sign in."})
            user_id = self.require_user()
            with connect() as db:
                if path == "/api/operations":
                    operation_id = create_operation(db, user_id, body)
                    return self.send_json(201, operation_detail(db, operation_id))
                match = re.fullmatch(r"/api/operations/(\d+)/validate", path)
                if match:
                    with db:
                        validate_operation(db, int(match.group(1)), user_id)
                    return self.send_json(200, operation_detail(db, int(match.group(1))))
                match = re.fullmatch(r"/api/operations/(\d+)/status", path)
                if match:
                    operation = db.execute("SELECT status FROM operations WHERE id=?", (int(match.group(1)),)).fetchone()
                    if not operation:
                        raise InventoryError("Operation not found.", 404)
                    status = str(body.get("status", ""))
                    if status not in {"waiting", "ready", "canceled"}:
                        raise InventoryError("Choose waiting, ready, or canceled.")
                    if operation["status"] in {"done", "canceled"}:
                        raise InventoryError("Completed or canceled operations cannot be changed.", 409)
                    db.execute("UPDATE operations SET status=? WHERE id=?", (status, int(match.group(1))))
                    return self.send_json(200, operation_detail(db, int(match.group(1))))
            return self.send_error_json(404, "API endpoint not found.")
        except InventoryError as error:
            self.send_error_json(error.status, str(error))
        except (sqlite3_error(),) as error:
            print(f"Database error: {error}", file=sys.stderr)
            self.send_error_json(500, "The database request could not be completed.")

    def do_PATCH(self):
        path = urlparse(self.path).path.rstrip("/")
        try:
            user_id = self.require_user()
            body = payload_json(self)
            with connect() as db:
                if path == "/api/profile":
                    name = str(body.get("name", "")).strip()
                    if len(name) < 2 or len(name) > 80:
                        raise InventoryError("Name must be between 2 and 80 characters.")
                    db.execute("UPDATE users SET name=? WHERE id=?", (name, user_id))
                    return self.send_json(200, dict(db.execute(
                        "SELECT id, name, email, created_at FROM users WHERE id=?", (user_id,)
                    ).fetchone()))
                match = re.fullmatch(r"/api/products/(\d+)", path)
                if match:
                    product_id = int(match.group(1))
                    product = db.execute("SELECT * FROM products WHERE id=?", (product_id,)).fetchone()
                    if not product:
                        raise InventoryError("Product not found.", 404)
                    name = str(body.get("name", product["name"])).strip()
                    sku = str(body.get("sku", product["sku"])).strip()
                    unit = str(body.get("unit", product["unit"])).strip()
                    category_id = body.get("category_id", product["category_id"])
                    reorder = float(body.get("reorder_level", product["reorder_level"]))
                    if not name or not sku or not unit or reorder < 0:
                        raise InventoryError("Enter a name, SKU, unit, and non-negative reorder point.")
                    db.execute(
                        "UPDATE products SET name=?, sku=?, unit=?, category_id=?, reorder_level=? WHERE id=?",
                        (name, sku, unit, category_id or None, reorder, product_id),
                    )
                    return self.send_json(200, next(p for p in products(db) if p["id"] == product_id))
            return self.send_error_json(404, "API endpoint not found.")
        except InventoryError as error:
            self.send_error_json(error.status, str(error))
        except (ValueError, sqlite3_error()) as error:
            message = str(error)
            status = 409 if "UNIQUE constraint failed" in message else 400
            self.send_error_json(status, "A product with this SKU already exists." if status == 409 else "Invalid product data.")

    def do_PUT(self):
        path = urlparse(self.path).path.rstrip("/")
        try:
            user_id = self.require_user()
            body = payload_json(self)
            with connect() as db:
                if path == "/api/products":
                    name = str(body.get("name", "")).strip()
                    sku = str(body.get("sku", "")).strip()
                    unit = str(body.get("unit", "Units")).strip()
                    category_id = body.get("category_id") or None
                    reorder = float(body.get("reorder_level", 10))
                    if not name or not sku or not unit or reorder < 0:
                        raise InventoryError("Enter a name, SKU, unit, and non-negative reorder point.")
                    cursor = db.execute(
                        "INSERT INTO products(name, sku, category_id, unit, reorder_level) VALUES (?, ?, ?, ?, ?)",
                        (name, sku, category_id, unit, reorder),
                    )
                    product_id = cursor.lastrowid
                    initial_stock = body.get("initial_stock") or []
                    if isinstance(initial_stock, (int, float)):
                        initial_stock = [{"location_id": body.get("location_id"), "quantity": initial_stock}]
                    for level in initial_stock:
                        quantity = float(level.get("quantity", 0))
                        location_id = int(level["location_id"])
                        if quantity < 0:
                            raise InventoryError("Initial stock cannot be negative.")
                        db.execute("INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)",
                                   (product_id, location_id, quantity))
                    return self.send_json(201, next(p for p in products(db) if p["id"] == product_id))
                if path == "/api/categories":
                    name = str(body.get("name", "")).strip()
                    if not name:
                        raise InventoryError("Category name is required.")
                    cursor = db.execute("INSERT INTO categories(name) VALUES (?)", (name,))
                    return self.send_json(201, {"id": cursor.lastrowid, "name": name})
                if path == "/api/warehouses":
                    name = str(body.get("name", "")).strip()
                    code = str(body.get("code", "")).strip().upper()
                    address = str(body.get("address", "")).strip()
                    location_name = str(body.get("location_name", "Main Store")).strip()
                    location_code = str(body.get("location_code", "MAIN")).strip().upper()
                    if not name or not code or not location_name or not location_code:
                        raise InventoryError("Warehouse and initial location names and codes are required.")
                    cursor = db.execute("INSERT INTO warehouses(name, code, address) VALUES (?, ?, ?)", (name, code, address))
                    warehouse_id = cursor.lastrowid
                    db.execute("INSERT INTO locations(warehouse_id, name, code) VALUES (?, ?, ?)",
                               (warehouse_id, location_name, location_code))
                    return self.send_json(201, next(w for w in warehouses(db) if w["id"] == warehouse_id))
            return self.send_error_json(404, "API endpoint not found.")
        except InventoryError as error:
            self.send_error_json(error.status, str(error))
        except (ValueError, KeyError, sqlite3_error()) as error:
            status = 409 if "UNIQUE constraint failed" in str(error) else 400
            self.send_error_json(status, "That SKU, category, or warehouse code already exists." if status == 409 else "Invalid data submitted.")

    def require_user(self):
        authorization = self.headers.get("Authorization", "")
        if not authorization.startswith("Bearer "):
            raise InventoryError("Please sign in to continue.", 401)
        user_id = read_token(authorization[7:])
        if not user_id:
            raise InventoryError("Your session has expired. Please sign in again.", 401)
        return user_id

    def serve_frontend(self, path):
        relative = "index.html" if path == "/" else path.lstrip("/")
        file_path = (WEB_ROOT / relative).resolve()
        if not file_path.is_relative_to(WEB_ROOT.resolve()) or not file_path.is_file():
            file_path = WEB_ROOT / "index.html"
        content_type = {
            ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8", ".svg": "image/svg+xml",
        }.get(file_path.suffix, "application/octet-stream")
        data = file_path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)


def sqlite3_error():
    import sqlite3
    return sqlite3.Error


def validate_password(password):
    if len(password) < 8 or len(password) > 128:
        raise InventoryError("Password must be between 8 and 128 characters.")


def products(db):
    rows = db.execute(
        """SELECT p.id, p.name, p.sku, p.category_id, c.name AS category,
        p.unit, p.reorder_level, COALESCE(SUM(s.quantity), 0) AS total_stock
        FROM products p LEFT JOIN categories c ON c.id=p.category_id
        LEFT JOIN stock_levels s ON s.product_id=p.id
        GROUP BY p.id ORDER BY p.name"""
    ).fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["locations"] = [dict(location) for location in db.execute(
            """SELECT s.location_id, l.name AS location, w.name AS warehouse, s.quantity
            FROM stock_levels s JOIN locations l ON l.id=s.location_id
            JOIN warehouses w ON w.id=l.warehouse_id WHERE s.product_id=? ORDER BY w.name, l.name""",
            (item["id"],),
        )]
        result.append(item)
    return result


def warehouses(db):
    result = []
    for row in db.execute("SELECT * FROM warehouses ORDER BY name"):
        item = dict(row)
        item["locations"] = [dict(location) for location in db.execute(
            "SELECT id, name, code FROM locations WHERE warehouse_id=? ORDER BY name", (item["id"],)
        )]
        result.append(item)
    return result


def ledger(db):
    return [dict(row) for row in db.execute(
        """SELECT l.id, l.operation_id, l.created_at, l.quantity, o.reference, o.type, p.name AS product,
        p.sku, sl.name AS from_location, sw.name AS from_warehouse,
        dl.name AS to_location, dw.name AS to_warehouse, u.name AS performed_by
        FROM ledger l JOIN operations o ON o.id=l.operation_id JOIN products p ON p.id=l.product_id
        LEFT JOIN locations sl ON sl.id=l.from_location_id LEFT JOIN warehouses sw ON sw.id=sl.warehouse_id
        LEFT JOIN locations dl ON dl.id=l.to_location_id LEFT JOIN warehouses dw ON dw.id=dl.warehouse_id
        LEFT JOIN users u ON u.id=l.created_by ORDER BY l.created_at DESC, l.id DESC"""
    )]


def bootstrap(db, user_id):
    all_products = products(db)
    operations = [operation_detail(db, r["id"]) for r in db.execute(
        "SELECT id FROM operations ORDER BY created_at DESC, id DESC"
    )]
    levels = db.execute(
        """SELECT p.id, p.reorder_level, COALESCE(SUM(s.quantity), 0) AS quantity
        FROM products p LEFT JOIN stock_levels s ON s.product_id=p.id GROUP BY p.id"""
    ).fetchall()
    low = sum(1 for r in levels if 0 < r["quantity"] <= r["reorder_level"])
    out = sum(1 for r in levels if r["quantity"] == 0)
    return {
        "user": dict(db.execute("SELECT id, name, email, created_at FROM users WHERE id=?", (user_id,)).fetchone()),
        "products": all_products,
        "categories": [dict(r) for r in db.execute("SELECT * FROM categories ORDER BY name")],
        "warehouses": warehouses(db),
        "operations": operations,
        "ledger": ledger(db),
        "kpis": {
            "products_in_stock": sum(r["total_stock"] for r in all_products),
            "product_count": len(all_products),
            "low_stock": low,
            "out_of_stock": out,
            "pending_receipts": sum(1 for o in operations if o["type"] == "receipt" and o["status"] not in ("done", "canceled")),
            "pending_deliveries": sum(1 for o in operations if o["type"] == "delivery" and o["status"] not in ("done", "canceled")),
            "scheduled_transfers": sum(1 for o in operations if o["type"] == "internal" and o["status"] not in ("done", "canceled")),
        },
    }


def main():
    initialize()
    host = os.environ.get("STOCKSENSE_HOST", "127.0.0.1")
    port = int(os.environ.get("PORT", os.environ.get("STOCKSENSE_PORT", "8000")))
    server = ThreadingHTTPServer((host, port), StockSenseHandler)
    print(f"StockSense is running at http://{host}:{port}", flush=True)
    if not os.environ.get("STOCKSENSE_SECRET"):
        print("Warning: Set STOCKSENSE_SECRET to a strong random secret before deployment.", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down StockSense.", flush=True)
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
