// GenLayer Project: Agent Payment Adjudicator — interactive app (OPTION A: per-user wallet signing).
//
// SECURITY MODEL (per GenLayer Portal steward review):
//   This server holds NO private keys and signs NOTHING. It is a stateless
//   read-only relay + static file host. All on-chain WRITES (open_dispute,
//   resolve) are signed in the user's own browser via genlayer-js + MetaMask
//   (see public/index.html). The browser user is the on-chain payer, so no
//   unauthenticated endpoint can spend a backend wallet's value.
//
// The only state-touching endpoint is /api/dispute/:id, which performs a
// read-only view call (get_dispute) and never sends value or signs.

import express from "express";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

// Read-only client — no account attached, so it can never sign or send value.
const client = createClient({ chain: testnetBradbury });

const app = express();
app.use(express.json());
app.use(express.static("public"));

// Read a dispute (view only — no account, no value, no signing).
app.get("/api/dispute/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "get_dispute",
      args: [req.params.id],
    });
    res.json({ dispute: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const ADJUDICATOR_ADDRESS = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F"; // deployed adjudicator (corrected consensus, project instance)

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Adjudicator app (read-only relay) on http://localhost:${PORT}`));
