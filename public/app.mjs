import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const ADJUDICATOR_ADDRESS = "0x9d8712ce10a354044d6132b90C088f2677c43963";
const RELAY = "https://genlayer-adjudicator-app.onrender.com";
let client = null;
let account = null;

// No fee distribution here: this app targets Bradbury, which runs genlayer-js
// 1.1.8. That SDK has no fee-distribution concept - `estimateTransactionFees`
// does not exist in it. The FeeValueMustBeNonZero requirement belongs to the
// 2.x runtime on Studio, not to Bradbury. Adding one broke every write with
// "estimateTransactionFees is not a function".

async function connectWallet(){
  const b = document.getElementById('addr');
  const note = document.getElementById('netNote');
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Please install the MetaMask browser extension.");
    client = createClient({ chain: testnetBradbury });
    // genlayer-js native connect: installs GenLayer snap + sets Bradbury network
    const snap = await client.connect('testnetBradbury');
    // connect() sets client.account via the snap; if not, fall back to EIP-1193 address
    if (!client.account) {
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      client.account = { address };
    }
    const address = typeof client.account?.address === "string"
      ? client.account.address
      : (await window.ethereum.request({ method: "eth_accounts" }))[0];
    account = client.account;
    b.textContent = "Connected: " + address;
    note.textContent = "Signing with your MetaMask wallet (GenLayer snap) on Bradbury testnet.";
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

function validAddress(a){ return /^0x[0-9a-fA-F]{40}$/.test(String(a||'').trim()); }

async function openDispute(){
  const b=document.getElementById('openStatus'); b.className='status'; b.textContent='Opening — confirm in MetaMask…';
  if(!requireWallet(b)) return;
  // Refuse a malformed agent address before asking anyone to deposit. Without
  // this the contract stores the text verbatim and the eventual payout targets
  // an address that does not exist - the deposit becomes unrecoverable.
  const agent=document.getElementById('agent').value.trim();
  if(!validAddress(agent)){ b.className='status err'; b.textContent='Valid agent address required.'; return; }
  const service=document.getElementById('service').value.trim();
  if(!/^https?:\/\//.test(service)){ b.className='status err'; b.textContent='Service URL must start with http:// or https://'; return; }
  const claimText=document.getElementById('claim').value.trim();
  if(!claimText){ b.className='status err'; b.textContent='Describe what went wrong.'; return; }
  try{
    const txHash = await client.writeContract({
      // `account` must be passed per call. createClient builds its transaction
      // actions over an INNER client, so assigning `client.account` after
      // connect() never reaches writeContract and every write fails with
      // "No account set" - even from a real MetaMask session.
      account,
      address: ADJUDICATOR_ADDRESS,
      functionName: "open_dispute",
      args: [agent, service, claimText],
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
      account,
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
    // server.js exposes /dispute/:id, not /api/dispute/:id
    const r=await fetch(RELAY+'/dispute/'+document.getElementById('readId').value);
    const d=await r.json();
    o.textContent=JSON.stringify(d,null,2);
  }catch(e){o.textContent='Error: '+e;}
}

// expose handlers + client for inline onclick / testing
window.connectWallet = connectWallet;
window.openDispute = openDispute;
window.resolve = resolve;
window.read = read;
window.__getClient = () => client;
window.__getAccount = () => account;
