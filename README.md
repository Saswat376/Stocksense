# StockSense

StockSense is a modular inventory management system for keeping products, stock operations, multiple warehouses, and movement history in one place.

## Features

- Sign up, sign in, and one-time-code password recovery
- Inventory dashboard with stock totals, reorder alerts, open receipts and deliveries, and scheduled transfers
- Product catalog with categories, SKU search, per-location availability, and reorder points
- Receipt, delivery, internal transfer, and physical-count adjustment workflows
- Stock validation with negative-stock protection and an auditable stock ledger
- Multiple warehouses and locations
- Profile management and CSV exports
- Responsive interface for desktop, tablet, and mobile

## Requirements

- Python 3.10 or later (Python 3.13 recommended)
- Node.js is optional and only needed to use the npm convenience commands

The backend and frontend use Python's and the browser's built-in features. No third-party packages are required.

## Run locally

From the repository root:

```bash
python backend/server.py
```

Or, with Node.js installed:

```bash
npm start
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000), create an account, and start managing inventory. The first start creates `stocksense.sqlite3` and seeds example categories, a warehouse, locations, and products. User accounts and stock changes are stored locally in that SQLite database.

Password recovery codes are printed to the server terminal in local development. The code expires after 10 minutes and is limited to five attempts. Configure an email delivery provider before deploying a production installation.

## Configuration

| Environment variable | Default | Description |
| --- | --- | --- |
| `STOCKSENSE_HOST` | `127.0.0.1` | Interface address for the web server |
| `STOCKSENSE_PORT` / `PORT` | `8000` | HTTP port |
| `STOCKSENSE_DB` | `./stocksense.sqlite3` | SQLite database path |
| `STOCKSENSE_SECRET` | Local-only development secret | HMAC signing secret for sessions; set a long random value in production |
| `STOCKSENSE_ORIGIN` | `*` | Allowed browser origin for API requests |

The local default host limits access to the local machine. Before exposing the app to a network, set a strong `STOCKSENSE_SECRET`, configure an explicit allowed origin, and serve it behind HTTPS.

## Inventory workflow

1. Create a receipt, delivery, transfer, or adjustment.
2. Add one or more products and their quantities; select the appropriate location(s).
3. Save a receipt, delivery, or transfer as ready, then open it and validate it to apply the stock change.
4. Creating an adjustment immediately reconciles the location's on-hand quantity to the entered physical count.
5. Review every validated movement in **Stock ledger**.

Receipts increase stock, deliveries decrease stock, transfers change location balances without changing the overall total, and adjustments set the counted location quantity. Deliveries and transfers cannot reduce a location below zero.

## Tests

Run the backend/API integration tests with:

```bash
python -m unittest discover -s backend -p "test_*.py" -v
```

The tests cover authentication and password recovery, receipts, transfers, adjustment-to-zero, negative-stock protection, and ledger recording.

## Project layout

```text
backend/
  database.py       SQLite schema, initialization, and sample inventory
  inventory.py      Stock operation rules and validation
  security.py       Password hashing and signed session tokens
  server.py         HTTP API and static frontend server
  test_inventory.py API integration tests
frontend/
  index.html        Application entry point
  app.js            Inventory screens, forms, and interactions
  api.js            Authenticated API client
  styles.css        Responsive application design
```

## API overview

All inventory endpoints require a bearer token obtained from `/api/auth/signup` or `/api/auth/login`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/signup`, `/api/auth/login` | Create an account or start a session |
| `POST` | `/api/auth/forgot-password`, `/api/auth/reset-password` | Request and redeem a one-time reset code |
| `GET` | `/api/bootstrap` | Load dashboard, products, locations, operations, and ledger |
| `GET`, `PUT` | `/api/products` | List and create products |
| `PATCH` | `/api/products/{id}` | Edit product details |
| `GET`, `PUT` | `/api/categories` | List and create categories |
| `GET`, `PUT` | `/api/warehouses` | List and create warehouses with an initial location |
| `GET`, `POST` | `/api/operations` | List and create stock operations |
| `POST` | `/api/operations/{id}/status` | Move an open operation to waiting, ready, or canceled |
| `POST` | `/api/operations/{id}/validate` | Apply stock changes and record ledger entries |
| `GET` | `/api/ledger` | Retrieve the stock movement history |
| `GET`, `PATCH` | `/api/profile` | View and update the signed-in profile |
