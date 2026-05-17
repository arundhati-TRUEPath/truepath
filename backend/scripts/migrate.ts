import 'dotenv/config';
import { Client } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';

const dbPassword = process.env.SUPABASE_DB_PASSWORD;
const projectRef = 'oqcthtuqvkphclwvalsf';

if (!dbPassword) {
  console.error('Missing SUPABASE_DB_PASSWORD in .env');
  process.exit(1);
}

const encodedPassword = encodeURIComponent(dbPassword);
const connectionString =
  `postgresql://postgres:${encodedPassword}@db.${projectRef}.supabase.co:5432/postgres`;

const MIGRATION_FILES = [
  join(__dirname, '..', 'db', 'migrations', '001_schema.sql'),
  join(__dirname, '..', 'db', 'migrations', '002_disable_rls.sql'),
  join(__dirname, '..', 'db', 'seeds', '001_questions.sql'),
];

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to Supabase PostgreSQL.');

  for (const file of MIGRATION_FILES) {
    const sql = readFileSync(file, 'utf8');
    const name = file.split(/[/\\]/).pop();
    console.log(`Running ${name}…`);
    await client.query(sql);
    console.log(`  ✓ ${name} complete`);
  }

  await client.end();
  console.log('\nAll migrations applied.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
