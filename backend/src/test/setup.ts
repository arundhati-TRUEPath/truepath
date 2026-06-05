import { config as dotenv } from 'dotenv';
import { resolve } from 'path';
import { afterAll } from 'vitest';
import { pool } from '../db/client';

dotenv({ path: resolve(__dirname, '../../.env') });

afterAll(async () => {
  await pool.end();
});
