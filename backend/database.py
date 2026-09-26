import os
import sqlite3
from contextlib import contextmanager
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
DATABASE_PATH = Path(os.environ.get("STOCKSENSE_DB", ROOT / "stocksense.sqlite3"))


@contextmanager
def connect():
    connection = sqlite3.connect(DATABASE_PATH, timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    connection.execute("PRAGMA journal_mode = WAL")
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def initialize():
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS password_resets (
                email TEXT PRIMARY KEY COLLATE NOCASE,
                code_hash TEXT NOT NULL,
                expires_at INTEGER NOT NULL,
                attempts INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE
            );
            CREATE TABLE IF NOT EXISTS warehouses (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE COLLATE NOCASE,
                code TEXT NOT NULL UNIQUE COLLATE NOCASE,
                address TEXT NOT NULL DEFAULT ''
            );
            CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                code TEXT NOT NULL,
                UNIQUE(warehouse_id, code),
                UNIQUE(warehouse_id, name)
            );
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                sku TEXT NOT NULL UNIQUE COLLATE NOCASE,
                category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
                unit TEXT NOT NULL DEFAULT 'Units',
                reorder_level REAL NOT NULL DEFAULT 10,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS stock_levels (
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                location_id INTEGER NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
                quantity REAL NOT NULL DEFAULT 0 CHECK(quantity >= 0),
                PRIMARY KEY(product_id, location_id)
            );
            CREATE TABLE IF NOT EXISTS operations (
                id INTEGER PRIMARY KEY,
                reference TEXT NOT NULL UNIQUE,
                type TEXT NOT NULL CHECK(type IN ('receipt','delivery','internal','adjustment')),
                status TEXT NOT NULL DEFAULT 'draft'
                    CHECK(status IN ('draft','waiting','ready','done','canceled')),
                partner TEXT NOT NULL DEFAULT '',
                source_location_id INTEGER REFERENCES locations(id),
                destination_location_id INTEGER REFERENCES locations(id),
                scheduled_at TEXT,
                notes TEXT NOT NULL DEFAULT '',
                created_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS operation_lines (
                id INTEGER PRIMARY KEY,
                operation_id INTEGER NOT NULL REFERENCES operations(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id),
                quantity REAL NOT NULL CHECK(quantity >= 0),
                counted_quantity REAL
            );
            CREATE TABLE IF NOT EXISTS ledger (
                id INTEGER PRIMARY KEY,
                operation_id INTEGER NOT NULL REFERENCES operations(id),
                product_id INTEGER NOT NULL REFERENCES products(id),
                from_location_id INTEGER REFERENCES locations(id),
                to_location_id INTEGER REFERENCES locations(id),
                quantity REAL NOT NULL,
                created_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_operations_type_status ON operations(type, status);
            CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger(created_at DESC);
            CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
        """)
        _seed(db)


def _seed(db):
    if db.execute("SELECT COUNT(*) FROM warehouses").fetchone()[0]:
        return
    categories = ["Raw materials", "Finished goods", "Components", "Packaging"]
    db.executemany("INSERT OR IGNORE INTO categories(name) VALUES (?)", [(name,) for name in categories])
    db.execute("INSERT INTO warehouses(name, code, address) VALUES (?, ?, ?)",
               ("Main Warehouse", "WH-MAIN", "1250 Market Street, San Francisco"))
    main_id = db.execute("SELECT id FROM warehouses WHERE code='WH-MAIN'").fetchone()[0]
    for name, code in [("Receiving", "RCV"), ("Main Store", "MAIN"), ("Production Floor", "PROD"), ("Dispatch", "SHIP")]:
        db.execute("INSERT INTO locations(warehouse_id, name, code) VALUES (?, ?, ?)", (main_id, name, code))
    category_ids = {r["name"]: r["id"] for r in db.execute("SELECT * FROM categories")}
    locations = {r["name"]: r["id"] for r in db.execute("SELECT * FROM locations")}
    products = [
        ("Steel Rods", "STL-001", "Raw materials", "kg", 25),
        ("Oak Dining Chair", "CHR-104", "Finished goods", "Units", 12),
        ("Aluminum Sheet", "ALU-012", "Raw materials", "Sheets", 15),
        ("Hex Bolt M8", "BLT-008", "Components", "Units", 100),
        ("Shipping Carton", "PKG-020", "Packaging", "Units", 40),
        ("Desk Lamp", "LMP-205", "Finished goods", "Units", 10),
    ]
    db.executemany(
        "INSERT INTO products(name, sku, category_id, unit, reorder_level) VALUES (?, ?, ?, ?, ?)",
        [(n, s, category_ids[c], u, r) for n, s, c, u, r in products],
    )
    product_ids = {r["sku"]: r["id"] for r in db.execute("SELECT id, sku FROM products")}
    levels = [
        ("STL-001", "Main Store", 245), ("STL-001", "Production Floor", 24),
        ("CHR-104", "Main Store", 48), ("CHR-104", "Dispatch", 8),
        ("ALU-012", "Main Store", 7), ("BLT-008", "Main Store", 860),
        ("PKG-020", "Main Store", 32), ("LMP-205", "Main Store", 0),
    ]
    db.executemany(
        "INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)",
        [(product_ids[sku], locations[loc], qty) for sku, loc, qty in levels],
    )
