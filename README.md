# Agent Payment Adjudicator — Interactive App

A working application that **actually interacts with a deployed GenLayer Intelligent Contract** on the Bradbury testnet. It is the app layer for the *Agent Payment Adjudicator* — dispute resolution for the agentic economy.

## What it does

- **Opens a dispute** — submits a real `open_dispute` transaction (payable: deposits the contested amount). The contract holds the funds until a verdict.
- **Triggers resolution** — calls `resolve`, which fetches the live service URL (`gl.nondet.web.render`), asks an LLM to judge delivery (`gl.nondet.exec_prompt`), and runs it through the equivalence principle (`gl.vm.run_nondet`). If NOT_DELIVERED → refunds the payer; if DELIVERED → pays the agent.
- **Reads a dispute** — calls `get_dispute` and returns the live on-chain record.

This is genuine app logic talking to GenLayer — not a static visualization.

## Architecture

- `server.js` — Node + Express backend using `genlayer-js` (`createClient({ chain: testnetBradbury })`). Loads the test wallet from the genlayer keystore, exposes three endpoints.
- `public/index.html` — brown/butter UI to open disputes, resolve them, and read state.
- Endpoints:
  - `POST /api/open` `{ agent, service_url, claim, amount }` → opens a dispute (write)
  - `POST /api/resolve` `{ dispute_id }` → triggers resolution (write)
  - `GET /api/dispute/:id` → reads live contract state (view)

## Run locally

```bash
npm install
GENLAYER_KEYSTORE=/path/to/keystore.json GENLAYER_KEYPASS=... npm start
# open http://localhost:3001
```

## Deployed contract

- **Agent Payment Adjudicator**: `0x890BE3B1168779Cde231793a0D599f7D08A06Cc8`
- Explorer: https://explorer-bradbury.genlayer.com/address/0x890BE3B1168779Cde231793a0D599f7D08A06Cc8
- Contract source + tests: https://github.com/Adebisi1111/genlayer-adjudicator

## Use case

When a payer hires an autonomous agent and the service isn't delivered, there's no built-in recourse. This Project gives the agentic economy a neutral, AI-verified escrow: the payer deposits the fee, the contract checks the *actual* service state via live web evidence and LLM adjudication under GenLayer consensus, then releases funds to the right party. No human arbitrator, no trust in either side's claim.
