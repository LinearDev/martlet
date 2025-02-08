"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeDB = initializeDB;
exports.addUser = addUser;
exports.setAdmin = setAdmin;
exports.setNotificationReceiver = setNotificationReceiver;
exports.isAdmin = isAdmin;
exports.canReceiveNotifications = canReceiveNotifications;
exports.getAllNotificationReceivers = getAllNotificationReceivers;
exports.requestSubscription = requestSubscription;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
let db = null;
const DEFAULT_ADMIN_CHAT_ID = '486583163';
async function initializeDB() {
    if (db)
        return db;
    // Ensure data directory exists
    const dbDir = path_1.default.join(__dirname, '../data');
    if (!fs_1.default.existsSync(dbDir)) {
        fs_1.default.mkdirSync(dbDir, { recursive: true });
    }
    db = await (0, sqlite_1.open)({
        filename: path_1.default.join(__dirname, '../data/bot.db'),
        driver: sqlite3_1.default.Database
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
async function addUser(chatId, username, firstName, lastName) {
    const db = await initializeDB();
    await db.run(`INSERT OR IGNORE INTO users (chat_id, username, first_name, last_name)
     VALUES (?, ?, ?, ?)`, [chatId, username, firstName, lastName]);
}
async function setAdmin(chatId, isAdmin) {
    const db = await initializeDB();
    await db.run('UPDATE users SET is_admin = ? WHERE chat_id = ?', [isAdmin ? 1 : 0, chatId]);
}
async function setNotificationReceiver(chatId, canReceive) {
    const db = await initializeDB();
    await db.run('UPDATE users SET can_receive_notifications = ? WHERE chat_id = ?', [canReceive ? 1 : 0, chatId]);
}
async function isAdmin(chatId) {
    const db = await initializeDB();
    const row = await db.get('SELECT is_admin FROM users WHERE chat_id = ?', [chatId]);
    return row?.is_admin === 1;
}
async function canReceiveNotifications(chatId) {
    const db = await initializeDB();
    const row = await db.get('SELECT can_receive_notifications FROM users WHERE chat_id = ?', [chatId]);
    return row?.can_receive_notifications === 1;
}
async function getAllNotificationReceivers() {
    const db = await initializeDB();
    const rows = await db.all('SELECT chat_id FROM users WHERE can_receive_notifications = 1');
    return rows.map(row => row.chat_id);
}
async function requestSubscription(chatId) {
    const db = await initializeDB();
    // Check if user exists, if not add them
    await db.run(`INSERT OR IGNORE INTO users (chat_id) VALUES (?)`, [chatId]);
    return true;
}
//# sourceMappingURL=db.js.map