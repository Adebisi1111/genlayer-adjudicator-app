// Main app.js - UI interactions
import { connectWallet, ensureBradbury, openDispute, resolveDispute, getDispute } from "./wallet.mjs";

// DOM elements
const addrEl = document.getElementById("addr");
const noteEl = document.getElementById("netNote");
const btn = document.getElementById("connectBtn");
const openBtn = document.getElementById("openBtn");
const resolveBtn = document.getElementById("resolveBtn");
const readBtn = document.getElementById("readBtn");

let isConnected = false;

// Status display helper
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status show " + type;
}

// Connect wallet button
btn.addEventListener("click", async () => {
  if (isConnected) {
    isConnected = false;
    addrEl.textContent = "Not connected";
    noteEl.textContent = "";
    btn.textContent = "Connect Wallet";
    return;
  }

  try {
    addrEl.textContent = "Connecting...";
    
    // Step 1: Ensure Bradbury network
    await ensureBradbury();
    
    // Step 2: Connect wallet
    const account = await connectWallet();
    
    // Update UI
    addrEl.textContent = account.slice(0,6) + "..." + account.slice(-4);
    noteEl.innerHTML = '<span style="color:#4ade80">● Connected</span>';
    btn.textContent = "Disconnect";
    isConnected = true;
    
  } catch(e) {
    addrEl.textContent = "Failed: " + e.message;
    noteEl.textContent = "";
    console.error("Connection error:", e);
  }
});

// Open dispute button
openBtn.addEventListener("click", async () => {
  if (!isConnected) return showStatus("openStatus", "warn", "Connect wallet first");
  try {
    showStatus("openStatus", "warn", "Opening dispute...");
    
    const agent = document.getElementById("agent").value;
    const serviceUrl = document.getElementById("service").value;
    const claim = document.getElementById("claim").value;
    const amount = document.getElementById("amount").value || "0";
    
    const txHash = await openDispute(agent, serviceUrl, claim, amount);
    showStatus("openStatus", "ok", "Opened! Tx: " + txHash);
  } catch(e) {
    showStatus("openStatus", "err", "Error: " + e.message);
    console.error("Open dispute error:", e);
  }
});

// Resolve dispute button
resolveBtn.addEventListener("click", async () => {
  if (!isConnected) return showStatus("resolveStatus", "warn", "Connect wallet first");
  try {
    showStatus("resolveStatus", "warn", "Resolving with AI...");
    
    const disputeId = document.getElementById("disputeId").value;
    const txHash = await resolveDispute(disputeId);
    showStatus("resolveStatus", "ok", "Resolved! Tx: " + txHash);
  } catch(e) {
    showStatus("resolveStatus", "err", "Error: " + e.message);
    console.error("Resolve error:", e);
  }
});

// Read dispute button
readBtn.addEventListener("click", async () => {
  if (!isConnected) return showStatus("out", "warn", "Connect wallet first");
  try {
    const disputeId = document.getElementById("readId").value;
    const result = await getDispute(disputeId);
    document.getElementById("out").textContent = JSON.stringify(result, null, 2);
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
    console.error("Read error:", e);
  }
});

console.log("App initialized");
