import { createWalletClient, custom, http } from "viem";
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
    if (!window.ethereum) { addrEl.textContent = "Wallet not detected"; return; }
    
    // Create client using viem directly (bypasses genlayer-js snap check)
    client = createWalletClient({
      chain: testnetBradbury,
      transport: custom(window.ethereum),
    });
    
    const accounts = await client.getAddresses();
    if (!accounts?.length) throw new Error("No accounts found");
    
    account = { address: accounts[0] };
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
      abi: [{"type":"function","name":"open_dispute","inputs":[{"name":"agent","type":"address"},{"name":"service_url","type":"string"},{"name":"claim","type":"string"}],"outputs":[],"stateMutability":"payable"}],
      functionName: "open_dispute",
      args: [document.getElementById("agent").value, document.getElementById("service").value, document.getElementById("claim").value],
      value: BigInt(document.getElementById("amount").value || 0),
      account: account.address,
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
      address: ADDR,
      abi: [{"type":"function","name":"resolve","inputs":[{"name":"dispute_id","type":"string"}],"outputs":[],"stateMutability":"nonpayable"}],
      functionName: "resolve",
      args: [document.getElementById("disputeId").value],
      value: 0n,
      account: account.address,
    });
    document.getElementById("resolveStatus").innerHTML = '<span style="color:#4ade80">Resolved! Tx: ' + tx + '</span>';
  } catch(e) {
    document.getElementById("resolveStatus").innerHTML = '<span style="color:#f87171">Error: ' + e.message + '</span>';
  }
};

window.read = async function() {
  if (!client) return alert("Connect wallet first");
  try {
    // Use raw RPC call for reading
    const response = await fetch(testnetBradbury.rpcUrls.default.http[0], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "gen_getClaim",
        params: [{ claimId: document.getElementById("readId").value }],
      }),
    });
    const data = await response.json();
    document.getElementById("out").textContent = JSON.stringify(data.result, null, 2);
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
  }
};
