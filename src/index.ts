import { env } from './env';

import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import {
    initializeDB,
    addUser,
    setAdmin,
    setNotificationReceiver,
    isAdmin,
    requestSubscription,
    getPendingSubscriptionRequests,
    cleanupOldLogs
} from './db';
import { handleJenkinsWebhook } from './webhooks/jenkins';
import { handleDockerWebhook } from './webhooks/docker';
import { handleCallbackQuery } from './handlers/callbackQueryHandler';

// Express app setup
const app = express();

// Add JSON parsing middleware
app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        status: 'Bot server is running!',
        time: new Date().toISOString()
    });
});

// Initialize database when starting the server
initializeDB().then(() => {
    console.log('Database initialized');
}).catch(error => {
    console.error('Database initialization failed:', error);
});

// Update webhook endpoints
app.post('/jenkins-webhook', (req, res) => handleJenkinsWebhook(req, res, bot));
app.post('/docker-webhook', (req, res) => handleDockerWebhook(req, res, bot));

app.listen(env.PORT, env.HOST, () => {
    console.log(`Server is running on port ${env.PORT}`);
});

// Telegram bot setup

// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: true });

// Initialize commands
async function setupBotCommands() {
    await bot.setMyCommands([
        {
            command: 'start',
            description: 'Register with the bot'
        },
        {
            command: 'subscribe',
            description: 'Subscribe to Jenkins notifications'
        },
        {
            command: 'unsubscribe',
            description: 'Unsubscribe from Jenkins notifications'
        },
        {
            command: 'makeadmin',
            description: '(Admin only) Make a user an admin'
        },
        {
            command: 'makesubscriber',
            description: '(Admin only) Approve user subscription'
        },
        {
            command: 'getchatid',
            description: 'Get your chat ID'
        },
        {
            command: 'listrequests',
            description: '(Admin only) List pending subscription requests'
        }
    ]);
}

// Initialize commands
setupBotCommands().catch(error => {
    console.error('Failed to set up bot commands:', error);
});

// Error handling for the bot
bot.on('polling_error', (error) => {
    console.error('Polling error:', error);
});

bot.on('error', (error) => {
    console.error('General bot error:', error);
});

// Add command handlers for admin management
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id.toString();
    await addUser(
        chatId,
        msg.from?.username,
        msg.from?.first_name,
        msg.from?.last_name
    );
    bot.sendMessage(chatId, 'Welcome! You have been registered.');
});

bot.onText(/\/makeadmin (.+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    if (!await isAdmin(chatId)) {
        return bot.sendMessage(chatId, 'You are not authorized to use this command.');
    }

    if (!match) return;
    const targetUser = match[1];
    await setAdmin(targetUser, true);
    bot.sendMessage(chatId, `User ${targetUser} is now an admin.`);
});

bot.onText(/\/subscribe/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const adminChatId = '486583163';
    
    // If the requester is the default admin, auto-approve
    if (chatId === adminChatId) {
        await setNotificationReceiver(chatId, true);
        return bot.sendMessage(chatId, 'Subscription activated. You will now receive Jenkins notifications.');
    }

    // For other users, notify admin
    await requestSubscription(chatId);
    
    // Notify the admin
    const username = msg.from?.username ? `@${msg.from.username}` : chatId;
    const approvalMessage = `User ${username} requests notification access.\n` +
        `To approve, use:\n/makesubscriber ${chatId}`;
    
    await bot.sendMessage(adminChatId, approvalMessage);
    
    // Notify the requester
    bot.sendMessage(chatId, 'Your subscription request has been sent to admin for approval.');
});

bot.onText(/\/unsubscribe/, async (msg) => {
    const chatId = msg.chat.id.toString();
    await setNotificationReceiver(chatId, false);
    bot.sendMessage(chatId, 'You will no longer receive Jenkins notifications.');
});

// Add new command for admin to approve subscribers
bot.onText(/\/makesubscriber (.+)/, async (msg, match) => {
    const adminChatId = msg.chat.id.toString();
    if (!await isAdmin(adminChatId)) {
        return bot.sendMessage(adminChatId, 'You are not authorized to use this command.');
    }

    if (!match) return;
    const targetUser = match[1];
    await setNotificationReceiver(targetUser, true);
    
    // Notify admin of success
    await bot.sendMessage(adminChatId, `User ${targetUser} can now receive notifications.`);
    
    // Notify the approved user
    await bot.sendMessage(targetUser, 'Your subscription request has been approved. You will now receive Jenkins notifications.');
});

// Add this with other command handlers
bot.onText(/\/getchatid/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, `Your chat ID is: <code>${chatId}</code>`, {
        parse_mode: 'HTML'
    });
});

// Add the command handler
bot.onText(/\/listrequests/, async (msg) => {
    const chatId = msg.chat.id.toString();
    
    if (!await isAdmin(chatId)) {
        return bot.sendMessage(chatId, 'You are not authorized to use this command.');
    }

    const requests = await getPendingSubscriptionRequests();
    
    if (requests.length === 0) {
        return bot.sendMessage(chatId, 'No pending subscription requests.');
    }

    const message = requests.map(req => {
        const name = req.username ? 
            `@${req.username}` : 
            `${req.first_name || ''} ${req.last_name || ''}`.trim() || 'Unknown';
        return `User: ${name}\nChat ID: ${req.chat_id}\nRequested: ${new Date(req.requested_at).toLocaleString()}`;
    }).join('\n\n');

    bot.sendMessage(chatId, `Pending Subscription Requests:\n\n${message}`);
});

bot.on('callback_query', (query) => {
    handleCallbackQuery(bot, query).catch(console.error);
});

// Clean up old logs every hour
setInterval(() => {
    cleanupOldLogs().catch(console.error);
}, 60 * 60 * 1000);