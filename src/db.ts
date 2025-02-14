import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import fs from 'fs';

import { env } from './env';

let db: Database | null = null;

interface ContainerLog {
    id: string;
    logs: string;
    created_at: Date;
}

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

  // Create subscription requests table
  await db.exec(`
    CREATE TABLE IF NOT EXISTS subscription_requests (
      chat_id TEXT,
      status TEXT DEFAULT 'pending',
      requested_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      PRIMARY KEY (chat_id),
      FOREIGN KEY (chat_id) REFERENCES users(chat_id)
    )
  `);

  // Set up default admin if not exists
  await db.run(`
    INSERT OR IGNORE INTO users (chat_id, is_admin, can_receive_notifications)
    VALUES (?, 1, 1)
  `, [env.DEFAULT_ADMIN_CHAT_ID]);

  // Add container_logs table
  await db.run(`
    CREATE TABLE IF NOT EXISTS container_logs (
      id TEXT PRIMARY KEY,
      logs TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

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
  
  try {
    await db.run('BEGIN TRANSACTION');

    // Update user's notification status
    await db.run(
      'UPDATE users SET can_receive_notifications = ? WHERE chat_id = ?',
      [canReceive ? 1 : 0, chatId]
    );

    // Update subscription request status
    await db.run(
      `UPDATE subscription_requests 
       SET status = ?, processed_at = CURRENT_TIMESTAMP
       WHERE chat_id = ?`,
      [canReceive ? 'approved' : 'rejected', chatId]
    );

    await db.run('COMMIT');
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
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
  
  try {
    await db.run('BEGIN TRANSACTION');

    // Ensure user exists
    await db.run(
      `INSERT OR IGNORE INTO users (chat_id) VALUES (?)`,
      [chatId]
    );

    // Check if there's already a pending request
    const existingRequest = await db.get(
      `SELECT status FROM subscription_requests WHERE chat_id = ?`,
      [chatId]
    );

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        return false; // Already has a pending request
      }
      // Update existing request
      await db.run(
        `UPDATE subscription_requests 
         SET status = 'pending', 
             requested_at = CURRENT_TIMESTAMP,
             processed_at = NULL
         WHERE chat_id = ?`,
        [chatId]
      );
    } else {
      // Create new request
      await db.run(
        `INSERT INTO subscription_requests (chat_id) VALUES (?)`,
        [chatId]
      );
    }

    await db.run('COMMIT');
    return true;
  } catch (error) {
    await db.run('ROLLBACK');
    throw error;
  }
}

export async function getPendingSubscriptionRequests(): Promise<Array<{
  chat_id: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  requested_at: string;
}>> {
  const db = await initializeDB();
  return db.all(`
    SELECT u.chat_id, u.username, u.first_name, u.last_name, sr.requested_at
    FROM subscription_requests sr
    JOIN users u ON sr.chat_id = u.chat_id
    WHERE sr.status = 'pending'
    ORDER BY sr.requested_at ASC
  `);
}

export async function storeContainerLogs(id: string, logs: string): Promise<void> {
    const db = await initializeDB();
    await db.run(
        'INSERT INTO container_logs (id, logs, created_at) VALUES (?, ?, ?)',
        [id, logs, new Date().toISOString()]
    );
}

export async function getContainerLogs(id: string): Promise<string | null> {
    const db = await initializeDB();
    const row = await db.get<ContainerLog>(
        'SELECT logs FROM container_logs WHERE id = ?',
        [id]
    );
    return row?.logs || null;
}

export async function cleanupOldLogs(hours: number = 1): Promise<void> {
    const db = await initializeDB();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
    await db.run(
        'DELETE FROM container_logs WHERE created_at < ?',
        [cutoff]
    );
}
