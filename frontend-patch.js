// frontend-patch.js - Drop-in replacement for direct SDK writes
// Replace your current wallet.mjs with this when using a backend relay

const API = "https://your-backend-url.onrender.com"; // Change to your backend URL

// Open dispute via backend
export async function openDispute(agent, serviceUrl, claim, value = "0") {
  const res = await fetch(`${API}/open-dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, serviceUrl, claim, value }),
  });
  return res.json();
}

// Resolve dispute via backend
export async function resolveDispute(disputeId) {
  const res = await fetch(`${API}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId }),
  });
  return res.json();
}

// Get dispute via backend
export async function getDispute(disputeId) {
  const res = await fetch(`${API}/dispute/${disputeId}`);
  return res.json();
}
