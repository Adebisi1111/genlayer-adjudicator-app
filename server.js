// server.js - GenLayer read-only relay for Agent Payment Adjudicator
//
// This server holds NO private key and signs NOTHING. It serves the UI and
// proxies read-only `get_dispute` views. Every write is signed by the user's
// own browser wallet.
//
// The previous version of this file held SERVER_PRIVATE_KEY and exposed
// POST /open-dispute and POST /resolve that wrote through it. That made it a
// shared custodial hot wallet controlling an escrow contract: anyone who could
// reach the endpoint could deposit and trigger payout from one pooled balance,
// and no dispute was attributable to the person who opened it. The README had
// claimed the opposite - "The server holds NO private keys and signs NOTHING" -
// so the code was contradicting its own documentation.

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

const app = express();
app.use(cors());
app.use(express.json());

const CONTRACT_ADDRESS = "0x7b6133E6950c88e002169FeA28dED15c9AFA0a03";
const RPC_URL = process.env.GENLAYER_RPC || "https://studio-dev.genlayer.com/api";

// No account is configured on purpose. A client carrying an account can sign;
// this one cannot, so a write added here later fails loudly instead of quietly
// spending from a pooled key.
const client = createClient({ chain: studioDevnet });

console.log("Read-only relay started (no signing key)");
console.log("Contract:", CONTRACT_ADDRESS);
console.log("RPC:", RPC_URL);

// ─── Routes ─────────────────────────────────────────────────────

// Reports that this relay is read-only, so the frontend never posts to it.
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    readOnly: true,
    signer: null,
    contract: CONTRACT_ADDRESS,
  });
});

// Open dispute — RETURNS CALLDATA ONLY. The browser submits it with the
// user's own wallet, so the deposit is genuinely theirs and attributable.
app.post("/open-dispute", async (req, res) => {
  const { agent, serviceUrl, claim } = req.body || {};
  if (!agent || !serviceUrl || !claim) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!/^0x[0-9a-fA-F]{40}$/.test(String(agent))) {
    return res.status(400).json({ error: "Agent must be a valid address" });
  }
  res.json({
    buildOnly: true,
    functionName: "open_dispute",
    args: [agent, serviceUrl, claim],
    note: "Sign and submit this from your own wallet. This relay does not send value.",
  });
});

// Resolve dispute — CALLDATA ONLY, same reasoning.
app.post("/resolve", async (req, res) => {
  const { disputeId } = req.body || {};
  if (!disputeId) {
    return res.status(400).json({ error: "Missing disputeId" });
  }
  res.json({
    buildOnly: true,
    functionName: "resolve",
    args: [disputeId],
    note: "Sign and submit this from your own wallet. This relay does not send value.",
  });
});

// Get dispute (read) — the only thing this process asks the chain for.
app.get("/dispute/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: CONTRACT_ADDRESS,
      functionName: "get_dispute",
      args: [req.params.id],
    });
    res.json({ success: true, data: result });
  } catch (e) {
    console.error("Get dispute error:", e);
    res.status(404).json({ error: e.message });
  }
});

// ─── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});