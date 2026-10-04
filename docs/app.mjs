import { createClient } from "genlayer-js";
import { studioDevnet } from 'genlayer-js/chains';

const ADJUDICATOR_ADDRESS = "0x7b6133E6950c88e002169FeA28dED15c9AFA0a03";
const RELAY = "https://genlayer-adjudicator-app.onrender.com";
const EXPLORER = 'https://explorer-studio-dev.genlayer.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// An external message pays a WALLET on FINALIZATION, not on acceptance. A
// caller that samples once after a write sees the balance still in the
// contract, so poll until the verdict commits instead of guessing a duration.
async function leaderResult(tx){
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    for (const host of [EXPLORER, 'https://explorer-studio-next.genlayer.com']) {
      try {
        const txt = await (await fetch(`https://${host}/api/transactions/${tx}`)).text();
        if (!txt.trim().startsWith('{')) continue;
        const clean = txt.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
        const lr = JSON.parse(clean)?.transaction?.consensus_data?.leader_receipt;
        const e = Array.isArray(lr) ? lr[0] : lr;
        if (e?.execution_result) return e.execution_result;
      } catch { /* indexing race */ }
    }
  }
  return null;
}
let client = null;
let account = null;
let feeOpts = null;

async function fees(){
  if(!feeOpts){
    const est = await createClient({ chain: studioDevnet }).estimateTransactionFees({});
    feeOpts = { distribution: est.distribution, feeValue: est.feeValue };
  }
  return feeOpts;
}

// A fee distribution IS required here: this app now targets Studio Devnet,
// which runs the 2.x runtime. Consensus rejects a transaction with no fee
// distribution at admission, with FeeValueMustBeNonZero. Estimating is the only
// reliable way to build one.

async function connectWallet(){
  const b = document.getElementById('addr');
  const note = document.getElementById('netNote');
  try {
    if (!window.ethereum) throw new Error("MetaMask is not installed. Please install the MetaMask browser extension.");
    client = createClient({ chain: studioDevnet });
    // genlayer-js native connect: installs GenLayer snap + sets Studio Devnet
    const snap = await client.connect('studioDevnet');
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
    note.textContent = "Signing with your MetaMask wallet (GenLayer snap) on Studio Devnet.";
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
      fees: await fees(),
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
    const disputeId = document.getElementById('disputeId').value.trim();
    const txHash = await client.writeContract({
      account,
      address: ADJUDICATOR_ADDRESS,
      functionName: "resolve",
      args: [disputeId],
      value: 0n,
      fees: await fees(),
    });
    b.textContent = 'Submitted. Waiting for the AI validators to agree — the payout lands when the transaction FINALIZES. Tx: ' + txHash;
    const verdict = await leaderResult(txHash);
    if (verdict === 'SUCCESS') {
      b.className = 'status ok';
      b.textContent = 'Verdict committed. Payout releases on finalization — check the agent or payer balance in a moment. Tx: ' + txHash;
    } else if (verdict) {
      b.className = 'status err';
      b.textContent = 'Refused by the contract. Tx: ' + txHash;
    } else {
      b.className = 'status';
      b.textContent = 'Still in consensus. Check the explorer shortly. Tx: ' + txHash;
    }
    await readDispute(disputeId);
  }catch(e){ b.className='status err'; b.textContent='Error: '+e.message; }
}

async function readDispute(id){
  const o=document.getElementById('out'); o.textContent='Reading…';
  try{
    const r=await fetch(RELAY+'/dispute/'+id);
    const d=await r.json();
    o.textContent=JSON.stringify(d,null,2);
    return d;
  }catch(e){ o.textContent='Error: '+e; return null; }
}

async function read(){
  const id = document.getElementById('readId').value.trim();
  if(!id){ document.getElementById('out').textContent='Dispute ID required.'; return; }
  await readDispute(id);
}

// expose handlers + client for inline onclick / testing
window.connectWallet = connectWallet;
window.openDispute = openDispute;
window.resolve = resolve;
window.read = read;
window.__getClient = () => client;
window.__getAccount = () => account;
