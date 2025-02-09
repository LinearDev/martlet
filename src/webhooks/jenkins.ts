import { JenkinsWebhookPayload } from '../types';
import TelegramBot from 'node-telegram-bot-api';
import { getAllNotificationReceivers } from '../db';
import { Request, Response } from 'express';

export async function handleJenkinsWebhook(
    req: Request,
    res: Response,
    bot: TelegramBot
) {
    try {
        const {
            build: {
                full_url,
                number,
                phase,
                status,
                duration,
                timestamp,
                scm
            },
            name: jobName,
            display_name: displayName
        }: JenkinsWebhookPayload = req.body;

        // Format duration from milliseconds to readable format
        const formatDuration = (ms: number) => {
            const seconds = Math.floor(ms / 1000);
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            return `${minutes}m ${remainingSeconds}s`;
        };

        // Get status emoji
        const getStatusEmoji = (status: string, phase: string) => {
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
} 