import 'dotenv/config';
import { getDb, getDatabasePath, runMigrations } from './database.ts';

const db = getDb();
runMigrations(db);
console.log(`Database schema initialized at ${getDatabasePath()}`);
