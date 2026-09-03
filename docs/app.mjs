import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const ADDR = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";

let client = null;
let account = null;
let isConnected = false;

const addrEl = document.getElementById("addr");
const noteEl = document.getElementById("netNote");
const btn = document.getElementById("connectBtn");

btn.addEventListener("click", async () => {
  if (isConnected) disconnectWallet();
  else await connectWallet();
});

async function connectWallet() {
  if (isConnected) return;
  addrEl.textContent = "Connecting...";
  try {
    if (!window.ethereum) {
      addrEl.textContent = "Wallet not detected";
      return;
    }
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No accounts found");
    account = accounts[0];
    client = createClient({ chain: testnetBradbury, account });
    isConnected = true;
    addrEl.textContent = accounts[0].slice(0,6) + "..." + accounts[0].slice(-4);
    noteEl.innerHTML = '<span style="color:#4ade80">● Connected</span>';
    btn.textContent = "Disconnect";
    console.log("Connected as", accounts[0]);
  } catch(e) {
    addrEl.textContent = "Failed: " + e.message;
    console.error("Connection error:", e);
  }
}

function disconnectWallet() {
  client = null;
  account = null;
  isConnected = false;
  addrEl.textContent = "Not connected";
  noteEl.textContent = "";
  btn.textContent = "Connect Wallet";
  console.log("Disconnected");
}

window.openDispute = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    showStatus("openStatus", "Opening dispute...");
    const amountGen = document.getElementById("amount").value || "0";
    const parts = amountGen.split(".");
    const whole = parts[0] || "0";
    let frac = parts[1] || "";
    frac = frac.padEnd(18, "0").slice(0, 18);
    const valueWei = BigInt(whole + frac);
    const txHash = await client.writeContract({
      address: ADDR,
      functionName: "open_dispute",
      args: [document.getElementById("agent").value, document.getElementById("service").value, document.getElementById("claim").value],
      value: valueWei,
    });
    showStatus("openStatus", "ok", "Opened! Tx: " + txHash);
  } catch(e) {
    showStatus("openStatus", "err", "Error: " + e.message);
  }
};

window.resolve = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    showStatus("resolveStatus", "Resolving with AI...");
    const txHash = await client.writeContract({
      address: ADDR,
      functionName: "resolve",
      args: [document.getElementById("disputeId").value],
    });
    showStatus("resolveStatus", "ok", "Resolved! Tx: " + txHash);
  } catch(e) {
    showStatus("resolveStatus", "err", "Error: " + e.message);
  }
};

window.read = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    const d = await client.readContract({
      address: ADDR,
      functionName: "get_dispute",
      args: [document.getElementById("readId").value],
    });
    document.getElementById("out").textContent = JSON.stringify(d, null, 2);
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
  }
};

function showStatus(id, msg) {
  document.getElementById(id).textContent = msg;
}
