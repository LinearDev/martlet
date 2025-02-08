import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

let db: Database | null = null;

const DEFAULT_ADMIN_CHAT_ID = '486583163';

export async function initializeDB() {
  if (db) return db;

  // Ensure data directory exists
  const dbDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = await open({
    filename: path.join(__dirname, '../data/bot.db'),
    driver: sqlite3.Database
  });

  // Create tables if they don't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      chat_id TEXT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      is_admin INTEGER DEFAULT 0,
      can_receive_notifications INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Set up default admin if not exists
  await db.run(`
    INSERT OR IGNORE INTO users (chat_id, is_admin, can_receive_notifications)
    VALUES (?, 1, 1)
  `, [DEFAULT_ADMIN_CHAT_ID]);

  return db;
}

export async function addUser(chatId: string, username: string | undefined, firstName: string | undefined, lastName: string | undefined) {
  const db = await initializeDB();
  await db.run(
    `INSERT OR IGNORE INTO users (chat_id, username, first_name, last_name)
     VALUES (?, ?, ?, ?)`,
    [chatId, username, firstName, lastName]
  );
}

export async function setAdmin(chatId: string, isAdmin: boolean) {
  const db = await initializeDB();
  await db.run(
    'UPDATE users SET is_admin = ? WHERE chat_id = ?',
    [isAdmin ? 1 : 0, chatId]
  );
}

export async function setNotificationReceiver(chatId: string, canReceive: boolean) {
  const db = await initializeDB();
  await db.run(
    'UPDATE users SET can_receive_notifications = ? WHERE chat_id = ?',
    [canReceive ? 1 : 0, chatId]
  );
}

export async function isAdmin(chatId: string): Promise<boolean> {
  const db = await initializeDB();
  const row = await db.get(
    'SELECT is_admin FROM users WHERE chat_id = ?',
    [chatId]
  );
  return row?.is_admin === 1;
}

export async function canReceiveNotifications(chatId: string): Promise<boolean> {
  const db = await initializeDB();
  const row = await db.get(
    'SELECT can_receive_notifications FROM users WHERE chat_id = ?',
    [chatId]
  );
  return row?.can_receive_notifications === 1;
}

export async function getAllNotificationReceivers(): Promise<string[]> {
  const db = await initializeDB();
  const rows = await db.all(
    'SELECT chat_id FROM users WHERE can_receive_notifications = 1'
  );
  return rows.map(row => row.chat_id);
}

export async function requestSubscription(chatId: string): Promise<boolean> {
  const db = await initializeDB();
  // Check if user exists, if not add them
  await db.run(
    `INSERT OR IGNORE INTO users (chat_id) VALUES (?)`,
    [chatId]
  );
  return true;
}
