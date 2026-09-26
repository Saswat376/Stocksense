import hashlib
import json
import sqlite3
import tempfile
import threading
import time
import unittest
from http.server import ThreadingHTTPServer
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from unittest.mock import patch

from backend import database
from backend.server import StockSenseHandler


class InventoryApiTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_override = patch.object(database, "DATABASE_PATH", database.Path(self.temp_dir.name) / "test.sqlite3")
        self.db_override.start()
        database.initialize()
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), StockSenseHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"
        response, status = self.request(
            "/api/auth/signup",
            "POST",
            {"name": "Test Manager", "email": "manager@example.test", "password": "secure-pass-123"},
            authenticated=False,
        )
        self.assertEqual(status, 201)
        self.token = response["token"]

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=2)
        self.db_override.stop()
        self.temp_dir.cleanup()

    def request(self, path, method="GET", body=None, authenticated=True):
        headers = {"Content-Type": "application/json"}
        if authenticated and hasattr(self, "token"):
            headers["Authorization"] = f"Bearer {self.token}"
        request = Request(
            self.base + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=3) as response:
                return json.loads(response.read()), response.status
        except HTTPError as error:
            return json.loads(error.read()), error.code

    def location_and_product(self):
        bootstrap, _ = self.request("/api/bootstrap")
        product = next(item for item in bootstrap["products"] if item["sku"] == "STL-001")
        store = next(location for warehouse in bootstrap["warehouses"] for location in warehouse["locations"] if location["name"] == "Main Store")
        production = next(location for warehouse in bootstrap["warehouses"] for location in warehouse["locations"] if location["name"] == "Production Floor")
        receiving = next(location for warehouse in bootstrap["warehouses"] for location in warehouse["locations"] if location["name"] == "Receiving")
        return bootstrap, product, store, production, receiving

    def test_receipt_updates_location_stock_and_ledger(self):
        before, product, _, _, receiving = self.location_and_product()
        operation, status = self.request("/api/operations", "POST", {
            "type": "receipt",
            "partner": "Acme Steel",
            "destination_location_id": receiving["id"],
            "items": [{"product_id": product["id"], "quantity": 12}],
        })
        self.assertEqual(status, 201)
        _, status = self.request(f"/api/operations/{operation['id']}/validate", "POST", {})
        self.assertEqual(status, 200)
        after, _, _, _, _ = self.location_and_product()
        self.assertEqual(after["kpis"]["products_in_stock"], before["kpis"]["products_in_stock"] + 12)
        movement = next(row for row in after["ledger"] if row["reference"] == operation["reference"])
        self.assertEqual(movement["quantity"], 12)
        self.assertEqual(movement["to_location"], "Receiving")

    def test_internal_transfer_preserves_total_stock(self):
        before, product, store, production, _ = self.location_and_product()
        operation, _ = self.request("/api/operations", "POST", {
            "type": "internal",
            "source_location_id": store["id"],
            "destination_location_id": production["id"],
            "items": [{"product_id": product["id"], "quantity": 8}],
        })
        _, status = self.request(f"/api/operations/{operation['id']}/validate", "POST", {})
        self.assertEqual(status, 200)
        after, moved_product, _, _, _ = self.location_and_product()
        self.assertEqual(after["kpis"]["products_in_stock"], before["kpis"]["products_in_stock"])
        quantities = {level["location"]: level["quantity"] for level in moved_product["locations"]}
        self.assertEqual(quantities["Main Store"], 237)
        self.assertEqual(quantities["Production Floor"], 32)

    def test_delivery_cannot_overdraw_stock(self):
        before, product, store, _, _ = self.location_and_product()
        operation, _ = self.request("/api/operations", "POST", {
            "type": "delivery",
            "source_location_id": store["id"],
            "items": [{"product_id": product["id"], "quantity": 999}],
        })
        response, status = self.request(f"/api/operations/{operation['id']}/validate", "POST", {})
        self.assertEqual(status, 409)
        self.assertIn("Not enough stock", response["error"])
        after, _, _, _, _ = self.location_and_product()
        self.assertEqual(after["kpis"]["products_in_stock"], before["kpis"]["products_in_stock"])
        self.assertEqual(next(row for row in after["operations"] if row["id"] == operation["id"])["status"], "draft")

    def test_adjustment_can_set_counted_stock_to_zero(self):
        before, product, store, _, _ = self.location_and_product()
        operation, _ = self.request("/api/operations", "POST", {
            "type": "adjustment",
            "source_location_id": store["id"],
            "items": [{"product_id": product["id"], "quantity": 0, "counted_quantity": 0}],
        })
        _, status = self.request(f"/api/operations/{operation['id']}/validate", "POST", {})
        self.assertEqual(status, 200)
        after, changed_product, _, _, _ = self.location_and_product()
        self.assertEqual(after["kpis"]["products_in_stock"], before["kpis"]["products_in_stock"] - 245)
        self.assertEqual(next(row for row in changed_product["locations"] if row["location"] == "Main Store")["quantity"], 0)

    def test_password_reset_code_is_one_time_and_changes_password(self):
        email = "manager@example.test"
        code = "143209"
        with database.connect() as db:
            db.execute(
                "INSERT INTO password_resets(email, code_hash, expires_at) VALUES (?, ?, ?)",
                (email, hashlib.sha256(code.encode()).hexdigest(), int(time.time()) + 600),
            )
        _, status = self.request("/api/auth/reset-password", "POST", {
            "email": email, "code": code, "password": "another-secure-456",
        }, authenticated=False)
        self.assertEqual(status, 200)
        _, status = self.request("/api/auth/reset-password", "POST", {
            "email": email, "code": code, "password": "another-secure-456",
        }, authenticated=False)
        self.assertEqual(status, 400)
        result, status = self.request("/api/auth/login", "POST", {
            "email": email, "password": "another-secure-456",
        }, authenticated=False)
        self.assertEqual(status, 200)
        self.assertIn("token", result)


if __name__ == "__main__":
    unittest.main()
