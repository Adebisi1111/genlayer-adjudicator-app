// server.js - GenLayer Backend Relay Server
// Signs transactions with private key and routes through Consensus Main Contract

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
const PRIVATE_KEY = process.env.SERVER_PRIVATE_KEY;
const RPC_URL = process.env.GENLAYER_RPC || "https://rpc-bradbury.genlayer.com";

if (!PRIVATE_KEY) {
  console.error("SERVER_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

// ─── GenLayer Client (signs with private key) ───────────────────
const account = privateKeyToAccount(PRIVATE_KEY);

const client = createClient({
  chain: testnetBradbury,
  account,
});

console.log("Backend relay server started");
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

    // Convert decimal GEN to wei
    const valueStr = (value || "0").toString();
    const parts = valueStr.split(".");
    const whole = parts[0] || "0";
    let frac = parts[1] || "";
    frac = frac.padEnd(18, "0").slice(0, 18);
    const valueWei = BigInt(whole + frac);

    const txHash = await client.writeContract({
      address: CONTRACT_ADDRESS,
      functionName: "open_dispute",
      args: [agent, serviceUrl, claim],
      value: valueWei,
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
