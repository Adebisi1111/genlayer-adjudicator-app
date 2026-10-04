# GenLayer Agent Payment Adjudicator — Backend Relay Server

## This server holds no private key and signs nothing.

It serves the UI and answers read-only `get_dispute` queries. Every write is
signed by the user's own browser wallet, so the escrow deposit is genuinely the
payer's and each dispute is attributable to whoever opened it.

An earlier version of `server.js` held `SERVER_PRIVATE_KEY` and wrote through
it. That made it a shared custodial hot wallet controlling an escrow contract:
anyone who could reach the endpoint could deposit and trigger payout from one
pooled balance. The key is gone, and `render.yaml` no longer requests one.

## Quick Deploy

`render.yaml` is committed, so Render picks the config up on connect. No
secrets are required.

### Render
1. Connect this repo to Render as a Web Service
2. Deploy — `render.yaml` sets `GENLAYER_RPC` and the start command

### Local
```bash
npm install
node server.js
# http://localhost:3001
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GENLAYER_RPC` | no | Defaults to `https://studio-dev.genlayer.com/api` |
| `PORT` | no | Server port (default: 3001) |
| `SERVER_PRIVATE_KEY` | **never** | Removed. Setting it has no effect; the relay cannot sign. |

## API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/health` | - | Reports `readOnly: true` and the contract address |
| POST | `/open-dispute` | `{agent, serviceUrl, claim}` | Returns calldata only; the browser signs |
| POST | `/resolve` | `{disputeId}` | Returns calldata only; the browser signs |
| GET | `/dispute/:id` | - | Read a dispute |

**No endpoint can move value.** The two POST routes validate input and hand
back the calldata for the browser to submit with the user's wallet.

## Contract

- `0x7b6133E6950c88e002169FeA28dED15c9AFA0a03` on GenLayer Studio Devnet (61997)