// wallet.mjs - Frontend API calls to backend relay server
const API = "https://genlayer-adjudicator-app.onrender.com";

// Open dispute via backend relay
export async function openDispute(agent, serviceUrl, claim, value = "0") {
  const res = await fetch(`${API}/open-dispute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ agent, serviceUrl, claim, value }),
  });
  return res.json();
}

// Resolve dispute via backend relay
export async function resolveDispute(disputeId) {
  const res = await fetch(`${API}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ disputeId }),
  });
  return res.json();
}

// Get dispute via backend relay
export async function getDispute(disputeId) {
  const res = await fetch(`${API}/dispute/${disputeId}`);
  return res.json();
}
