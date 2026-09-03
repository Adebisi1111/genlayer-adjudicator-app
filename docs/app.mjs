import { createWalletClient, custom } from "viem";

const ADDR = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
const RPC = "https://rpc-bradbury.genlayer.com";
const CHAIN = {
  id: 6675,
  name: "GenLayer Bradbury Testnet",
  rpcUrls: { default: { http: [RPC] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  blockExplorers: { default: { name: "GenLayer Explorer", url: "https://explorer-bradbury.genlayer.com" } },
};

// ─── Stable client/signer (never recreated) ─────────────────────────
let client = null;
let account = null;
let isConnected = false;

// ─── DOM references ─────────────────────────────────────────────────
const addrEl = document.getElementById("addr");
const noteEl = document.getElementById("netNote");
const btn = document.getElementById("connectBtn");

// ─── Single click handler (checks state) ────────────────────────────
btn.addEventListener("click", async () => {
  if (isConnected) {
    disconnectWallet();
  } else {
    await connectWallet();
  }
});

// ─── Connect (only when not connected) ──────────────────────────────
async function connectWallet() {
  // Already connected? Reuse existing signer
  if (isConnected && client && account) {
    console.log("✅ Already connected as", account.address);
    return;
  }

  addrEl.textContent = "Connecting...";
  try {
    if (!window.ethereum) {
      addrEl.textContent = "Wallet not detected";
      return;
    }

    // Create client once (stable instance)
    if (!client) {
      client = createWalletClient({
        chain: CHAIN,
        transport: custom(window.ethereum),
      });
    }

    // Request accounts (only when needed)
    const accounts = await client.getAddresses();
    if (!accounts?.length) throw new Error("No accounts found");

    account = { address: accounts[0] };
    isConnected = true;

    // Update UI
    addrEl.textContent = accounts[0].slice(0,6) + "..." + accounts[0].slice(-4);
    noteEl.innerHTML = '<span style="color:#4ade80">● Connected</span>';
    btn.textContent = "Disconnect";

    console.log("✅ Connected as", accounts[0]);

    // ─── Listen for account changes ────────────────────────────────
    window.ethereum.on("accountsChanged", handleAccountsChanged);

  } catch(e) {
    addrEl.textContent = "Failed: " + e.message;
    noteEl.textContent = "";
    console.error("❌ Connection error:", e);
  }
}

// ─── Handle account changes (disconnect or switch) ─────────────────
function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    // User disconnected
    console.log("🔌 Wallet disconnected");
    disconnectWallet();
  } else {
    // User switched accounts – update signer
    account = { address: accounts[0] };
    addrEl.textContent = accounts[0].slice(0,6) + "..." + accounts[0].slice(-4);
    console.log("🔄 Switched to", accounts[0]);
  }
}

// ─── Disconnect ─────────────────────────────────────────────────────
function disconnectWallet() {
  client = null;
  account = null;
  isConnected = false;

  // Remove event listener
  if (window.ethereum) {
    window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
  }

  // Update UI
  addrEl.textContent = "Not connected";
  noteEl.textContent = "";
  btn.textContent = "Connect Wallet";

  console.log("🔌 Disconnected");
}

// ─── Open Dispute ───────────────────────────────────────────────────
window.openDispute = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    showStatus("openStatus", "Opening dispute...");
    const tx = await client.writeContract({
      address: ADDR,
      abi: [{
        type: "function", name: "open_dispute",
        inputs: [{ name: "agent", type: "address" }, { name: "service_url", type: "string" }, { name: "claim", type: "string" }],
        outputs: [], stateMutability: "payable"
      }],
      functionName: "open_dispute",
      args: [document.getElementById("agent").value, document.getElementById("service").value, document.getElementById("claim").value],
      value: BigInt(document.getElementById("amount").value || 0),
      account: account.address,
    });
    showStatus("openStatus", "Opened! Tx: " + tx);
  } catch(e) {
    showStatus("openStatus", "Error: " + e.message);
  }
};

// ─── Resolve Dispute ────────────────────────────────────────────────
window.resolve = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    showStatus("resolveStatus", "Resolving with AI...");
    const tx = await client.writeContract({
      address: ADDR,
      abi: [{ type: "function", name: "resolve", inputs: [{ name: "dispute_id", type: "string" }], outputs: [], stateMutability: "nonpayable" }],
      functionName: "resolve",
      args: [document.getElementById("disputeId").value],
      value: 0n,
      account: account.address,
    });
    showStatus("resolveStatus", "Resolved! Tx: " + tx);
  } catch(e) {
    showStatus("resolveStatus", "Error: " + e.message);
  }
};

// ─── Read Dispute ───────────────────────────────────────────────────
window.read = async function() {
  if (!client || !account) return alert("Connect wallet first");
  try {
    const d = await client.readContract({
      address: ADDR,
      abi: [{ type: "function", name: "get_dispute", inputs: [{ name: "dispute_id", type: "string" }], outputs: [{ name: "id", type: "string" }, { name: "payer", type: "address" }, { name: "agent", type: "address" }, { name: "amount", type: "uint256" }, { name: "service_url", type: "string" }, { name: "claim", type: "string" }, { name: "status", type: "string" }, { name: "verdict", type: "string" }], stateMutability: "view" }],
      functionName: "get_dispute",
      args: [document.getElementById("readId").value],
    });
    document.getElementById("out").textContent = JSON.stringify(d, null, 2);
  } catch(e) {
    document.getElementById("out").textContent = "Error: " + e.message;
  }
};

// ─── Helper ─────────────────────────────────────────────────────────
function showStatus(id, msg) {
  document.getElementById(id).textContent = msg;
}
