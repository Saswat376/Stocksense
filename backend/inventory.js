import { connect } from './db.js';
import { Database } from 'better-sqlite3';
import { randomUUID } from 'crypto';

const OP_TYPES = new Set(['receipt','delivery','internal','adjustment']);

function rowToObject(row) { return row || null; }

export function products() {
  const db = connect();
  try {
    const rows = db.prepare(`SELECT p.id, p.name, p.sku, p.category_id, c.name AS category,
      p.unit, p.reorder_level, COALESCE(SUM(s.quantity),0) AS total_stock
      FROM products p LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN stock_levels s ON s.product_id=p.id
      GROUP BY p.id ORDER BY p.name`).all();
    const result = rows.map(r => {
      const locations = db.prepare(`SELECT s.location_id, l.name AS location, w.name AS warehouse, s.quantity
        FROM stock_levels s JOIN locations l ON l.id=s.location_id JOIN warehouses w ON w.id=l.warehouse_id WHERE s.product_id=? ORDER BY w.name, l.name`).all(r.id);
      return { ...r, locations };
    });
    return result;
  } finally {
    db.close();
  }
}

export function warehouses() {
  const db = connect();
  try {
    const rows = db.prepare('SELECT * FROM warehouses ORDER BY name').all();
    return rows.map(row => ({ ...row, locations: db.prepare('SELECT id, name, code FROM locations WHERE warehouse_id=? ORDER BY name').all(row.id) }));
  } finally { db.close(); }
}

export function ledger() {
  const db = connect();
  try {
    return db.prepare(`SELECT l.id, l.operation_id, l.created_at, l.quantity, o.reference, o.type, p.name AS product,
      p.sku, sl.name AS from_location, sw.name AS from_warehouse,
      dl.name AS to_location, dw.name AS to_warehouse, u.name AS performed_by
      FROM ledger l JOIN operations o ON o.id=l.operation_id JOIN products p ON p.id=l.product_id
      LEFT JOIN locations sl ON sl.id=l.from_location_id LEFT JOIN warehouses sw ON sw.id=sl.warehouse_id
      LEFT JOIN locations dl ON dl.id=l.to_location_id LEFT JOIN warehouses dw ON dw.id=dl.warehouse_id
      LEFT JOIN users u ON u.id=l.created_by ORDER BY l.created_at DESC, l.id DESC`).all();
  } finally { db.close(); }
}

export function bootstrap(userId) {
  const db = connect();
  try {
    const allProducts = products();
    const ops = db.prepare('SELECT id FROM operations ORDER BY created_at DESC, id DESC').all();
    const operations = ops.map(r => operationDetail(r.id));
    const levels = db.prepare(`SELECT p.id, p.reorder_level, COALESCE(SUM(s.quantity),0) AS quantity
      FROM products p LEFT JOIN stock_levels s ON s.product_id=p.id GROUP BY p.id`).all();
    const low = levels.filter(r => r.quantity > 0 && r.quantity <= r.reorder_level).length;
    const out = levels.filter(r => r.quantity === 0).length;
    return {
      user: db.prepare('SELECT id, name, email, created_at FROM users WHERE id=?').get(userId),
      products: allProducts,
      categories: db.prepare('SELECT * FROM categories ORDER BY name').all(),
      warehouses: warehouses(),
      operations,
      ledger: ledger(),
      kpis: {
        products_in_stock: allProducts.reduce((s,p) => s + Number(p.total_stock||0), 0),
        product_count: allProducts.length,
        low_stock: low,
        out_of_stock: out,
        pending_receipts: operations.filter(o => o.type === 'receipt' && !['done','canceled'].includes(o.status)).length,
        pending_deliveries: operations.filter(o => o.type === 'delivery' && !['done','canceled'].includes(o.status)).length,
        scheduled_transfers: operations.filter(o => o.type === 'internal' && !['done','canceled'].includes(o.status)).length,
      }
    };
  } finally { db.close(); }
}

export function operationDetail(id) {
  const db = connect();
  try {
    const row = db.prepare(`SELECT o.*, sl.name AS source_location, sw.name AS source_warehouse,
      dl.name AS destination_location, dw.name AS destination_warehouse
      FROM operations o
      LEFT JOIN locations sl ON sl.id=o.source_location_id
      LEFT JOIN warehouses sw ON sw.id=sl.warehouse_id
      LEFT JOIN locations dl ON dl.id=o.destination_location_id
      LEFT JOIN warehouses dw ON dw.id=dl.warehouse_id
      WHERE o.id=?`).get(id);
    if (!row) return null;
    const items = db.prepare(`SELECT ol.id, ol.product_id, p.name AS product_name, p.sku, p.unit,
      ol.quantity, ol.counted_quantity FROM operation_lines ol JOIN products p ON p.id=ol.product_id WHERE ol.operation_id=?`).all(id);
    return { ...row, items };
  } finally { db.close(); }
}

function changeStock(db, productId, locationId, amount) {
  const updated = db.prepare('UPDATE stock_levels SET quantity = quantity + ? WHERE product_id=? AND location_id=?').run(amount, productId, locationId);
  if (updated.changes === 0) {
    db.prepare('INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)').run(productId, locationId, amount);
  }
}

function addLedger(db, operationId, productId, source, destination, quantity, userId) {
  db.prepare('INSERT INTO ledger(operation_id, product_id, from_location_id, to_location_id, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)')
    .run(operationId, productId, source, destination, quantity, userId);
}

export function createOperation(userId, payload) {
  const type = String(payload.type || '').toLowerCase();
  if (!OP_TYPES.has(type)) throw new Error('Choose a valid operation type.');
  const items = payload.items;
  if (!Array.isArray(items) || items.length === 0) throw new Error('Add at least one product.');

  const sourceRequired = ['delivery','internal','adjustment'].includes(type);
  const destRequired = ['receipt','internal'].includes(type);
  const db = connect();
  try {
    const validateLoc = (val, label, required) => {
      if (val == null && !required) return null;
      if (val == null) throw new Error(`${label} is required.`);
      const found = db.prepare('SELECT id FROM locations WHERE id=?').get(val);
      if (!found) throw Object.assign(new Error(`${label} was not found.`), { code: 404 });
      return val;
    };
    const source = validateLoc(payload.source_location_id, 'Source location', sourceRequired);
    const destination = validateLoc(payload.destination_location_id, 'Destination location', destRequired);
    if (type === 'internal' && source === destination) throw new Error('Choose different source and destination locations.');

    const prefixes = {receipt:'REC', delivery:'DEL', internal:'TRF', adjustment:'ADJ'};
    const dateCode = new Date().toISOString().slice(2,10).replace(/-/g,'');
    const like = `${prefixes[type]}-${dateCode}-%`;
    const count = db.prepare('SELECT COUNT(*) as c FROM operations WHERE reference LIKE ?').get(like).c + 1;
    const reference = `${prefixes[type]}-${dateCode}-${String(count).padStart(3,'0')}`;

    const op = db.prepare(`INSERT INTO operations(reference, type, partner, source_location_id, destination_location_id, scheduled_at, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(reference, type, String(payload.partner||''), source, destination, payload.scheduled_at || null, String(payload.notes||''), userId);
    const operationId = op.lastInsertRowid;

    const insertLine = db.prepare('INSERT INTO operation_lines(operation_id, product_id, quantity, counted_quantity) VALUES (?, ?, ?, ?)');
    for (const item of items) {
      const productId = Number(item.product_id);
      const quantity = Number(item.quantity);
      const counted = item.counted_quantity == null ? null : Number(item.counted_quantity);
      if (Number.isNaN(productId) || Number.isNaN(quantity)) throw new Error('Each product needs a valid quantity.');
      if (quantity < 0 || (type !== 'adjustment' && quantity === 0)) throw new Error('Quantities must be greater than zero.');
      const exists = db.prepare('SELECT id FROM products WHERE id=?').get(productId);
      if (!exists) throw Object.assign(new Error('A selected product was not found.'), { code: 404 });
      if (type === 'adjustment' && (counted == null || counted < 0)) throw new Error('Enter the physical counted quantity for each adjustment.');
      insertLine.run(operationId, productId, quantity, counted);
    }
    return operationId;
  } finally { db.close(); }
}

export function validateOperation(operationId, userId) {
  const db = connect();
  try {
    const op = db.prepare('SELECT * FROM operations WHERE id=?').get(operationId);
    if (!op) throw Object.assign(new Error('Operation not found.'), { code: 404 });
    if (op.status === 'done') throw Object.assign(new Error('This operation has already been validated.'), { code: 409 });
    if (op.status === 'canceled') throw Object.assign(new Error('Canceled operations cannot be validated.'), { code: 409 });
    const lines = db.prepare('SELECT * FROM operation_lines WHERE operation_id=?').all(operationId);
    if (!lines || lines.length === 0) throw new Error('Add at least one product before validating.');

    const kind = op.type;
    const source = op.source_location_id;
    const destination = op.destination_location_id;

    // Pre-checks
    for (const line of lines) {
      const pid = line.product_id;
      const qty = line.quantity;
      if (kind === 'adjustment') {
        const existing = db.prepare('SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?').get(pid, source);
        const current = existing ? existing.quantity : 0;
        const diff = line.counted_quantity - current;
        if (current + diff < 0) throw Object.assign(new Error('Adjustment would result in negative stock.'), { code: 409 });
      } else if (kind === 'delivery' || kind === 'internal') {
        const existing = db.prepare('SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?').get(pid, source);
        const available = existing ? existing.quantity : 0;
        if (available < qty) {
          const product = db.prepare('SELECT name FROM products WHERE id=?').get(pid);
          throw Object.assign(new Error(`Not enough stock for ${product.name} at the source location (available: ${available}).`), { code: 409 });
        }
      }
    }

    const updateOp = db.prepare('UPDATE operations SET status=? WHERE id=?');
    const insertLedger = db.prepare('INSERT INTO ledger(operation_id, product_id, from_location_id, to_location_id, quantity, created_by) VALUES (?, ?, ?, ?, ?, ?)');

    const trx = db.transaction(() => {
      for (const line of lines) {
        const pid = line.product_id;
        const qty = line.quantity;
        if (kind === 'adjustment') {
          const existing = db.prepare('SELECT quantity FROM stock_levels WHERE product_id=? AND location_id=?').get(pid, source);
          const current = existing ? existing.quantity : 0;
          const diff = line.counted_quantity - current;
          db.prepare('INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)').run(pid, source, line.counted_quantity);
          insertLedger.run(operationId, pid, diff < 0 ? source : null, diff > 0 ? source : null, diff, userId);
        } else if (kind === 'receipt') {
          changeStock(db, pid, destination, qty);
          insertLedger.run(operationId, pid, null, destination, qty, userId);
        } else if (kind === 'delivery') {
          changeStock(db, pid, source, -qty);
          insertLedger.run(operationId, pid, source, null, -qty, userId);
        } else if (kind === 'internal') {
          changeStock(db, pid, source, -qty);
          changeStock(db, pid, destination, qty);
          insertLedger.run(operationId, pid, source, destination, qty, userId);
        }
      }
      updateOp.run('done', operationId);
    });

    trx();
  } finally { db.close(); }
}

export function listOperations() {
  const db = connect();
  try {
    const rows = db.prepare('SELECT id FROM operations ORDER BY created_at DESC, id DESC').all();
    return rows.map(r => operationDetail(r.id));
  } finally { db.close(); }
}

export function setOperationStatus(operationId, status) {
  if (!['waiting','ready','canceled'].includes(status)) throw new Error('Choose waiting, ready, or canceled.');
  const db = connect();
  try {
    const op = db.prepare('SELECT status FROM operations WHERE id=?').get(operationId);
    if (!op) throw Object.assign(new Error('Operation not found.'), { code: 404 });
    if (['done', 'canceled'].includes(op.status)) throw Object.assign(new Error('Completed or canceled operations cannot be changed.'), { code: 409 });
    db.prepare('UPDATE operations SET status=? WHERE id=?').run(status, operationId);
  } finally { db.close(); }
}

export function createProduct(payload) {
  const db = connect();
  try {
    const stmt = db.prepare('INSERT INTO products(name, sku, category_id, unit, reorder_level) VALUES (?, ?, ?, ?, ?)');
    const res = stmt.run(payload.name, payload.sku, payload.category_id || null, payload.unit || 'Units', payload.reorder_level || 10);
    const productId = res.lastInsertRowid;
    if (payload.initial_stock) {
      const levels = Array.isArray(payload.initial_stock) ? payload.initial_stock : [{ location_id: payload.location_id, quantity: payload.initial_stock }];
      for (const l of levels) {
        db.prepare('INSERT INTO stock_levels(product_id, location_id, quantity) VALUES (?, ?, ?)').run(productId, l.location_id, l.quantity);
      }
    }
    return productId;
  } finally { db.close(); }
}

export function updateProduct(productId, payload) {
  const db = connect();
  try {
    db.prepare('UPDATE products SET name=?, sku=?, unit=?, category_id=?, reorder_level=? WHERE id=?').run(payload.name, payload.sku, payload.unit, payload.category_id || null, payload.reorder_level, productId);
  } finally { db.close(); }
}

export function createCategory(name) {
  const db = connect();
  try { const r = db.prepare('INSERT INTO categories(name) VALUES (?)').run(name); return r.lastInsertRowid; } finally { db.close(); }
}

export function createWarehouse(payload) {
  const db = connect();
  try {
    const r = db.prepare('INSERT INTO warehouses(name, code, address) VALUES (?, ?, ?)').run(payload.name, payload.code, payload.address || '');
    const id = r.lastInsertRowid;
    db.prepare('INSERT INTO locations(warehouse_id, name, code) VALUES (?, ?, ?)').run(id, payload.location_name || 'Main Store', payload.location_code || 'MAIN');
    return id;
  } finally { db.close(); }
}
