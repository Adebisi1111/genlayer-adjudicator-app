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

- **Address**: `0x7b6133E6950c88e002169FeA28dED15c9AFA0a03`
- **Network**: GenLayer Studio Devnet (Chain ID: 61997)
- **Explorer**: https://explorer-studio-dev.genlayer.com/address/0x7b6133E6950c88e002169FeA28dED15c9AFA0a03
- **Source**: [`contracts/agent_payment_adjudicator_v2.py`](contracts/agent_payment_adjudicator_v2.py)

Source: https://github.com/Adebisi1111/genlayer-adjudicator-app/blob/main/contracts/agent_payment_adjudicator.py

> `0x9d8712ce...` (Bradbury 4221) and `0xa80BD90c...` are both superseded. On
> Bradbury `resolve()` never completed on any dispute, including ones predating
> this work, because the payout used the wrong transfer path. See below.

---

## Escrow payout — how it works

A wallet is **not** an Intelligent Contract; it is an account on the chain
underneath. `gl.get_contract_at(addr).emit_transfer(...)` posts an **internal**
message (`PostMessage`) addressed to another Intelligent Contract. Send one to a
wallet and it is accepted, recorded and dropped — no error, no movement, and the
balance is not even deducted.

Paying a wallet must leave through the ghost contract as an **external**
message, addressed via an empty EVM interface. It takes `value` only, with no
`on`, because an external message always executes on finalization:

```python
@gl.evm.contract_interface
class _Recipient:
    class View: pass
    class Write: pass

_Recipient(Address(payer)).emit_transfer(value=payout)
```

The payout lands when the transaction **FINALIZES**, not when it is accepted.
Between those two points the contract still reports the full balance, so a
caller that samples once after the write reads a number that is about to change.

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
