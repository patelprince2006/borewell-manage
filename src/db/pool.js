import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectionString = process.env.DATABASE_URL;

const poolConfig = connectionString
  ? {
      connectionString,
      ssl: connectionString.includes('localhost') || connectionString.includes('127.0.0.1')
        ? false
        : { rejectUnauthorized: false },
    }
  : {
      host: process.env.PGHOST || 'localhost',
      port: parseInt(process.env.PGPORT || '5432', 10),
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'prince2396',
      database: process.env.PGDATABASE || 'borewell_water_db',
      ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : false,
    };

export const pool = new Pool({
  ...poolConfig,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

export async function initDb() {
  const client = await pool.connect();
  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    await client.query(sql);
    console.log('✅ PostgreSQL Database initialized successfully!');
  } catch (error) {
    console.error('❌ Database initialization error:', error.message);
    throw error;
  } finally {
    client.release();
  }
}

export async function query(text, params) {
  return pool.query(text, params);
}
