import { query } from '../config/db.js';
import { Router } from 'express';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAuth);

// ── Warehouses ───────────────────────────────────────────────────────────────
router.get('/warehouses', async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT w.*,
        json_agg(json_build_object('id', l.id, 'name', l.name, 'short_code', l.short_code, 'location_type', l.location_type)
                 ORDER BY l.name) FILTER (WHERE l.id IS NOT NULL) AS locations
      FROM warehouses w
      LEFT JOIN locations l ON l.warehouse_id = w.id
      GROUP BY w.id ORDER BY w.name
    `);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/warehouses', async (req, res, next) => {
  try {
    const { name, short_code, address } = req.body;
    if (!name || !short_code) return res.status(400).json({ error: 'name and short_code are required' });
    const { rows } = await query(
      `INSERT INTO warehouses (name, short_code, address) VALUES ($1, $2, $3) RETURNING *`,
      [name, short_code.toUpperCase(), address || null]
    );
    const wh = rows[0];
    // Seed standard locations
    await query(`
      INSERT INTO locations (warehouse_id, name, short_code, location_type) VALUES
      ($1, 'Stock', 'STOCK', 'internal'),
      ($1, 'Vendor Transit', 'VEND', 'vendor'),
      ($1, 'Customer Dispatch', 'CUST', 'customer'),
      ($1, 'Inventory Loss', 'LOSS', 'inventory_loss')
    `, [wh.id]);
    res.status(201).json(wh);
  } catch (err) { next(err); }
});

// ── Locations ────────────────────────────────────────────────────────────────
router.get('/locations', async (req, res, next) => {
  try {
    const { warehouse_id, type } = req.query;
    const conditions = [];
    const params = [];
    if (warehouse_id) { params.push(warehouse_id); conditions.push(`warehouse_id = $${params.length}`); }
    if (type)         { params.push(type);         conditions.push(`location_type = $${params.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await query(`
      SELECT l.*, w.name AS warehouse_name FROM locations l
      JOIN warehouses w ON w.id = l.warehouse_id
      ${where} ORDER BY w.name, l.name
    `, params);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/locations', async (req, res, next) => {
  try {
    const { warehouse_id, name, short_code, location_type } = req.body;
    if (!warehouse_id || !name || !short_code) return res.status(400).json({ error: 'warehouse_id, name and short_code are required' });
    const { rows } = await query(
      `INSERT INTO locations (warehouse_id, name, short_code, location_type) VALUES ($1, $2, $3, $4) RETURNING *`,
      [warehouse_id, name, short_code.toUpperCase(), location_type || 'internal']
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── Partners (vendors / customers) ───────────────────────────────────────────
router.get('/partners', async (req, res, next) => {
  try {
    const { type } = req.query;
    const { rows } = type
      ? await query(`SELECT * FROM partners WHERE type = $1 ORDER BY name`, [type])
      : await query(`SELECT * FROM partners ORDER BY type, name`);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/partners', async (req, res, next) => {
  try {
    const { name, type, email, phone } = req.body;
    if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
    const { rows } = await query(
      `INSERT INTO partners (name, type, email, phone) VALUES ($1, $2, $3, $4) RETURNING *`,
      [name, type, email || null, phone || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

// ── Categories ───────────────────────────────────────────────────────────────
router.get('/categories', async (req, res, next) => {
  try {
    const { rows } = await query(`SELECT * FROM product_categories ORDER BY name`);
    res.json(rows);
  } catch (err) { next(err); }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const { rows } = await query(
      `INSERT INTO product_categories (name) VALUES ($1) RETURNING *`, [name]
    );
    res.status(201).json(rows[0]);
  } catch (err) { next(err); }
});

export default router;
