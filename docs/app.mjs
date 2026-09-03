import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const ADDR = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
let client = null;
let account = null;

window.connectWallet = async function() {
  const addrEl = document.getElementById("addr");
  const noteEl = document.getElementById("netNote");
  const btn = document.getElementById("connectBtn");
  addrEl.textContent = "Connecting...";
  try {
    if (!window.ethereum) { addrEl.textContent = "MetaMask not detected"; return; }
    client = createClient({ chain: testnetBradbury, provider: window.ethereum });
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accounts?.length) throw new Error("No accounts found");
    account = { address: accounts[0] };
    client.account = account;
    addrEl.textContent = accounts[0].slice(0,6) + "..." + accounts[0].slice(-4);
    noteEl.innerHTML = '<span style="color:#4ade80">● Connected</span>';
    btn.textContent = "Connected";
    btn.disabled = true;
  } catch(e) {
    addrEl.textContent = "Failed: " + e.message;
    noteEl.textContent = "";
  }
};

window.openDispute = async function() {
  if (!client) return alert("Connect wallet first");
  try {
    const tx = await client.writeContract({
      address: ADDR,
      functionName: "open_dispute",
      args: [document.getElementById("agent").value, document.getElementById("service").value, document.getElementById("claim").value],
      value: BigInt(document.getElementById("amount").value || 0),
    });
    document.getElementById("openStatus").innerHTML = '<span style="color:#4ade80">Opened! Tx: ' + tx + '</span>';
  } catch(e) {
    document.getElementById("openStatus").innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
  }
};

window.resolve = async function() {
  if (!client) return alert("Connect wallet first");
  try {
    const tx = await client.writeContract({
      address: ADDR, functionName: "resolve",
      args: [document.getElementById("disputeId").value], value: 0n,
    });
    document.getElementById("resolveStatus").innerHTML = '<span style="color:#4ade80">Resolved! Tx: ' + tx + '</span>';
  } catch(e) {
    document.getElementById("resolveStatus").innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
  }
};

window.read = async function() {
  if (!client) return alert("Connect wallet first");
  try {
    const d = await client.readContract({
      address: ADDR, functionName: "get_dispute",
      args: [document.getElementById("readId").value],
    });
    document.getElementById("out").textContent = JSON.stringify(d, null, 2);
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
  }
};
