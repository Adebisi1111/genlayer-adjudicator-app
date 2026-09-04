// docs/wallet.mjs
var API = "http://localhost:3001";
async function openDispute(agent, serviceUrl, claim, value = 0) {
  const res = await fetch(`${API}/open-dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, serviceUrl, claim, value })
  });
  return res.json();
}
async function resolveDispute(disputeId) {
  const res = await fetch(`${API}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId })
  });
  return res.json();
}
async function getDispute(disputeId) {
  const res = await fetch(`${API}/dispute/${disputeId}`);
  return res.json();
}

// docs/app.js
var addrEl = document.getElementById("addr");
var noteEl = document.getElementById("netNote");
var btn = document.getElementById("connectBtn");
var openBtn = document.getElementById("openBtn");
var resolveBtn = document.getElementById("resolveBtn");
var readBtn = document.getElementById("readBtn");
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status show " + type;
}
async function checkBackend() {
  try {
    const res = await fetch("http://localhost:3001/health");
    const data = await res.json();
    if (data.status === "ok") {
      addrEl.textContent = data.account.slice(0, 6) + "..." + data.account.slice(-4);
      noteEl.innerHTML = '<span style="color:#4ade80">\u25CF Backend Connected</span>';
      btn.textContent = "Connected";
      btn.disabled = true;
      return true;
    }
  } catch (e) {
    addrEl.textContent = "Backend not running";
    noteEl.innerHTML = '<span style="color:#f87171">\u25CF Start backend server</span>';
    btn.textContent = "Connect";
    btn.disabled = false;
    return false;
  }
}
btn.addEventListener("click", async () => {
  addrEl.textContent = "Connecting...";
  await checkBackend();
});
openBtn.addEventListener("click", async () => {
  try {
    showStatus("openStatus", "warn", "Opening dispute...");
    const agent = document.getElementById("agent").value;
    const serviceUrl = document.getElementById("service").value;
    const claim = document.getElementById("claim").value;
    const amount = document.getElementById("amount").value || "0";
    const result = await openDispute(agent, serviceUrl, claim, amount);
    if (result.success) {
      showStatus("openStatus", "ok", "Opened! Tx: " + result.txHash);
    } else {
      showStatus("openStatus", "err", "Error: " + result.error);
    }
  } catch (e) {
    showStatus("openStatus", "err", "Error: " + e.message);
    console.error("Open dispute error:", e);
  }
});
resolveBtn.addEventListener("click", async () => {
  try {
    showStatus("resolveStatus", "warn", "Resolving with AI...");
    const disputeId = document.getElementById("disputeId").value;
    const result = await resolveDispute(disputeId);
    if (result.success) {
      showStatus("resolveStatus", "ok", "Resolved! Tx: " + result.txHash);
    } else {
      showStatus("resolveStatus", "err", "Error: " + result.error);
    }
  } catch (e) {
    showStatus("resolveStatus", "err", "Error: " + e.message);
    console.error("Resolve error:", e);
  }
});
readBtn.addEventListener("click", async () => {
  try {
    const disputeId = document.getElementById("readId").value;
    const result = await getDispute(disputeId);
    if (result.success) {
      document.getElementById("out").textContent = JSON.stringify(result.data, null, 2);
    } else {
      document.getElementById("out").textContent = "Error: " + result.error;
    }
  } catch (e) {
    document.getElementById("out").textContent = "Error: " + e.message;
    console.error("Read error:", e);
  }
});
console.log("App initialized");
checkBackend();
