import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;
export const pool = new Pool({ connectionString: env.databaseUrl });
pool.on('error', (error) => console.error('Unexpected PostgreSQL pool error', error));
export const query = (text, params) => pool.query(text, params);
