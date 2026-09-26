import { pool } from '../config/db.js';
import { StockMove, StockQuant, StockLedger } from '../models/Inventory.js';

/**
 * Validates a stock move.
 * Uses a database transaction to ensure data integrity.
 * 
 * 1. Checks move exists and is not already done.
 * 2. Gets lines.
 * 3. Applies quantity changes to source/dest locations.
 * 4. Adds to stock_ledger.
 * 5. Marks move as done.
 */
export async function validateMove(moveId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // 1. Lock the move row to prevent concurrent validation
    const { rows: moveRows } = await client.query('SELECT * FROM stock_moves WHERE id = $1 FOR UPDATE', [moveId]);
    if (moveRows.length === 0) throw new Error('Move not found');
    
    const move = moveRows[0];
    if (move.status === 'done') throw new Error('Move is already validated');
    
    // 2. Get lines
    const { rows: lines } = await client.query('SELECT * FROM stock_move_lines WHERE move_id = $1 FOR UPDATE', [moveId]);
    if (lines.length === 0) throw new Error('Cannot validate a move with no lines');

    // 3. Process each line
    for (const line of lines) {
      // In a real app, done_quantity might differ from quantity if partially fulfilled.
      // We will assume full fulfillment for simplicity, so done_quantity = quantity.
      const qty = parseFloat(line.quantity);
      if (qty <= 0) continue; // Skip zero qty lines

      await client.query('UPDATE stock_move_lines SET done_quantity = $1 WHERE id = $2', [qty, line.id]);

      // If there is a source location (outgoing/internal), decrease stock
      if (move.source_location_id) {
        await StockQuant.adjustQuantity(client, { 
          product_id: line.product_id, 
          location_id: move.source_location_id, 
          qty_delta: -qty 
        });
      }

      // If there is a dest location (incoming/internal), increase stock
      if (move.dest_location_id) {
        await StockQuant.adjustQuantity(client, { 
          product_id: line.product_id, 
          location_id: move.dest_location_id, 
          qty_delta: qty 
        });
      }

      // 4. Ledger entry
      await StockLedger.insert(client, {
        move_id: move.id,
        product_id: line.product_id,
        from_location_id: move.source_location_id,
        to_location_id: move.dest_location_id,
        quantity: qty
      });
    }

    // 5. Mark done
    await StockMove.markDone(client, move.id);

    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
