// server.js - GenLayer Backend Server
// Routes transactions through the Consensus Main Contract automatically

import express from "express";
import cors from "cors";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";

const app = express();
app.use(cors());
app.use(express.json());

// ─── Configuration ──────────────────────────────────────────────
const CONTRACT_ADDRESS = "0x9d8712ce10a354044d6132b90C088f2677c43963";
const PRIVATE_KEY = "0x023d076ab40ea46c59ac7ca7cecfaa2db5fa10b7a481aef27cf68e9cc5a8c0af";

// ─── GenLayer Client (auto-routes through Consensus Main Contract) ──
const account = privateKeyToAccount(PRIVATE_KEY);

const client = createClient({
  chain: testnetBradbury,
  account,
});

console.log("Backend server started");
console.log("Account:", account.address);
console.log("Contract:", CONTRACT_ADDRESS);

// ─── Routes ─────────────────────────────────────────────────────

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", account: account.address });
});

// Open dispute
app.post("/open-dispute", async (req, res) => {
  try {
    const { agent, serviceUrl, claim, value } = req.body;

    if (!agent || !serviceUrl || !claim) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "open_dispute",
      args: [agent, serviceUrl, claim],
      value: value ? BigInt(value) : 0n,
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Open dispute error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Resolve dispute
app.post("/resolve", async (req, res) => {
  try {
    const { disputeId } = req.body;

    if (!disputeId) {
      return res.status(400).json({ error: "Missing disputeId" });
    }

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "resolve",
      args: [disputeId],
    });

    res.json({ success: true, txHash });
  } catch (e) {
    console.error("Resolve error:", e);
    res.status(500).json({ error: e.message });
  }
});

// Get dispute (read)
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
    res.status(500).json({ error: e.message });
  }
});

// ─── Start Server ───────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
