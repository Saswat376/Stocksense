/**
 * Run from the backend directory:
 *   node scripts/migrate.js
 *
 * Applies database/auth_schema.sql against DATABASE_URL in .env
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sqlPath   = resolve(__dirname, '../../database/auth_schema.sql');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function migrate() {
  const sql = readFileSync(sqlPath, 'utf8');
  console.log('🔌 Connecting to database…');
  const client = await pool.connect();
  try {
    console.log('📄 Applying auth_schema.sql…');
    await client.query(sql);
    console.log('✅ Auth schema applied successfully.');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
