import * as dotenv from 'dotenv';
import * as path from 'path';

// ENV=staging loads .env.staging first, then falls back to .env. Keeps URLs out of test code.
const envName = process.env.ENV ?? 'local';
dotenv.config({ path: path.resolve(process.cwd(), `.env.${envName}`) });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) {
    throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.`);
  }
  return value;
}

export const config = {
  envName,
  baseUrl: required('BASE_URL', 'http://localhost:4173'),
  apiBaseUrl: required('API_BASE_URL', 'https://jsonplaceholder.typicode.com'),
  startServer: (process.env.START_SERVER ?? 'true') === 'true',
  headless: (process.env.HEADLESS ?? 'true') === 'true',
  apiMaxResponseMs: Number(process.env.API_MAX_RESPONSE_MS ?? 5000),
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? '',
};
