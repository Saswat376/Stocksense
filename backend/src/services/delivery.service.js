import { pool } from '../config/db.js';
import { StockMove } from '../models/Inventory.js';

export async function createDelivery({ warehouse_id, customer_id, source_location_id, lines }, userId) {
  const client = await pool.connect();
  let moveId;
  try {
    await client.query('BEGIN');
    
    // Find customer location (destination)
    const { rows: locs } = await client.query("SELECT id FROM locations WHERE warehouse_id = $1 AND location_type = 'customer' LIMIT 1", [warehouse_id]);
    if (locs.length === 0) throw new Error("No customer location found for this warehouse");
    const dest_location_id = locs[0].id;

    const { rows: moveRows } = await StockMove.create(client, {
      move_type: 'delivery',
      warehouse_id,
      source_location_id,
      dest_location_id,
      partner_id: customer_id,
      responsible_id: userId
    });
    moveId = moveRows[0].id;

    for (const line of lines) {
      await StockMove.addLine(client, {
        move_id: moveId,
        product_id: line.product_id,
        quantity: line.quantity
      });
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  
  return { id: moveId };
}
