import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import {
    initializeDB,
    addUser,
    setAdmin,
    setNotificationReceiver,
    isAdmin,
    getAllNotificationReceivers,
    requestSubscription
} from './db';

// Express app setup
const app = express();
const port = process.env.PORT || 3000;

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

// Update the webhook endpoint to send to all notification receivers
app.post('/jenkins-webhook', async (req, res) => {
    try {
        const {
            build: {
                full_url,
                number,
                phase,
                status,
                duration,
                timestamp
            },
            name: jobName
        } = req.body;

        const message = `🔔 Jenkins Build Update
Job: ${jobName}
Build: #${number}
Status: ${status || phase}
${full_url ? `\nDetails: ${full_url}` : ''}`;

        // Get all users who can receive notifications
        const receivers = await getAllNotificationReceivers();

        // Send to all receivers
        await Promise.all(
            receivers.map(chatId =>
                bot.sendMessage(chatId, message, {
                    parse_mode: 'HTML',
                    disable_web_page_preview: true
                })
            )
        );

        res.status(200).json({ success: true });
    } catch (error) {
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
const bot = new TelegramBot(token, { polling: true });

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