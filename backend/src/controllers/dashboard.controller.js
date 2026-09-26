import {
  getDashboardKpis,
  getLowStockAlerts,
  getStockOverview,
  getMoveHistory,
  listMoves,
  getMoveDetail,
} from '../services/dashboard.service.js';

// GET /api/dashboard
export async function dashboard(req, res, next) {
  try {
    const kpis = await getDashboardKpis();
    res.json(kpis);
  } catch (err) { next(err); }
}

// GET /api/dashboard/alerts
export async function alerts(req, res, next) {
  try {
    const { warehouse_id } = req.query;
    const rows = await getLowStockAlerts({ warehouseId: warehouse_id });
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/stock
export async function stock(req, res, next) {
  try {
    const { warehouse_id, location_id, category_id, search } = req.query;
    const rows = await getStockOverview({ warehouseId: warehouse_id, locationId: location_id, categoryId: category_id, search });
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/moves  (operations list with filters)
export async function moves(req, res, next) {
  try {
    const { move_type, status, warehouse_id, location_id, partner_id, date_from, date_to, search, limit, offset } = req.query;
    const rows = await listMoves({
      moveType: move_type, status, warehouseId: warehouse_id,
      locationId: location_id, partnerId: partner_id,
      dateFrom: date_from, dateTo: date_to, search,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(rows);
  } catch (err) { next(err); }
}

// GET /api/moves/:id
export async function moveDetail(req, res, next) {
  try {
    const move = await getMoveDetail(req.params.id);
    if (!move) return res.status(404).json({ error: 'Move not found' });
    res.json(move);
  } catch (err) { next(err); }
}

// POST /api/moves/:id/validate  (validate an existing move that was previously created as draft)
export async function validateExistingMove(req, res, next) {
  try {
    const { validateMove } = await import('../services/stock.service.js');
    await validateMove(req.params.id);
    const move = await getMoveDetail(req.params.id);
    res.json(move);
  } catch (err) {
    const status = err.message?.includes('not found') ? 404
                 : err.message?.includes('already')   ? 409
                 : 400;
    err.status = status;
    next(err);
  }
}

// GET /api/ledger  (immutable audit trail with filters)
export async function ledger(req, res, next) {
  try {
    const { product_id, warehouse_id, move_type, date_from, date_to, search, limit, offset } = req.query;
    const rows = await getMoveHistory({
      productId: product_id, warehouseId: warehouse_id, moveType: move_type,
      dateFrom: date_from, dateTo: date_to, search,
      limit: limit ? parseInt(limit) : 100,
      offset: offset ? parseInt(offset) : 0,
    });
    res.json(rows);
  } catch (err) { next(err); }
}
