# Agent Payment Adjudicator — Interactive App

A working application that **actually interacts with a deployed GenLayer Intelligent Contract** on the Bradbury testnet. It is the app layer for the *Agent Payment Adjudicator* — dispute resolution for the agentic economy.

## What it does

- **Opens a dispute** — submits a real `open_dispute` transaction (payable: deposits the contested amount). The contract holds the funds until a verdict.
- **Triggers resolution** — calls `resolve`, which fetches the live service URL (`gl.nondet.web.render`), asks an LLM to judge delivery (`gl.nondet.exec_prompt`), and runs it through the equivalence principle (`gl.vm.run_nondet`). If NOT_DELIVERED → refunds the payer; if DELIVERED → pays the agent.
- **Reads a dispute** — calls `get_dispute` and returns the live on-chain record.

This is genuine app logic talking to GenLayer — not a static visualization.

## Security model — per-user wallet signing (Portal-steward compliant)

This app implements **per-user wallet signing**, the model requested by the GenLayer Portal review:

- **The server holds NO private keys and signs NOTHING.** `server.js` is a stateless, read-only relay: it only serves the static UI and proxies the read-only `get_dispute` view. It cannot send value or sign any transaction.
- **All writes are signed in the user's own browser** via `genlayer-js` + MetaMask (`client.connect()` → `window.ethereum`). The connected wallet is the on-chain payer and signer for `open_dispute` / `resolve`. The browser user — not a backend wallet — pays gas and the dispute deposit.
- **No unauthenticated spend is possible:** there is no backend key to spend, and write endpoints do not exist server-side.
- **Testnet only.** The app targets GenLayer Bradbury testnet; no mainnet value is at risk.

## Architecture

- `server.js` — Node + Express, **read-only relay**. `createClient({ chain: testnetBradbury })` with no account. Serves `public/` and `GET /api/dispute/:id` (view call only).
- `public/index.html` — brown/butter UI. "Connect Wallet" uses `genlayer-js` `connect()` (MetaMask). `open_dispute` / `resolve` run client-side via `client.writeContract` with the user's account.
- Endpoints:
  - `GET /api/dispute/:id` → reads live contract state (view, no key, no value)
  - Writes (`open_dispute`, `resolve`) → executed in-browser by the user's wallet

## Run locally

```bash
npm install
npm start
# open http://localhost:3001 and click "Connect Wallet" (MetaMask on Bradbury testnet)
```

## Deployed contract

- **Agent Payment Adjudicator**: `0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F`
- Explorer: https://explorer-bradbury.genlayer.com/address/0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F
- Contract source + tests: https://github.com/Adebisi1111/genlayer-adjudicator

## Use case

When a payer hires an autonomous agent and the service isn't delivered, there's no built-in recourse. This Project gives the agentic economy a neutral, AI-verified escrow: the payer deposits the fee, the contract checks the *actual* service state via live web evidence and LLM adjudication under GenLayer consensus, then releases funds to the right party. No human arbitrator, no trust in either side's claim.
