// GenLayer Project: Agent Payment Adjudicator — interactive app that ACTUALLY
// interacts with the deployed Intelligent Contract on Bradbury testnet.
//
// Use case: when a payer hires an autonomous agent and the service isn't delivered,
// the payer opens a dispute (depositing the contested amount), and anyone can trigger
// resolution. The contract fetches the live service URL, asks an LLM to judge delivery
// under the equivalence principle, then refunds the payer or pays the agent.
//
// This app is real app logic: it calls open_dispute / resolve / get_dispute on-chain.

import express from "express";
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { privateKeyToAccount } from "viem/accounts";
import { scryptSync, createDecipheriv } from "crypto";
import { keccak256 } from "viem";
import { toBytes } from "viem";
import { readFileSync } from "fs";

// --- Config -----------------------------------------------------------------
const ADJUDICATOR_ADDRESS = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F"; // deployed adjudicator (corrected consensus, project instance)
const KEYSTORE = "/home/administrator/.genlayer/keystores/testwallet.json";
const KEY_PASSWORD = "genlayer2026";

// --- Wallet (test wallet, separate from main) --------------------------------
function decryptKeystoreV3(ks, password) {
  const c = ks.Crypto || ks.crypto;
  const kp = c.kdfparams;
  const derivedKey = scryptSync(Buffer.from(password, "utf8"), Buffer.from(kp.salt, "hex"), kp.dklen, {
    N: kp.n, r: kp.r, p: kp.p, maxmem: 256 * 1024 * 1024,
  });
  const ct = Buffer.from(c.ciphertext, "hex");
  const iv = Buffer.from(c.cipherparams.iv, "hex");
  const d = createDecipheriv(c.cipher, derivedKey.slice(0, 16), iv);
  const key = Buffer.concat([d.update(ct), d.final()]);
  const mac = Buffer.from(c.mac, "hex");
  const check = Buffer.from(keccak256(toBytes("0x" + Buffer.concat([derivedKey.slice(16, 32), ct]).toString("hex"))).replace(/^0x/, ""), "hex");
  if (!mac.equals(check)) throw new Error("keystore mac mismatch");
  return "0x" + key.toString("hex");
}
const keystoreJson = JSON.parse(readFileSync(KEYSTORE, "utf8"));
const account = privateKeyToAccount(decryptKeystoreV3(keystoreJson, KEY_PASSWORD));

// --- GenLayer client ---------------------------------------------------------
const client = createClient({ chain: testnetBradbury });
client.account = account;

// --- Express app -------------------------------------------------------------
const app = express();
app.use(express.json());
app.use(express.static("public"));

// Open a dispute (payable write) — deposits the contested amount.
app.post("/api/open", async (req, res) => {
  try {
    const { agent, service_url, claim, amount } = req.body;
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "open_dispute",
      args: [agent, service_url, claim],
      value: BigInt(amount || 0),
      account,
    });
    res.json({ txHash });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Trigger resolution (write).
app.post("/api/resolve", async (req, res) => {
  try {
    const { dispute_id } = req.body;
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "resolve",
      args: [dispute_id],
      value: 0n,
      account,
    });
    res.json({ txHash });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

// Read a dispute (view).
app.get("/api/dispute/:id", async (req, res) => {
  try {
    const result = await client.readContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "get_dispute",
      args: [req.params.id],
      account,
    });
    res.json({ dispute: result });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Adjudicator app on http://localhost:${PORT}`));
