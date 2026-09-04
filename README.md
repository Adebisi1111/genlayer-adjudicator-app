# GenLayer Agent Payment Adjudicator

## Quick Start

### 1. Start the backend server
```bash
cd genlayer-adjudicator-app
node server.js
```

### 2. Open the frontend
```
https://adebisi1111.github.io/genlayer-adjudicator-app/
```

### 3. Use the app
- Click "Connect Wallet" (checks backend health)
- Click "Open Dispute" to create a dispute
- Click "Trigger AI Resolution" to resolve with AI consensus
- Click "Fetch" to read dispute status

---

## Architecture

```
Frontend (GitHub Pages)
    ↓
Backend Server (server.js)
    ↓
GenLayer Consensus Main Contract
    ↓
Agent Payment Adjudicator Contract
```

---

## API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/health` | - | Health check |
| POST | `/open-dispute` | `{agent, serviceUrl, claim, value}` | Create dispute |
| POST | `/resolve` | `{disputeId}` | Resolve with AI |
| GET | `/dispute/:id` | - | Read dispute |

---

## Contract

- **Address**: `0x9d8712ce10a354044d6132b90C088f2677c43963`
- **Network**: GenLayer Bradbury Testnet (Chain ID: 4221)
- **Explorer**: https://explorer-bradbury.genlayer.com

---

## Dependencies

- express
- cors
- viem
- genlayer-js
