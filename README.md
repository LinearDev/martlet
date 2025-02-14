# Martlet Bot

A Telegram bot built with Express.js and TypeScript that provides notifications for Jenkins builds and Docker events.

## Features

- 🤖 Telegram bot interface
- 🏗️ Jenkins build notifications
- 🐳 Docker event notifications
- 👥 User management system
- 🔐 Admin controls
- 💾 SQLite database storage

## Prerequisites

- Node.js (v20 or higher)
- npm
- Docker (optional, for containerized deployment)

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```


3. Create a Telegram bot and get your bot token from [@BotFather](https://t.me/botfather)
4. Replace the token in `.env` with your bot token

## Development

Start the development server with hot reload:

```bash
npm run dev
```

Build the project:

```bash
npm run build
```

Start the production server:

```bash
npm start
```


## Docker Deployment

Build the Docker image:

```bash
docker build -t martlet-bot .
```

Run the Docker container:

bash
docker run -d \
-p 2317:2317 \
-v /path/to/data:/app/data \
martlet


## Bot Commands

- `/start` - Register with the bot
- `/subscribe` - Request subscription to notifications
- `/unsubscribe` - Unsubscribe from notifications
- `/getchatid` - Get your chat ID
- `/makeadmin` - (Admin only) Make a user an admin
- `/makesubscriber` - (Admin only) Approve user subscription
- `/listrequests` - (Admin only) List pending subscription requests

## Webhook Endpoints

### Jenkins Webhook
- **URL**: `/jenkins-webhook`
- **Method**: POST
- Receives Jenkins build notifications and forwards them to subscribed users

### Docker Webhook
- **URL**: `/docker-webhook`
- **Method**: POST
- Receives Docker events and forwards them to subscribed users
- Use `Stevedore` to listen to Docker events and send them to the webhook

## Project Structure

- `src/` - Source code
  - `index.ts` - Main application entry point
  - `db.ts` - Database operations
  - `types.ts` - TypeScript type definitions
  - `webhooks/` - Webhook handlers
    - `jenkins.ts` - Jenkins webhook handler
    - `docker.ts` - Docker webhook handler
- `data/` - SQLite database storage
- `dist/` - Compiled JavaScript output

## Environment Variables

- `PORT` - Server port (default: 2317)
- `HOST` - Server host (default: 0.0.0.0)
- `TELEGRAM_BOT_TOKEN` - Telegram bot token
- `DEFAULT_ADMIN_CHAT_ID` - Default admin chat ID

## License

ISC

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request