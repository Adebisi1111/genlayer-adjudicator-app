// wallet.mjs - GenLayer SDK integration
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const provider = window.ethereum;

// Bradbury network config
const BRADBURY = {
  chainId: "0x1a12",
  chainName: "Bradbury Testnet",
  rpcUrls: ["https://rpc-bradbury.genlayer.com"],
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
  blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
};

// Contract config
const CONTRACT_ADDRESS = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
const abi = [
  {
    type: "function",
    name: "open_dispute",
    inputs: [
      { name: "agent", type: "address" },
      { name: "service_url", type: "string" },
      { name: "claim", type: "string" },
    ],
    outputs: [],
    stateMutability: "payable",
  },
  {
    type: "function",
    name: "resolve",
    inputs: [{ name: "dispute_id", type: "string" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "get_dispute",
    inputs: [{ name: "dispute_id", type: "string" }],
    outputs: [{ type: "string" }],
    stateMutability: "view",
  },
];

let client = null;
let account = null;

// Ensure Bradbury network
export async function ensureBradbury() {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: BRADBURY.chainId }],
    });
    console.log("✅ Already on Bradbury");
  } catch (err) {
    if (err.code === 4902) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [BRADBURY],
      });
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BRADBURY.chainId }],
      });
      console.log("✅ Added & switched to Bradbury");
    } else {
      console.error("❌ Switch failed:", err);
      throw err;
    }
  }
}

// Connect wallet
export async function connectWallet() {
  const accounts = await provider.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts found");
  
  account = accounts[0];
  
  // Create GenLayer client with account string (triggers provider usage)
  client = createClient({ chain: testnetBradbury, account });
  
  console.log("✅ Connected as", account);
  return account;
}

// Open dispute
export async function openDispute(agent, serviceUrl, claim) {
  if (!client || !account) throw new Error("Wallet not connected");

  const minDepositWei = BigInt(0.2 * 10 ** 18);

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "open_dispute",
    args: [agent, serviceUrl, claim],
    value: minDepositWei,
  });

  console.log("📡 Tx sent, hash:", txHash);
  return txHash;
}

// Resolve dispute
export async function resolveDispute(disputeId) {
  if (!client || !account) throw new Error("Wallet not connected");

  const txHash = await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve",
    args: [disputeId],
  });

  console.log("📡 Tx sent, hash:", txHash);
  return txHash;
}

// Get dispute
export async function getDispute(disputeId) {
  if (!client || !account) throw new Error("Wallet not connected");

  const result = await client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_dispute",
    args: [disputeId],
  });

  return result;
}

// Listen for account changes
provider.on("accountsChanged", (accounts) => {
  if (accounts.length === 0) {
    console.log("🔌 Wallet disconnected");
    account = null;
    client = null;
  } else {
    account = accounts[0];
    if (client) {
      client.account = account;
    }
  }
});
