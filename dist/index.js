"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_telegram_bot_api_1 = __importDefault(require("node-telegram-bot-api"));
const express_1 = __importDefault(require("express"));
const db_1 = require("./db");
// Express app setup
const app = (0, express_1.default)();
const port = process.env.PORT || 2317;
// Add JSON parsing middleware
app.use(express_1.default.json());
app.get('/', (req, res) => {
    res.json({
        status: 'Bot server is running!',
        time: new Date().toISOString()
    });
});
// Initialize database when starting the server
(0, db_1.initializeDB)().then(() => {
    console.log('Database initialized');
}).catch(error => {
    console.error('Database initialization failed:', error);
});
// Update the webhook endpoint to send to all notification receivers
app.post('/jenkins-webhook', async (req, res) => {
    console.log(req.body);
    try {
        const { build: { full_url, number, phase, status, duration, timestamp, scm }, name: jobName, display_name: displayName } = req.body;
        // Format duration from milliseconds to readable format
        const formatDuration = (ms) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        };
        // Get status emoji
        const getStatusEmoji = (status, phase) => {
            const currentStatus = status || phase;
            switch (currentStatus.toUpperCase()) {
                case 'SUCCESS':
                    return '✅';
                case 'FAILURE':
                    return '❌';
                case 'UNSTABLE':
                    return '⚠️';
                case 'ABORTED':
                    return '⏹️';
                case 'STARTED':
                    return '🚀';
                default:
                    return '🔔';
            }
        };
        const statusEmoji = getStatusEmoji(status, phase);
        const buildDate = new Date(timestamp).toLocaleString();
        const message = `${statusEmoji} <b>Jenkins Build Update</b>

🏗️ <b>Project:</b> ${displayName || jobName}
🔢 <b>Build:</b> #${number}
📊 <b>Status:</b> ${status || phase}
⏱️ <b>Duration:</b> ${formatDuration(duration)}
🕒 <b>Time:</b> ${buildDate}
${scm?.branch ? `🌿 <b>Branch:</b> ${scm.branch}\n` : ''}${scm?.commit ? `📝 <b>Commit:</b> ${scm.commit.slice(0, 7)}\n` : ''}
${full_url ? `🔗 <a href="${full_url}">View Build Details</a>` : ''}`;
        // Get all users who can receive notifications
        const receivers = await (0, db_1.getAllNotificationReceivers)();
        // Send to all receivers
        await Promise.all(receivers.map(chatId => bot.sendMessage(chatId, message, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        })));
        res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('Error processing Jenkins webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process Jenkins notification'
        });
    }
});
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
// Telegram bot setup
// replace the value below with the Telegram token you receive from @BotFather
const token = '7556519328:AAGuiG1xIIJHMi_jkUC_i2SKW_DM1co1FgU';
// Create a bot that uses 'polling' to fetch new updates
const bot = new node_telegram_bot_api_1.default(token, { polling: true });
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
        }
    ]);
}
// Initialize commands
setupBotCommands().catch(error => {
    console.error('Failed to set up bot commands:', error);
});
// Matches "/echo [whatever]"
bot.onText(/\/echo (.+)/, (msg, match) => {
    // 'msg' is the received Message from Telegram
    // 'match' is the result of executing the regexp above on the text content
    // of the message
    const chatId = msg.chat.id;
    if (!match) {
        return;
    }
    const resp = match[1]; // the captured "whatever"
    // send back the matched "whatever" to the chat
    bot.sendMessage(chatId, resp);
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
    await (0, db_1.addUser)(chatId, msg.from?.username, msg.from?.first_name, msg.from?.last_name);
    bot.sendMessage(chatId, 'Welcome! You have been registered.');
});
bot.onText(/\/makeadmin (.+)/, async (msg, match) => {
    const chatId = msg.chat.id.toString();
    if (!await (0, db_1.isAdmin)(chatId)) {
        return bot.sendMessage(chatId, 'You are not authorized to use this command.');
    }
    if (!match)
        return;
    const targetUser = match[1];
    await (0, db_1.setAdmin)(targetUser, true);
    bot.sendMessage(chatId, `User ${targetUser} is now an admin.`);
});
bot.onText(/\/subscribe/, async (msg) => {
    const chatId = msg.chat.id.toString();
    const adminChatId = '486583163';
    // If the requester is the default admin, auto-approve
    if (chatId === adminChatId) {
        await (0, db_1.setNotificationReceiver)(chatId, true);
        return bot.sendMessage(chatId, 'Subscription activated. You will now receive Jenkins notifications.');
    }
    // For other users, notify admin
    await (0, db_1.requestSubscription)(chatId);
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
    await (0, db_1.setNotificationReceiver)(chatId, false);
    bot.sendMessage(chatId, 'You will no longer receive Jenkins notifications.');
});
// Add new command for admin to approve subscribers
bot.onText(/\/makesubscriber (.+)/, async (msg, match) => {
    const adminChatId = msg.chat.id.toString();
    if (!await (0, db_1.isAdmin)(adminChatId)) {
        return bot.sendMessage(adminChatId, 'You are not authorized to use this command.');
    }
    if (!match)
        return;
    const targetUser = match[1];
    await (0, db_1.setNotificationReceiver)(targetUser, true);
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
//# sourceMappingURL=index.js.map