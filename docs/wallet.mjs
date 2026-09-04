// wallet.mjs - GenLayer SDK with browser wallet
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT_ADDRESS = "0x9d8712ce10a354044d6132b90C088f2677c43963";

let client = null;
let currentAccount = null;

// Get or create client with current account
function getClient() {
  if (!client || !currentAccount) {
    client = createClient({
      chain: testnetBradbury,
      provider: window.ethereum,
      account: currentAccount,
    });
  }
  return client;
}

// Request accounts
export async function connectWallet() {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts found");
  
  currentAccount = accounts[0];
  
  // Create new client with account
  client = createClient({
    chain: testnetBradbury,
    provider: window.ethereum,
    account: currentAccount,
  });
  
  return accounts[0];
}

// Ensure wallet is on Bradbury (chain ID 4221)
export async function ensureBradbury() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  const currentId = parseInt(chainId, 16);
  
  if (currentId !== 4221) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x107d" }],
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x107d",
            chainName: "GenLayer Bradbury Testnet",
            rpcUrls: ["https://rpc-bradbury.genlayer.com"],
            nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
            blockExplorerUrls: ["https://explorer-bradbury.genlayer.com"],
          }],
        });
      } else {
        throw err;
      }
    }
  }
}

// Open dispute - SDK routes through Consensus Main Contract automatically
export async function openDispute(agent, serviceUrl, claim, value = "0") {
  // Convert decimal GEN to wei (1 GEN = 10^18 wei)
  const valueStr = value.toString();
  const parts = valueStr.split(".");
  const whole = parts[0] || "0";
  let frac = parts[1] || "";
  frac = frac.padEnd(18, "0").slice(0, 18);
  const valueWei = BigInt(whole + frac);
  
  return getClient().writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "open_dispute",
    args: [agent, serviceUrl, claim],
    value: valueWei,
  });
}

// Resolve dispute
export async function resolveDispute(disputeId) {
  return getClient().writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve",
    args: [disputeId],
  });
}

// Get dispute (read)
export async function getDispute(disputeId) {
  return getClient().readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_dispute",
    args: [disputeId],
  });
}
