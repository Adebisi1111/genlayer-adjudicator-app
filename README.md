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
Frontend (GitHub Pages)  ── writes signed by the user's own MetaMask ──┐
                                                                    ↓
Read-only relay (server.js)  ── GET /dispute/:id only ────────────────┤
                                                                    ↓
                                        GenLayer Consensus Main Contract
                                                                    ↓
                                        Agent Payment Adjudicator Contract
```

The relay holds no key and signs nothing. It serves the UI and answers reads.
`open_dispute` and `resolve` are submitted by the browser with the connected
wallet, so the escrow deposit is genuinely the payer's and each dispute is
attributable to the person who opened it.

An earlier version of `server.js` held `SERVER_PRIVATE_KEY` and wrote through
it. That was a shared custodial hot wallet on an escrow contract: anyone who
could reach the endpoint could deposit and trigger payout from one pooled
balance. The key is gone, and `render.yaml` no longer requests one.

---

## API Endpoints

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/health` | - | Reports `readOnly: true` |
| POST | `/open-dispute` | `{agent, serviceUrl, claim}` | Returns calldata only; browser signs |
| POST | `/resolve` | `{disputeId}` | Returns calldata only; browser signs |
| GET | `/dispute/:id` | - | Read dispute |

No endpoint can move value.

---

## Contract

- **Address**: `0x9d8712ce10a354044d6132b90C088f2677c43963`
- **Network**: GenLayer Bradbury Testnet (Chain ID: 4221)
- **Explorer**: https://explorer-bradbury.genlayer.com/address/0x9d8712ce10a354044d6132b90C088f2677c43963

Source: https://github.com/Adebisi1111/genlayer-adjudicator-app/blob/main/contracts/agent_payment_adjudicator.py

> The address above is the current deployment. `0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F`
> appears in earlier revisions of this file and in older frontend builds; it is
> superseded. The frontend now hard-codes `0x9d8712ce...`.

---

## Tests

```
python3.14 -m pytest tests/ -q      # 13 contract tests
ESCROW_PK=... node e2e-frontend.mjs # 7 browserless frontend tests
```

`tests/direct/test_adversarial.py` covers the escrow path: unknown dispute ids,
unreachable evidence defaulting to a refund, an invented verdict, self-named
disputes, deposit-amount fidelity, counter uniqueness, double-resolve, and
agent-address substitution.

---

## Dependencies

- express
- cors
- viem
- genlayer-js 1.1.8 (Bradbury runs the 1.x SDK; there is no fee-distribution
  concept in it, so writes carry none)
