import { config as dotenv } from 'dotenv';
import { resolve } from 'path';

dotenv({ path: resolve(__dirname, '../.env') });

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required environment variable: ${name}`);
  return val;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const config = {
  port: Number(optional('PORT', '4000')),
  corsOrigin: optional('CORS_ORIGIN', 'http://localhost:3000'),
  openai: {
    apiKey: optional('OPENAI_API_KEY', ''),
    model: optional('OPENAI_MODEL', 'gpt-4o'),
    followupModel: optional('OPENAI_FOLLOWUP_MODEL', 'gpt-4.1-mini'),
    skillsModel: optional('OPENAI_SKILLS_MODEL', 'gpt-4.1-mini'),
    embeddingModel: optional('OPENAI_EMBEDDING_MODEL', 'text-embedding-3-small'),
  },
  database: {
    url: requireEnv('DATABASE_URL'),
  },
  pythonServicesUrl: optional('PYTHON_SERVICES_URL', 'http://localhost:8000'),
} as const;
