import { query, pool } from '../config/db.js';

export const StockMove = {
  create: async (client, { move_type, warehouse_id, source_location_id, dest_location_id, partner_id, responsible_id, status = 'draft' }) => {
    // Generate a reference number (e.g., WH/IN/0001)
    let opType = 'ADJ';
    if (move_type === 'receipt') opType = 'IN';
    if (move_type === 'delivery') opType = 'OUT';
    if (move_type === 'internal') opType = 'INT';

    // Sequence generation (safely locked)
    const seqRes = await client.query(`
      INSERT INTO reference_sequences (warehouse_id, operation_type, next_number) 
      VALUES ($1, $2, 2)
      ON CONFLICT (warehouse_id, operation_type) 
      DO UPDATE SET next_number = reference_sequences.next_number + 1
      RETURNING next_number - 1 as num
    `, [warehouse_id, opType]);
    
    const num = seqRes.rows[0].num.toString().padStart(4, '0');
    // Assuming a single warehouse for simplicity, we could fetch short_code here, but we'll use WH for now
    const reference = `WH/${opType}/${num}`;

    return client.query(`
      INSERT INTO stock_moves (reference, move_type, warehouse_id, source_location_id, dest_location_id, partner_id, responsible_id, status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [reference, move_type, warehouse_id, source_location_id, dest_location_id, partner_id, responsible_id, status]);
  },

  addLine: (client, { move_id, product_id, quantity }) => {
    return client.query(`
      INSERT INTO stock_move_lines (move_id, product_id, quantity)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [move_id, product_id, quantity]);
  },

  findById: (id) => query(`
    SELECT m.*, w.name as warehouse_name, p.name as partner_name, u.login_id as responsible_name
    FROM stock_moves m
    LEFT JOIN warehouses w ON m.warehouse_id = w.id
    LEFT JOIN partners p ON m.partner_id = p.id
    LEFT JOIN users u ON m.responsible_id = u.id
    WHERE m.id = $1
  `, [id]),

  getLines: (moveId) => query(`
    SELECT l.*, p.name as product_name, p.sku as product_sku
    FROM stock_move_lines l
    JOIN products p ON l.product_id = p.id
    WHERE l.move_id = $1
  `, [moveId]),

  markDone: (client, id) => {
    return client.query(`UPDATE stock_moves SET status = 'done', validated_at = NOW() WHERE id = $1 RETURNING *`, [id]);
  }
};

export const StockQuant = {
  // Update or insert stock quantity, returning the new total
  adjustQuantity: async (client, { product_id, location_id, qty_delta }) => {
    return client.query(`
      INSERT INTO stock_quants (product_id, location_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (product_id, location_id)
      DO UPDATE SET quantity = stock_quants.quantity + EXCLUDED.quantity, updated_at = NOW()
      RETURNING quantity
    `, [product_id, location_id, qty_delta]);
  }
};

export const StockLedger = {
  insert: (client, { move_id, product_id, from_location_id, to_location_id, quantity }) => {
    return client.query(`
      INSERT INTO stock_ledger (move_id, product_id, from_location_id, to_location_id, quantity)
      VALUES ($1, $2, $3, $4, $5)
    `, [move_id, product_id, from_location_id, to_location_id, quantity]);
  }
};
