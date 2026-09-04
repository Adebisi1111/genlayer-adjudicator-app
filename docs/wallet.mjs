// wallet.mjs - GenLayer SDK with browser wallet (Mochi's approach)
import { createClient } from "genlayer-js";
import { createWalletClient } from "viem";

const CONTRACT_ADDRESS = "0x9d8712ce10a354044d6132b90C088f2677c43963";

// Bradbury testnet config
const bradbury = {
  id: 6674,
  name: "Bradbury Testnet",
  rpcUrls: { default: { http: ["https://rpc-bradbury.genlayer.com"] } },
  nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
};

let gl = null;
let wallet = null;

// Request accounts and initialize SDK
export async function connectWallet() {
  // 1. Ask user to connect wallet
  await window.ethereum.request({ method: "eth_requestAccounts" });

  // 2. Build viem wallet client (signer)
  wallet = createWalletClient({
    chain: bradbury,
    transport: window.ethereum,
  });

  // 3. Create GenLayer SDK client with wallet as provider
  gl = createClient({
    chain: {
      id: 6674,
      rpcUrl: "https://rpc-bradbury.genlayer.com",
      consensus: "0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D",
    },
    provider: wallet,
  });

  const accounts = await wallet.getAddresses();
  return accounts[0];
}

// Ensure wallet is on Bradbury
export async function ensureBradbury() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  const currentId = parseInt(chainId, 16);

  if (currentId !== 6674) {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x1a12" }], // 6674 in hex
      });
    } catch (err) {
      if (err.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: "0x1a12",
            chainName: "Bradbury Testnet",
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

// Open dispute - SDK routes through Consensus Main Contract
export async function openDispute(agent, serviceUrl, claim, value = "0") {
  // Convert decimal GEN to wei
  const valueStr = value.toString();
  const parts = valueStr.split(".");
  const whole = parts[0] || "0";
  let frac = parts[1] || "";
  frac = frac.padEnd(18, "0").slice(0, 18);
  const valueWei = BigInt(whole + frac);

  return gl.writeContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      type: "function",
      name: "open_dispute",
      inputs: [
        { name: "agent", type: "address" },
        { name: "service_url", type: "string" },
        { name: "claim", type: "string" },
      ],
      outputs: [],
      stateMutability: "payable",
    }],
    functionName: "open_dispute",
    args: [agent, serviceUrl, claim],
    value: valueWei,
  });
}

// Resolve dispute
export async function resolveDispute(disputeId) {
  return gl.writeContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      type: "function",
      name: "resolve",
      inputs: [{ name: "dispute_id", type: "string" }],
      outputs: [],
      stateMutability: "nonpayable",
    }],
    functionName: "resolve",
    args: [disputeId],
  });
}

// Get dispute (read)
export async function getDispute(disputeId) {
  return gl.readContract({
    address: CONTRACT_ADDRESS,
    abi: [{
      type: "function",
      name: "get_dispute",
      inputs: [{ name: "dispute_id", type: "string" }],
      outputs: [{ type: "string" }],
      stateMutability: "view",
    }],
    functionName: "get_dispute",
    args: [disputeId],
  });
}
