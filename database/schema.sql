-- ===================== WAREHOUSES / LOCATIONS =====================
CREATE TABLE warehouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    short_code TEXT UNIQUE NOT NULL,
    address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID REFERENCES warehouses(id) ON DELETE CASCADE, 
    name TEXT NOT NULL,
    short_code TEXT NOT NULL,
    location_type TEXT NOT NULL DEFAULT 'internal'
        CHECK (location_type IN ('internal','vendor','customer','inventory_loss')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (warehouse_id, short_code)
);

-- ===================== PARTNERS (vendors/customers/contacts) =====================
CREATE TABLE partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('vendor','customer','internal')),
    email TEXT,
    phone TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================== PRODUCTS =====================
CREATE TABLE product_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    sku TEXT UNIQUE NOT NULL,
    category_id UUID REFERENCES product_categories(id),
    uom TEXT NOT NULL DEFAULT 'unit',
    cost_per_unit NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_min NUMERIC(12,2) NOT NULL DEFAULT 0,
    reorder_max NUMERIC(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================== STOCK (current on-hand per product per location) =====================
CREATE TABLE stock_quants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
    quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    reserved_quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, location_id)
);

-- ===================== SEQUENCES (per warehouse+operation reference numbers) =====================
CREATE TABLE reference_sequences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
    operation_type TEXT NOT NULL, -- IN | OUT | INT | ADJ
    next_number INTEGER NOT NULL DEFAULT 1,
    UNIQUE (warehouse_id, operation_type)
);

-- ===================== STOCK MOVES (Receipt / Delivery / Internal / Adjustment) =====================
CREATE TABLE stock_moves (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference TEXT UNIQUE, -- e.g. WH/IN/0001, auto-generated
    move_type TEXT NOT NULL CHECK (move_type IN ('receipt','delivery','internal','adjustment')),
    warehouse_id UUID NOT NULL REFERENCES warehouses(id),
    source_location_id UUID REFERENCES locations(id),
    dest_location_id UUID REFERENCES locations(id),
    partner_id UUID REFERENCES partners(id),          -- "Contact"
    responsible_id UUID REFERENCES users(id),          -- auto-filled with logged-in user
    delivery_address TEXT,                              -- delivery form only
    operation_type TEXT,                                 -- delivery form dropdown (e.g. outgoing/return)
    scheduled_date DATE,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','waiting','ready','done','cancelled')),
    -- receipt flow:  draft -> ready -> done
    -- delivery flow: draft -> waiting -> ready -> done
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    validated_at TIMESTAMPTZ
);

CREATE TABLE stock_move_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_id UUID NOT NULL REFERENCES stock_moves(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id),
    quantity NUMERIC(14,2) NOT NULL,       -- planned qty
    done_quantity NUMERIC(14,2) NOT NULL DEFAULT 0 -- actual qty on validate
);

-- ===================== STOCK LEDGER (immutable log = Move History) =====================
CREATE TABLE stock_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    move_id UUID REFERENCES stock_moves(id),
    product_id UUID NOT NULL REFERENCES products(id),
    from_location_id UUID REFERENCES locations(id),
    to_location_id UUID REFERENCES locations(id),
    quantity NUMERIC(14,2) NOT NULL,
    moved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ===================== INDEXES =====================
CREATE INDEX idx_stock_quants_product ON stock_quants(product_id);
CREATE INDEX idx_stock_quants_location ON stock_quants(location_id);
CREATE INDEX idx_moves_status ON stock_moves(status);
CREATE INDEX idx_moves_type ON stock_moves(move_type);
CREATE INDEX idx_move_lines_move ON stock_move_lines(move_id);
CREATE INDEX idx_ledger_product ON stock_ledger(product_id);
CREATE INDEX idx_locations_warehouse ON locations(warehouse_id);
