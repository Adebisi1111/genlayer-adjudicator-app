import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const ADJUDICATOR_ADDRESS = "0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F";
let client = null;
let account = null;

// ─── Wallet Connection ───────────────────────────────────────────────
async function connectWallet() {
  const addrEl = document.getElementById('addr');
  const noteEl = document.getElementById('netNote');
  const btn = document.getElementById('connectBtn');
  
  try {
    if (!window.ethereum) {
      showStatus('install');
      return;
    }
    
    client = createClient({ chain: testnetBradbury });
    const snap = await client.connect('testnetBradbury');
    
    if (!client.account) {
      const [address] = await window.ethereum.request({ method: "eth_requestAccounts" });
      client.account = { address };
    }
    
    const address = typeof client.account?.address === "string"
      ? client.account.address
      : (await window.ethereum.request({ method: "eth_accounts" }))[0];
    
    account = client.account;
    addrEl.innerHTML = `<span class="address">${shortenAddress(address)}</span>`;
    noteEl.innerHTML = '<span class="badge badge-success">● Connected to Bradbury Testnet</span>';
    btn.textContent = 'Connected';
    btn.disabled = true;
    btn.classList.add('connected');
    
    // Show dispute ID hint
    updateDisputeHint();
    
  } catch(e) {
    addrEl.innerHTML = '<span class="text-danger">Connection failed</span>';
    noteEl.innerHTML = `<span class="text-muted">${e.message}</span>`;
  }
}

function shortenAddress(addr) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function requireWallet(statusEl) {
  if (!client || !account) {
    showToast('Please connect your wallet first', 'warning');
    return false;
  }
  return true;
}

// ─── Open Dispute ────────────────────────────────────────────────────
async function openDispute() {
  const statusEl = document.getElementById('openStatus');
  statusEl.innerHTML = '<div class="loading"></div> Waiting for signature…';
  statusEl.className = 'status active';
  
  if (!requireWallet(statusEl)) return;
  
  try {
    const agent = document.getElementById('agent').value.trim();
    const service = document.getElementById('service').value.trim();
    const claim = document.getElementById('claim').value.trim();
    const amount = document.getElementById('amount').value || '0';
    
    if (!agent || !service || !claim) {
      showStatus('openFill');
      return;
    }
    
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "open_dispute",
      args: [agent, service, claim],
      value: BigInt(amount),
    });
    
    const disputeId = await getNextDisputeId();
    showStatus('openSuccess', { txHash, disputeId });
    updateDisputeHint();
    
  } catch(e) {
    showStatus('openError', { error: e.message });
  }
}

// ─── Resolve Dispute ─────────────────────────────────────────────────
async function resolve() {
  const statusEl = document.getElementById('resolveStatus');
  statusEl.innerHTML = '<div class="loading"></div> Resolving with AI consensus…';
  statusEl.className = 'status active';
  
  if (!requireWallet(statusEl)) return;
  
  try {
    const disputeId = document.getElementById('disputeId').value.trim();
    if (!disputeId) {
      showStatus('resolveFill');
      return;
    }
    
    const txHash = await client.writeContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "resolve",
      args: [disputeId],
      value: 0n,
    });
    
    showStatus('resolveSuccess', { txHash });
    
    // Auto-refresh the dispute view
    setTimeout(() => read(), 2000);
    
  } catch(e) {
    showStatus('resolveError', { error: e.message });
  }
}

// ─── Read Dispute ────────────────────────────────────────────────────
async function read() {
  const outEl = document.getElementById('out');
  outEl.innerHTML = '<div class="loading"></div>';
  
  try {
    const readId = document.getElementById('readId').value.trim();
    if (!readId) {
      outEl.innerHTML = '<span class="text-muted">Enter a dispute ID</span>';
      return;
    }
    
    const dispute = await client.readContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "get_dispute",
      args: [readId],
    });
    
    outEl.innerHTML = formatDispute(dispute);
    
  } catch(e) {
    outEl.innerHTML = `<span class="text-danger">Error: ${e.message}</span>`;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────
function formatDispute(dispute) {
  const statusColors = {
    'open': 'badge-warning',
    'resolved_payer': 'badge-success',
    'resolved_agent': 'badge-info',
  };
  
  const statusLabels = {
    'open': '⏳ Open',
    'resolved_payer': '✅ Refunded to Payer',
    'resolved_agent': '✅ Paid to Agent',
  };
  
  const verdictLabels = {
    'DELIVERED': '✅ Service Delivered',
    'NOT_DELIVERED': '❌ Not Delivered',
    '': '—',
  };
  
  const badge = statusColors[dispute.status] || 'badge-secondary';
  const statusLabel = statusLabels[dispute.status] || dispute.status;
  const verdictLabel = verdictLabels[dispute.verdict] || dispute.verdict;
  
  return `
    <div class="dispute-card">
      <div class="dispute-header">
        <span class="dispute-id">#${dispute.id}</span>
        <span class="badge ${badge}">${statusLabel}</span>
      </div>
      <div class="dispute-grid">
        <div class="dispute-field">
          <span class="field-label">Payer</span>
          <span class="field-value">${shortenAddress(dispute.payer)}</span>
        </div>
        <div class="dispute-field">
          <span class="field-label">Agent</span>
          <span class="field-value">${shortenAddress(dispute.agent)}</span>
        </div>
        <div class="dispute-field">
          <span class="field-label">Amount</span>
          <span class="field-value">${formatGEN(dispute.amount)}</span>
        </div>
        <div class="dispute-field">
          <span class="field-label">Verdict</span>
          <span class="field-value">${verdictLabel}</span>
        </div>
        <div class="dispute-field full-width">
          <span class="field-label">Service URL</span>
          <span class="field-value"><a href="${dispute.service_url}" target="_blank">${dispute.service_url}</a></span>
        </div>
        <div class="dispute-field full-width">
          <span class="field-label">Claim</span>
          <span class="field-value">${dispute.claim}</span>
        </div>
      </div>
    </div>
  `;
}

function formatGEN(wei) {
  const gen = Number(wei) / 1e18;
  return gen === 0 ? '0 GEN' : `${gen.toLocaleString()} GEN`;
}

async function getNextDisputeId() {
  try {
    const count = await client.readContract({
      address: ADJUDICATOR_ADDRESS,
      functionName: "get_disputes_count",
      args: [],
    });
    return `DSP-${count}`;
  } catch {
    return 'DSP-?';
  }
}

function updateDisputeHint() {
  const hint = document.getElementById('disputeHint');
  if (hint) hint.style.display = 'block';
}

// ─── Toast Notifications ─────────────────────────────────────────────
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.className = `toast toast-${type} show`;
  toast.textContent = message;
  setTimeout(() => toast.classList.remove('show'), 4000);
}

// ─── Status Messages ─────────────────────────────────────────────────
function showStatus(type, data = {}) {
  const messages = {
    install: { html: '⚠️ MetaMask not detected. Please install MetaMask.', className: 'status warning' },
    openFill: { html: '⚠️ Please fill in all fields (agent, service, claim).', className: 'status warning' },
    openSuccess: { html: `✅ Dispute opened!<br>ID: <strong>${data.disputeId}</strong><br>Tx: <a href="https://explorer-bradbury.genlayer.com/tx/${data.txHash}" target="_blank">${shortenAddress(data.txHash)}</a>`, className: 'status success' },
    openError: { html: `❌ Error: ${data.error}`, className: 'status error' },
    resolveFill: { html: '⚠️ Please enter a dispute ID.', className: 'status warning' },
    resolveSuccess: { html: `✅ Resolution triggered!<br>Tx: <a href="https://explorer-bradbury.genlayer.com/tx/${data.txHash}" target="_blank">${shortenAddress(data.txHash)}</a>`, className: 'status success' },
    resolveError: { html: `❌ Error: ${data.error}`, className: 'status error' },
  };
  
  const msg = messages[type];
  if (!msg) return;
  
  const el = document.getElementById('openStatus') || document.getElementById('resolveStatus');
  if (el) {
    el.innerHTML = msg.html;
    el.className = msg.className;
  }
}

// ─── Expose to window ────────────────────────────────────────────────
window.connectWallet = connectWallet;
window.openDispute = openDispute;
window.resolve = resolve;
window.read = read;
window.__getClient = () => client;
window.__getAccount = () => account;
