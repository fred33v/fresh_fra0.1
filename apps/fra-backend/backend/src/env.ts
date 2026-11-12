// Loads local environment files into process.env. Import this before any module
// that reads process.env when it loads.
//
// .env.local is written by the Neon CLI (`neon deploy` / `neon env pull`) and holds
// the branch's connection strings; .env holds everything else. Variables already set
// in the real environment win over both, and .env.local wins over .env.
//
// Tests never load them: the suite runs on the in-memory stores, and a local
// DATABASE_URL would point it at a real database.
import { config } from 'dotenv';

if (process.env.NODE_ENV !== 'test') {
  config({ path: ['.env.local', '.env'], quiet: true });
}
