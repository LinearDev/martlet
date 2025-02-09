import { DockerEvent } from '../types';
import TelegramBot from 'node-telegram-bot-api';
import { getAllNotificationReceivers } from '../db';
import { Request, Response } from 'express';

export async function handleDockerWebhook(
    req: Request,
    res: Response,
    bot: TelegramBot
) {
    console.log('Docker event received:', req.body);
    
    try {
        const event: DockerEvent = req.body;
        
        // Format the timestamp
        const eventTime = new Date(event.time * 1000).toLocaleString();
        
        // Get event emoji based on type and action
        const getEventEmoji = (type: string, action: string) => {
            const eventKey = `${type}:${action}`.toLowerCase();
            switch (eventKey) {
                // Container events
                case 'container:create':
                    return '📦';
                case 'container:start':
                    return '🚀';
                case 'container:stop':
                    return '🛑';
                case 'container:die':
                    return '⚰️';
                case 'container:kill':
                    return '💀';
                case 'container:restart':
                    return '🔄';
                case 'container:pause':
                    return '⏸️';
                case 'container:unpause':
                    return '▶️';
                case 'container:rename':
                    return '✏️';
                case 'container:oom':
                    return '💥';  // Out of memory
                case 'container:update':
                    return '🔧';
                case 'container:health_status':
                    return '💟';

                // Image events
                case 'image:pull':
                    return '⬇️';
                case 'image:delete':
                    return '🗑️';
                case 'image:tag':
                    return '🏷️';
                case 'image:untag':
                    return '📝';
                case 'image:push':
                    return '⬆️';

                // Volume events
                case 'volume:create':
                    return '💾';
                case 'volume:destroy':
                    return '🔨';
                case 'volume:mount':
                    return '🔌';
                case 'volume:unmount':
                    return '⚡';

                // Network events
                case 'network:create':
                    return '🌐';
                case 'network:destroy':
                    return '🔥';
                case 'network:connect':
                    return '🔗';
                case 'network:disconnect':
                    return '❌';

                default:
                    return '🔔';
            }
        };

        const emoji = getEventEmoji(event.Type, event.Action);
        const containerName = event.Actor.Attributes.name || 'unnamed';
        const image = event.Actor.Attributes.image || 'unknown';
        
        // Create status message based on event type
        let statusInfo = '';
        if (event.Type === 'container' && event.Action === 'die') {
            const exitCode = event.Actor.Attributes.exitCode;
            statusInfo = `\n📊 <b>Exit Code:</b> ${exitCode}`;
        }

        const message = `${emoji} <b>Docker Event</b>

🔧 <b>Type:</b> ${event.Type}
📋 <b>Action:</b> ${event.Action}
🏷️ <b>Container:</b> ${containerName}
🖼️ <b>Image:</b> ${image}${statusInfo}
⏰ <b>Time:</b> ${eventTime}`;

        // Get all notification receivers
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
        console.error('Error processing Docker webhook:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to process Docker notification'
        });
    }
} 