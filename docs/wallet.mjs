// wallet.mjs - GenLayer SDK with browser wallet
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const CONTRACT_ADDRESS = "0x9d8712ce10a354044d6132b90C088f2677c43963";

// Consensus Main Contract address (where all writes must go)
const CONSENSUS_ADDRESS = "0x0112Bf6e83497965A5fdD6Dad1E447a6E004271D";

// Create client with window.ethereum provider
export const client = createClient({
  chain: testnetBradbury,
  provider: window.ethereum,
});

// Request accounts
export async function connectWallet() {
  const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts found");
  
  // Set account as string address (triggers provider-based signing)
  client.account = accounts[0];
  
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
export async function openDispute(agent, serviceUrl, claim, value = 100n) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "open_dispute",
    args: [agent, serviceUrl, claim],
    value: BigInt(value),
  });
}

// Resolve dispute
export async function resolveDispute(disputeId) {
  return client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName: "resolve",
    args: [disputeId],
  });
}

// Get dispute (read)
export async function getDispute(disputeId) {
  return client.readContract({
    address: CONTRACT_ADDRESS,
    functionName: "get_dispute",
    args: [disputeId],
  });
}
