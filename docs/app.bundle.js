// docs/wallet.mjs
var API = "https://genlayer-adjudicator-app.onrender.com";
async function openDispute(agent, serviceUrl, claim, value = "0") {
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
var openBtn = document.getElementById("openBtn");
var resolveBtn = document.getElementById("resolveBtn");
var readBtn = document.getElementById("readBtn");
function showStatus(id, type, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.className = "status show " + type;
}
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
