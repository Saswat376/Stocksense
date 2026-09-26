import { query } from '../config/db.js';

// ─── Dashboard KPIs ───────────────────────────────────────────────────────────

/**
 * Returns all KPIs needed for the dashboard landing page:
 *  - Total unique products & total units in stock
 *  - Low-stock count  (0 < total_stock <= reorder_min)
 *  - Out-of-stock count (total_stock = 0)
 *  - Pending receipts / deliveries / transfers  (status NOT in done/cancelled)
 *  - Warehouse breakdown for multi-warehouse summary
 */
export async function getDashboardKpis() {
  // Product stock levels (all warehouses combined)
  const { rows: stockRows } = await query(`
    SELECT
      p.id,
      p.reorder_min,
      COALESCE(SUM(sq.quantity), 0) AS total_stock
    FROM products p
    LEFT JOIN stock_quants sq ON sq.product_id = p.id
                              AND sq.location_id IN (
                                SELECT id FROM locations WHERE location_type = 'internal'
                              )
    GROUP BY p.id, p.reorder_min
  `);

  const productCount    = stockRows.length;
  const totalUnits      = stockRows.reduce((s, r) => s + parseFloat(r.total_stock), 0);
  const lowStock        = stockRows.filter(r => parseFloat(r.total_stock) > 0 && parseFloat(r.total_stock) <= parseFloat(r.reorder_min)).length;
  const outOfStock      = stockRows.filter(r => parseFloat(r.total_stock) === 0).length;

  // Pending operations per type
  const { rows: opsRows } = await query(`
    SELECT move_type, COUNT(*) AS cnt
    FROM stock_moves
    WHERE status NOT IN ('done', 'cancelled')
    GROUP BY move_type
  `);
  const opMap = Object.fromEntries(opsRows.map(r => [r.move_type, parseInt(r.cnt)]));

  // Per-warehouse stock summary
  const { rows: whRows } = await query(`
    SELECT
      w.id,
      w.name,
      COALESCE(SUM(sq.quantity), 0) AS total_stock,
      COUNT(DISTINCT sq.product_id) AS product_count
    FROM warehouses w
    LEFT JOIN locations l ON l.warehouse_id = w.id AND l.location_type = 'internal'
    LEFT JOIN stock_quants sq ON sq.location_id = l.id
    GROUP BY w.id, w.name
    ORDER BY w.name
  `);

  return {
    products: { count: productCount, total_units: totalUnits },
    stock_alerts: { low_stock: lowStock, out_of_stock: outOfStock },
    pending: {
      receipts:  opMap['receipt']  || 0,
      deliveries: opMap['delivery'] || 0,
      transfers: opMap['internal'] || 0,
      adjustments: opMap['adjustment'] || 0,
    },
    warehouses: whRows,
  };
}

// ─── Low-Stock Alerts ─────────────────────────────────────────────────────────

/**
 * Returns all products where total on-hand stock is at or below their reorder_min.
 * Includes location breakdown per product.
 */
export async function getLowStockAlerts({ warehouseId } = {}) {
  const warehouseFilter = warehouseId
    ? 'AND l.warehouse_id = $1'
    : '';
  const params = warehouseId ? [warehouseId] : [];

  const { rows } = await query(`
    SELECT
      p.id,
      p.name,
      p.sku,
      p.uom,
      p.reorder_min,
      p.reorder_max,
      c.name AS category,
      COALESCE(SUM(sq.quantity), 0) AS total_stock,
      CASE
        WHEN COALESCE(SUM(sq.quantity), 0) = 0              THEN 'out_of_stock'
        WHEN COALESCE(SUM(sq.quantity), 0) <= p.reorder_min THEN 'low_stock'
        ELSE 'ok'
      END AS alert_level
    FROM products p
    LEFT JOIN product_categories c ON c.id = p.category_id
    LEFT JOIN stock_quants sq ON sq.product_id = p.id
    LEFT JOIN locations l ON l.id = sq.location_id AND l.location_type = 'internal'
    ${warehouseFilter}
    GROUP BY p.id, p.name, p.sku, p.uom, p.reorder_min, p.reorder_max, c.name
    HAVING COALESCE(SUM(sq.quantity), 0) <= p.reorder_min
    ORDER BY total_stock ASC, p.name
  `, params);

  return rows;
}

// ─── Stock Overview (per location / warehouse) ───────────────────────────────

/**
 * Returns current stock levels broken down by product + location + warehouse.
 * Supports filtering by warehouse, location, category, or SKU search.
 */
export async function getStockOverview({ warehouseId, locationId, categoryId, search } = {}) {
  const conditions = ["l.location_type = 'internal'"];
  const params = [];

  if (warehouseId)  { params.push(warehouseId);  conditions.push(`l.warehouse_id = $${params.length}`); }
  if (locationId)   { params.push(locationId);   conditions.push(`sq.location_id = $${params.length}`); }
  if (categoryId)   { params.push(categoryId);   conditions.push(`p.category_id = $${params.length}`); }
  if (search)       { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows } = await query(`
    SELECT
      p.id            AS product_id,
      p.name          AS product_name,
      p.sku,
      p.uom,
      p.reorder_min,
      c.name          AS category,
      w.id            AS warehouse_id,
      w.name          AS warehouse_name,
      l.id            AS location_id,
      l.name          AS location_name,
      sq.quantity,
      sq.reserved_quantity,
      (sq.quantity - sq.reserved_quantity) AS available_quantity,
      CASE
        WHEN sq.quantity = 0              THEN 'out_of_stock'
        WHEN sq.quantity <= p.reorder_min THEN 'low_stock'
        ELSE 'ok'
      END AS stock_status
    FROM stock_quants sq
    JOIN products p ON p.id = sq.product_id
    JOIN locations l ON l.id = sq.location_id
    JOIN warehouses w ON w.id = l.warehouse_id
    LEFT JOIN product_categories c ON c.id = p.category_id
    ${where}
    ORDER BY w.name, l.name, p.name
  `, params);

  return rows;
}

// ─── Move History / Ledger with filters ──────────────────────────────────────

/**
 * Returns the immutable stock ledger (move history).
 * Supports filtering by product, location, warehouse, move type, and date range.
 */
export async function getMoveHistory({ productId, warehouseId, moveType, dateFrom, dateTo, search, limit = 100, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (productId)  { params.push(productId);  conditions.push(`sl.product_id = $${params.length}`); }
  if (warehouseId){ params.push(warehouseId); conditions.push(`(fw.id = $${params.length} OR tw.id = $${params.length})`); }
  if (moveType)   { params.push(moveType);   conditions.push(`sm.move_type = $${params.length}`); }
  if (dateFrom)   { params.push(dateFrom);   conditions.push(`sl.moved_at >= $${params.length}`); }
  if (dateTo)     { params.push(dateTo);     conditions.push(`sl.moved_at <= $${params.length}`); }
  if (search)     { params.push(`%${search}%`); conditions.push(`(p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length} OR sm.reference ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  params.push(limit, offset);
  const limitClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(`
    SELECT
      sl.id,
      sl.moved_at,
      sl.quantity,
      sm.reference,
      sm.move_type,
      sm.status,
      p.id   AS product_id,
      p.name AS product_name,
      p.sku,
      fl.name  AS from_location,
      fw.name  AS from_warehouse,
      tl.name  AS to_location,
      tw.name  AS to_warehouse,
      u.login_id AS performed_by
    FROM stock_ledger sl
    JOIN stock_moves sm ON sm.id = sl.move_id
    JOIN products p     ON p.id  = sl.product_id
    LEFT JOIN locations fl  ON fl.id  = sl.from_location_id
    LEFT JOIN warehouses fw ON fw.id  = fl.warehouse_id
    LEFT JOIN locations tl  ON tl.id  = sl.to_location_id
    LEFT JOIN warehouses tw ON tw.id  = tl.warehouse_id
    LEFT JOIN users u       ON u.id   = sm.responsible_id
    ${where}
    ORDER BY sl.moved_at DESC, sl.id DESC
    ${limitClause}
  `, params);

  return rows;
}

// ─── Operations list with dynamic filters ────────────────────────────────────

/**
 * Returns stock_moves with rich filter support.
 * Matches the UI's Dynamic Filters: type, status, warehouse, location, category.
 */
export async function listMoves({ moveType, status, warehouseId, locationId, partnerId, dateFrom, dateTo, search, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];

  if (moveType)   { params.push(moveType);   conditions.push(`sm.move_type = $${params.length}`); }
  if (status)     { params.push(status);     conditions.push(`sm.status = $${params.length}`); }
  if (warehouseId){ params.push(warehouseId); conditions.push(`sm.warehouse_id = $${params.length}`); }
  if (locationId) { params.push(locationId); conditions.push(`(sm.source_location_id = $${params.length} OR sm.dest_location_id = $${params.length})`); }
  if (partnerId)  { params.push(partnerId);  conditions.push(`sm.partner_id = $${params.length}`); }
  if (dateFrom)   { params.push(dateFrom);   conditions.push(`sm.created_at >= $${params.length}`); }
  if (dateTo)     { params.push(dateTo);     conditions.push(`sm.created_at <= $${params.length}`); }
  if (search)     { params.push(`%${search}%`); conditions.push(`(sm.reference ILIKE $${params.length} OR p.name ILIKE $${params.length} OR p.sku ILIKE $${params.length})`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  
  // search join is only needed when searching by product name/sku
  const productJoin = search
    ? `LEFT JOIN stock_move_lines sml ON sml.move_id = sm.id LEFT JOIN products p ON p.id = sml.product_id`
    : '';

  params.push(limit, offset);
  const limitClause = `LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(`
    SELECT DISTINCT
      sm.id,
      sm.reference,
      sm.move_type,
      sm.status,
      sm.scheduled_date,
      sm.created_at,
      sm.validated_at,
      w.name  AS warehouse_name,
      sl.name AS source_location_name,
      dl.name AS dest_location_name,
      pt.name AS partner_name,
      u.login_id AS responsible
    FROM stock_moves sm
    JOIN warehouses w        ON w.id  = sm.warehouse_id
    LEFT JOIN locations sl   ON sl.id = sm.source_location_id
    LEFT JOIN locations dl   ON dl.id = sm.dest_location_id
    LEFT JOIN partners pt    ON pt.id = sm.partner_id
    LEFT JOIN users u        ON u.id  = sm.responsible_id
    ${productJoin}
    ${where}
    ORDER BY sm.created_at DESC, sm.id DESC
    ${limitClause}
  `, params);

  // Attach line count to each move
  const { rows: lineCounts } = await query(`
    SELECT move_id, COUNT(*) AS line_count, SUM(quantity) AS total_qty
    FROM stock_move_lines
    WHERE move_id = ANY($1::uuid[])
    GROUP BY move_id
  `, [rows.map(r => r.id)]);
  
  const lineMap = Object.fromEntries(lineCounts.map(r => [r.move_id, r]));
  return rows.map(r => ({ ...r, line_count: lineMap[r.id]?.line_count || 0, total_qty: lineMap[r.id]?.total_qty || 0 }));
}

// ─── Move detail ─────────────────────────────────────────────────────────────

export async function getMoveDetail(moveId) {
  const { rows: moveRows } = await query(`
    SELECT sm.*, w.name AS warehouse_name, sl.name AS source_location_name,
      dl.name AS dest_location_name, pt.name AS partner_name, u.login_id AS responsible
    FROM stock_moves sm
    JOIN warehouses w      ON w.id  = sm.warehouse_id
    LEFT JOIN locations sl ON sl.id = sm.source_location_id
    LEFT JOIN locations dl ON dl.id = sm.dest_location_id
    LEFT JOIN partners pt  ON pt.id = sm.partner_id
    LEFT JOIN users u      ON u.id  = sm.responsible_id
    WHERE sm.id = $1
  `, [moveId]);

  if (!moveRows.length) return null;
  const move = moveRows[0];

  const { rows: lines } = await query(`
    SELECT sml.*, p.name AS product_name, p.sku, p.uom
    FROM stock_move_lines sml
    JOIN products p ON p.id = sml.product_id
    WHERE sml.move_id = $1
    ORDER BY p.name
  `, [moveId]);

  return { ...move, lines };
}
