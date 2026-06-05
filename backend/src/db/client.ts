import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../logger';

export const pool = new Pool({
  connectionString: config.database.url,
  ssl: { rejectUnauthorized: true },
  max: 10,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'pg pool idle client error');
});
