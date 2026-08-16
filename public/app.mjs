import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { createWalletClient, custom } from "viem";

const ADJUDICATOR_ADDRESS = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
let client = null;
let account = null;

async function connectWallet(){
  const b = document.getElementById('addr');
  const note = document.getElementById('netNote');
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Please install the MetaMask browser extension.");
    const chainIdHex = "0x" + testnetBradbury.id.toString(16);
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: chainIdHex }] });
    } catch (sw) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{ chainId: chainIdHex, chainName: testnetBradbury.name,
          rpcUrls: testnetBradbury.rpcUrls.default.http, nativeCurrency: testnetBradbury.nativeCurrency,
          blockExplorerUrls: [testnetBradbury.blockExplorers?.default.url] }]
      });
    }
    account = createWalletClient({ transport: custom(window.ethereum) });
    const address = await account.address;
    client = createClient({ chain: testnetBradbury });
    client.account = account;
    b.textContent = "Connected: " + address;
    note.textContent = "Signing with your MetaMask wallet on GenLayer Bradbury testnet.";
    document.getElementById('connectBtn').disabled = true;
  } catch(e){
    b.textContent = "Connect failed";
    note.textContent = "Error: " + e.message;
  }
}

function requireWallet(bar){
  if(!client || !account){ bar.className='status err'; bar.textContent='Connect your wallet first.'; return false; }
  return true;
}

async function openDispute(){
  const b=document.getElementById('openStatus'); b.className='status'; b.textContent='Opening — confirm in MetaMask…';
  if(!requireWallet(b)) return;
  try{
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "open_dispute",
      args: [document.getElementById('agent').value,
             document.getElementById('service').value,
             document.getElementById('claim').value],
      value: BigInt(document.getElementById('amount').value || 0),
    });
    b.className='status ok'; b.textContent='Opened. Tx: '+txHash;
  }catch(e){ b.className='status err'; b.textContent='Error: '+e.message; }
}

async function resolve(){
  const b=document.getElementById('resolveStatus'); b.className='status'; b.textContent='Resolving — confirm in MetaMask…';
  if(!requireWallet(b)) return;
  try{
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "resolve",
      args: [document.getElementById('disputeId').value],
      value: 0n,
    });
    b.className='status ok'; b.textContent='Resolved. Tx: '+txHash;
  }catch(e){ b.className='status err'; b.textContent='Error: '+e.message; }
}

async function read(){
  const o=document.getElementById('out'); o.textContent='Reading…';
  try{
    const r=await fetch('/api/dispute/'+document.getElementById('readId').value);
    const d=await r.json();
    o.textContent=JSON.stringify(d,null,2);
  }catch(e){o.textContent='Error: '+e;}
}

// expose handlers for inline onclick usage
window.connectWallet = connectWallet;
window.openDispute = openDispute;
window.resolve = resolve;
window.read = read;
