// Main app.js - UI interactions
import { openDispute, resolveDispute, getDispute } from "./wallet.mjs";

// DOM elements
const addrEl = document.getElementById("addr");
const noteEl = document.getElementById("netNote");
const btn = document.getElementById("connectBtn");
const openBtn = document.getElementById("openBtn");
const resolveBtn = document.getElementById("resolveBtn");
const readBtn = document.getElementById("readBtn");

// Status display helper
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status show " + type;
}

// Check backend health on load
async function checkBackend() {
  try {
    const res = await fetch("http://localhost:3001/health");
    const data = await res.json();
    if (data.status === "ok") {
      addrEl.textContent = data.account.slice(0,6) + "..." + data.account.slice(-4);
      noteEl.innerHTML = '<span style="color:#4ade80">● Backend Connected</span>';
      btn.textContent = "Connected";
      btn.disabled = true;
      return true;
    }
  } catch (e) {
    addrEl.textContent = "Backend not running";
    noteEl.innerHTML = '<span style="color:#f87171">● Start backend server</span>';
    btn.textContent = "Connect";
    btn.disabled = false;
    return false;
  }
}

// Connect button (retry backend connection)
btn.addEventListener("click", async () => {
  addrEl.textContent = "Connecting...";
  await checkBackend();
});

// Open dispute button
openBtn.addEventListener("click", async () => {
  try {
    showStatus("openStatus", "warn", "Opening dispute...");
    
    const agent = document.getElementById("agent").value;
    const serviceUrl = document.getElementById("service").value;
    const claim = document.getElementById("claim").value;
    const amount = document.getElementById("amount").value || "0";
    
    const result = await openDispute(agent, serviceUrl, claim, amount);
    
    if (result.success) {
      showStatus("openStatus", "ok", "Opened! Tx: " + result.txHash);
    } else {
      showStatus("openStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("openStatus", "err", "Error: " + e.message);
    console.error("Open dispute error:", e);
  }
});

// Resolve dispute button
resolveBtn.addEventListener("click", async () => {
  try {
    showStatus("resolveStatus", "warn", "Resolving with AI...");
    
    const disputeId = document.getElementById("disputeId").value;
    const result = await resolveDispute(disputeId);
    
    if (result.success) {
      showStatus("resolveStatus", "ok", "Resolved! Tx: " + result.txHash);
    } else {
      showStatus("resolveStatus", "err", "Error: " + result.error);
    }
  } catch(e) {
    showStatus("resolveStatus", "err", "Error: " + e.message);
    console.error("Resolve error:", e);
  }
});

// Read dispute button
readBtn.addEventListener("click", async () => {
  try {
    const disputeId = document.getElementById("readId").value;
    const result = await getDispute(disputeId);
    
    if (result.success) {
      document.getElementById("out").textContent = JSON.stringify(result.data, null, 2);
    } else {
      document.getElementById("out").textContent = "Error: " + result.error;
    }
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
    console.error("Read error:", e);
  }
});

// Initialize
console.log("App initialized");
checkBackend();
