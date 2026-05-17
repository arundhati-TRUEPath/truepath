import { Client } from 'pg';

const PROJECT = 'oqcthtuqvkphclwvalsf';
const PASSWORD = process.env.SUPABASE_DB_PASSWORD!;

async function probe(label: string, connStr: string): Promise<string> {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const res = await client.query('SELECT version()');
    await client.end();
    return `CONNECTED — ${String(res.rows[0]?.version).slice(0, 40)}`;
  } catch (e) {
    return (e as Error).message.slice(0, 100);
  }
}

async function main() {
  const candidates = [
    // Direct connection
    ['direct-5432',   `postgresql://postgres:${PASSWORD}@db.${PROJECT}.supabase.co:5432/postgres`],
    // New pooler format (Session mode)
    ['pooler-us-east-1-5432', `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:5432/postgres`],
    ['pooler-eu-west-2-5432', `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-eu-west-2.pooler.supabase.com:5432/postgres`],
    // Transaction mode
    ['pooler-us-east-1-6543', `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`],
    ['pooler-eu-west-2-6543', `postgresql://postgres.${PROJECT}:${PASSWORD}@aws-0-eu-west-2.pooler.supabase.com:6543/postgres`],
  ] as [string, string][];

  console.log('Probing Supabase connection options…\n');
  for (const [label, conn] of candidates) {
    const result = await probe(label, conn);
    console.log(`${label.padEnd(28)} → ${result}`);
  }
}

main();
