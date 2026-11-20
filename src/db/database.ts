import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

let dbInstance: Database.Database | null = null;

export function getDatabasePath(): string {
  const configured = process.env.DATABASE_PATH?.trim() || './data/servicemate.db';
  return path.resolve(process.cwd(), configured);
}

export function getDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getDatabasePath();
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  dbInstance = db;
  return db;
}

export function runMigrations(db: Database.Database = getDb()): void {
  const schemaPath = path.resolve(process.cwd(), 'src/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');
  db.exec(sql);
}
