# StockSense

Inventory management application with a React frontend, Node.js/Express REST API, and PostgreSQL database.

## Project layout

- `frontend/` React app (Vite, React Router)
- `backend/` Express API, JWT auth, PostgreSQL access via `pg`
- `database/` PostgreSQL schema and migrations

## Getting started

1. Install Node.js (LTS) and PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and configure the database and JWT secret.
3. Create the database named in `DATABASE_URL`, then apply `database/schema.sql`.
4. In separate terminals, run `npm install && npm run dev` from `backend/` and `frontend/`.

The API is served at `http://localhost:5000/api`; Vite runs at `http://localhost:5173`.
