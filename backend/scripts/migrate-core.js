/**
 * Run from the backend directory:
 *   node scripts/migrate-core.js
 *
 * Applies database/schema.sql against DATABASE_URL in .env
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath   = resolve(__dirname, '../../database/schema.sql');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const sql = readFileSync(sqlPath, 'utf8');
  console.log('🔌 Connecting to database…');
  const client = await pool.connect();
  try {
    console.log('📄 Applying core schema.sql…');
    await client.query(sql);
    console.log('✅ Core schema applied successfully.');
    
    // Seed default warehouse and locations
    console.log('🌱 Seeding default warehouse and locations...');
    const { rows: wh } = await client.query(`
      INSERT INTO warehouses (name, short_code, address) 
      VALUES ('Main Warehouse', 'WH', '123 Supply Chain Ave')
      ON CONFLICT DO NOTHING
      RETURNING id
    `);
    
    if (wh.length > 0) {
      const whId = wh[0].id;
      // Default locations
      await client.query(`
        INSERT INTO locations (warehouse_id, name, short_code, location_type) VALUES
        ($1, 'Stock', 'STOCK', 'internal'),
        ($1, 'Vendor Transit', 'VEND', 'vendor'),
        ($1, 'Customer Dispatch', 'CUST', 'customer'),
        ($1, 'Inventory Adjustment/Loss', 'LOSS', 'inventory_loss')
        ON CONFLICT DO NOTHING
      `, [whId]);
      console.log('✅ Default warehouse and locations seeded.');
    } else {
      console.log('⚠️ Warehouse already exists, skipping seed.');
    }

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
