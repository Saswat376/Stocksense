import { pool } from '../config/db.js';
import { StockMove } from '../models/Inventory.js';

export async function createAdjustment({ warehouse_id, location_id, lines }, userId) {
  const client = await pool.connect();
  let moveId;
  try {
    await client.query('BEGIN');
    
    // Find inventory loss location
    const { rows: locs } = await client.query("SELECT id FROM locations WHERE warehouse_id = $1 AND location_type = 'inventory_loss' LIMIT 1", [warehouse_id]);
    if (locs.length === 0) throw new Error("No inventory_loss location found for this warehouse");
    const inv_loss_loc_id = locs[0].id;

    // Adjustments are recorded as a move. For simplicity, we just put both locations
    // depending on positive/negative diff, but standardizing it is easier:
    // We'll create one move, and positive diff lines go Loss -> Internal.
    // Negative diff lines go Internal -> Loss.
    // For this basic setup, let's just make it a single 'adjustment' move type. 
    // The validation logic in stock.service.js assumes source is decreased and dest is increased.
    // To support per-line direction, we actually need to create different moves or handle negative quantities in lines.
    // Let's use positive/negative quantities on the line. 
    // If qty > 0, it means we found more stock (Loss -> Internal)
    // If qty < 0, it means we lost stock (Internal -> Loss)
    
    // But `stock.service.js` ignores qty <= 0.
    // So let's make it simpler: we assume the user provides the DELTA (e.g. +5 or -2).
    // If delta > 0, source = inv_loss, dest = location_id
    // If delta < 0, source = location_id, dest = inv_loss
    // To support a mix, we must split them into two moves.
    
    // Split lines into positive and negative deltas
    const positiveLines = lines.filter(l => l.quantity > 0);
    const negativeLines = lines.filter(l => l.quantity < 0);
    
    let createdMoveIds = [];
    
    if (positiveLines.length > 0) {
      const { rows: moveRows } = await StockMove.create(client, {
        move_type: 'adjustment',
        warehouse_id,
        source_location_id: inv_loss_loc_id,
        dest_location_id: location_id,
        responsible_id: userId
      });
      for (const line of positiveLines) {
        await StockMove.addLine(client, { move_id: moveRows[0].id, product_id: line.product_id, quantity: line.quantity });
      }
      createdMoveIds.push(moveRows[0].id);
    }
    
    if (negativeLines.length > 0) {
      const { rows: moveRows } = await StockMove.create(client, {
        move_type: 'adjustment',
        warehouse_id,
        source_location_id: location_id,
        dest_location_id: inv_loss_loc_id,
        responsible_id: userId
      });
      for (const line of negativeLines) {
        // Store as positive quantity since the direction defines it's outgoing
        await StockMove.addLine(client, { move_id: moveRows[0].id, product_id: line.product_id, quantity: Math.abs(line.quantity) });
      }
      createdMoveIds.push(moveRows[0].id);
    }

    await client.query('COMMIT');
    return { moveIds: createdMoveIds };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
