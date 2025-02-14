import TelegramBot from 'node-telegram-bot-api';
import { getContainerLogs } from '../db';

declare global {
    var containerLogs: Map<string, string>;
}

export async function handleCallbackQuery(bot: TelegramBot, query: TelegramBot.CallbackQuery) {
    const [action, logId] = query.data?.split(':') || [];

    if (action === 'show_logs') {
        const logs = await getContainerLogs(logId);
        if (!logs) {
            await bot.answerCallbackQuery(query.id, {
                text: 'Logs are no longer available',
                show_alert: true
            });
            return;
        }

        // Edit the message to show logs
        const messageText = query.message?.text + `\n\n<pre>${logs}</pre>`;
        await bot.editMessageText(messageText!, {
            chat_id: query.message?.chat.id,
            message_id: query.message?.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: "Hide Logs 📝", callback_data: `hide_logs:${logId}` }
                ]]
            }
        });
    } else if (action === 'hide_logs') {
        // Edit the message to hide logs
        const messageText = query.message?.text?.split('Logs available')[0].trim() + " Logs available (hidden)" || '';
        await bot.editMessageText(messageText, {
            chat_id: query.message?.chat.id,
            message_id: query.message?.message_id,
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [[
                    { text: "Show Logs 📝", callback_data: `show_logs:${logId}` }
                ]]
            }
        });
    }

    await bot.answerCallbackQuery(query.id);
} 