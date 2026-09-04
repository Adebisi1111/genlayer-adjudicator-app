# GenLayer Agent Payment Adjudicator - Backend Relay Server

## Quick Deploy

### Option 1: Render (recommended)
1. Push this repo to GitHub
2. Connect repo to Render
3. Set environment variables:
   - `SERVER_PRIVATE_KEY` = your private key
   - `GENLAYER_RPC` = https://rpc-bradbury.genlayer.com
4. Deploy

### Option 2: Railway
1. Push to GitHub
2. Connect to Railway
3. Set env vars
4. Deploy

### Option 3: Local with PM2
```bash
npm install
echo "SERVER_PRIVATE_KEY=0x..." > .env
echo "GENLAYER_RPC=https://rpc-bradbury.genlayer.com" >> .env
pm2 start server.js --name adjudicator-relay
```

## API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/health` | - | Health check |
| POST | `/open-dispute` | `{agent, serviceUrl, claim, value}` | Create dispute |
| POST | `/resolve` | `{disputeId}` | Resolve with AI |
| GET | `/dispute/:id` | - | Read dispute |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SERVER_PRIVATE_KEY` | Private key for signing (with 0x prefix) |
| `GENLAYER_RPC` | GenLayer Bradbury RPC URL |
| `PORT` | Server port (default: 3001) |
