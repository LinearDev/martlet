import dotenv from 'dotenv';
dotenv.config();

class Env {
    // Port to run the server on
    public readonly PORT: number = 2317;

    // Host to run the server on
    public readonly HOST: string = '0.0.0.0';

    // Telegram bot token
    public readonly TELEGRAM_BOT_TOKEN: string;

    // Default admin chat ID
    public readonly DEFAULT_ADMIN_CHAT_ID: string;

    constructor() {
        if (process.env.PORT && !Number.isNaN(parseInt(process.env.PORT))) {
            this.PORT = parseInt(process.env.PORT);
        } else {
            throw new Error('PORT is not a number');
        }

        if (process.env.HOST) {
            this.HOST = process.env.HOST;
        }
        
        if (!process.env.TELEGRAM_BOT_TOKEN) throw new Error('TELEGRAM_BOT_TOKEN must be set');
        this.TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

        if (!process.env.DEFAULT_ADMIN_CHAT_ID) throw new Error('DEFAULT_ADMIN_CHAT_ID must be set');
        this.DEFAULT_ADMIN_CHAT_ID = process.env.DEFAULT_ADMIN_CHAT_ID;
    }
}

export const env = new Env();