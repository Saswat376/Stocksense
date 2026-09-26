# StockSense 📦
Odoo Hackathon 2026


**A modular Inventory Management System (IMS) that digitizes and streamlines stock operations for businesses — replacing manual registers, spreadsheets, and scattered tracking with a centralized, real-time, easy-to-use app.**

---

## 🧩 Problem Statement

Most small and mid-sized businesses still rely on manual registers, Excel sheets, and disconnected tools to track inventory. This leads to stock mismatches, delayed order fulfillment, and poor visibility across warehouses.

**StockSense** solves this by providing a single, centralized platform for managing incoming stock, outgoing stock, internal transfers, and stock adjustments — with real-time updates and full audit history.

---

## 👥 Target Users

- **Inventory Managers** – manage incoming & outgoing stock, oversee reordering rules and categories.
- **Warehouse Staff** – perform transfers, picking, shelving, and stock counting.

---

## ✨ Core Features

### 🔐 Authentication
- Sign up / log in
- OTP-based password reset
- Redirect to Inventory Dashboard on login

### 📊 Dashboard
Landing page with a real-time snapshot of inventory operations.

**KPIs**
- Total Products in Stock
- Low Stock / Out of Stock Items
- Pending Receipts
- Pending Deliveries
- Internal Transfers Scheduled

**Dynamic Filters**
- By document type: Receipts / Delivery / Internal / Adjustments
- By status: Draft, Waiting, Ready, Done, Canceled
- By warehouse or location
- By product category

### 📦 Product Management
- Create/update products (Name, SKU/Code, Category, Unit of Measure, Initial stock)
- Track stock availability per location
- Manage product categories and reordering rules

### 📥 Receipts (Incoming Stock)
1. Create a new receipt
2. Add supplier & products
3. Input quantities received
4. Validate → stock increases automatically

> Example: Receive 50 units of "Steel Rods" → stock +50

### 📤 Delivery Orders (Outgoing Stock)
1. Pick items
2. Pack items
3. Validate → stock decreases automatically

> Example: Sales order for 10 chairs → Delivery order reduces chairs by 10

### 🔁 Internal Transfers
Move stock between locations within the company (e.g., Main Warehouse → Production Floor, Rack A → Rack B). Every movement is logged in the ledger.

### ⚖️ Stock Adjustments
Reconcile mismatches between recorded stock and physical counts:
1. Select product/location
2. Enter counted quantity
3. System auto-updates and logs the adjustment

### 🧭 Navigation
- Products
- Operations → Receipts, Delivery Orders, Inventory Adjustment, Move History, Dashboard
- Settings → Warehouse
- Profile Menu → My Profile, Logout

### 🔔 Additional Features
- Alerts for low stock
- Multi-warehouse support
- SKU search & smart filters

---

## 🗺️ Inventory Flow Example

| Step | Action | Stock Impact |
|------|--------|---------------|
| 1 | Receive 100 kg Steel from vendor | +100 |
| 2 | Internal transfer: Main Store → Production Rack | 0 (location updated) |
| 3 | Deliver 20 kg steel (finished goods) | −20 |
| 4 | Adjust for 3 kg damaged steel | −3 |

All movements are recorded in the **Stock Ledger** for full traceability.

---

## 🎨 Design / Mockup
Mockup: [Excalidraw Link](https://link.excalidraw.com/l/65VNwvy7c4X/3ENvQFu9o8R)

---

## 🛠️ Tech Stack

> _Update this section with the technologies your team is actually using._

- **Frontend:** 
- **Backend:** 
- **Database:** 
- **Authentication:** 
- **Deployment:** 

---

## 🚀 Getting Started



### Installation
```bash
git clone https://github.com/<your-org>/stocksense.git
cd stocksense
# install dependencies
```

### Running the app
```bash
# add run commands here
```

---

## 📁 Project Structure
```
Stocksense/
├── frontend/
├── backend/
├── docs/
└── README.md
```

---


## 📄 License
This project was built for a hackathon submission.
