import { query } from '../config/db.js';

export const Category = {
  findAll: () => query('SELECT * FROM product_categories ORDER BY name'),
  findById: (id) => query('SELECT * FROM product_categories WHERE id = $1', [id]),
  create: (name) => query('INSERT INTO product_categories (name) VALUES ($1) RETURNING *', [name]),
};

export const Product = {
  findAll: () => query(`
    SELECT p.*, c.name as category_name,
      COALESCE((SELECT SUM(quantity) FROM stock_quants WHERE product_id = p.id), 0) as total_stock
    FROM products p
    LEFT JOIN product_categories c ON p.category_id = c.id
    ORDER BY p.created_at DESC
  `),
  findById: (id) => query(`
    SELECT p.*, c.name as category_name 
    FROM products p 
    LEFT JOIN product_categories c ON p.category_id = c.id 
    WHERE p.id = $1
  `, [id]),
  findBySku: (sku) => query('SELECT * FROM products WHERE sku = $1', [sku]),
  create: ({ name, sku, category_id, uom, cost_per_unit, reorder_min, reorder_max }) => 
    query(`
      INSERT INTO products (name, sku, category_id, uom, cost_per_unit, reorder_min, reorder_max)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [name, sku, category_id, uom, cost_per_unit || 0, reorder_min || 0, reorder_max || 0]),
  update: (id, updates) => {
    const fields = Object.keys(updates).map((k, i) => `${k} = $${i+2}`).join(', ');
    const values = Object.values(updates);
    return query(`UPDATE products SET ${fields} WHERE id = $1 RETURNING *`, [id, ...values]);
  }
};
