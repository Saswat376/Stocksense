import { Product, Category } from '../models/Product.js';
import { pool } from '../config/db.js';
import { StockMove, StockQuant, StockLedger } from '../models/Inventory.js';
import { validateMove } from './stock.service.js';

export async function createProduct({ name, sku, category_id, uom, cost_per_unit, reorder_min, reorder_max, initial_stock }, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Check if SKU exists
    const { rows: existing } = await client.query('SELECT id FROM products WHERE sku = $1', [sku]);
    if (existing.length) throw new Error('Product with this SKU already exists');

    // 2. Create product
    const { rows: prodRows } = await client.query(`
      INSERT INTO products (name, sku, category_id, uom, cost_per_unit, reorder_min, reorder_max)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, sku, category_id || null, uom || 'unit', cost_per_unit || 0, reorder_min || 0, reorder_max || 0]);
    
    const product = prodRows[0];

    // 3. Initial stock (Adjustment)
    if (initial_stock && initial_stock > 0) {
      // Find a default warehouse and internal location to put it in
      // For simplicity, we just grab the first warehouse and its first internal location.
      // Also need the "inventory_loss" location for the adjustment source.
      
      const { rows: whRows } = await client.query('SELECT id FROM warehouses LIMIT 1');
      if (whRows.length > 0) {
        const warehouseId = whRows[0].id;
        
        const { rows: destLocs } = await client.query("SELECT id FROM locations WHERE warehouse_id = $1 AND location_type = 'internal' LIMIT 1", [warehouseId]);
        const { rows: srcLocs } = await client.query("SELECT id FROM locations WHERE warehouse_id = $1 AND location_type = 'inventory_loss' LIMIT 1", [warehouseId]);
        
        if (destLocs.length > 0 && srcLocs.length > 0) {
          // Create the adjustment move
          const { rows: moveRows } = await StockMove.create(client, {
            move_type: 'adjustment',
            warehouse_id: warehouseId,
            source_location_id: srcLocs[0].id,
            dest_location_id: destLocs[0].id,
            responsible_id: userId
          });
          
          const moveId = moveRows[0].id;
          
          // Add line
          await StockMove.addLine(client, {
            move_id: moveId,
            product_id: product.id,
            quantity: initial_stock
          });
          
          // We can't call validateMove(moveId) directly because it opens its own transaction
          // But since we are inside a transaction, we can just do the quant/ledger updates manually
          // Or we can commit and then call validateMove. Let's do that for simplicity and safety.
          await client.query('COMMIT');
          client.release();
          
          await validateMove(moveId);
          return product;
        }
      }
    }
    
    await client.query('COMMIT');
    client.release();
    return product;
    
  } catch (error) {
    await client.query('ROLLBACK');
    client.release();
    throw error;
  }
}

export async function getAllProducts() {
  const { rows } = await Product.findAll();
  return rows;
}
