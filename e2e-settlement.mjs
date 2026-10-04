// Proves escrow settlement end to end on Studio Devnet (61997).
//
// Two disputes, same payer, same agent, differing only in whether GenVM can
// reach the evidence:
//   * reachable URL   -> verdict DELIVERED     -> payout lands with the AGENT
//   * unreachable URL -> verdict NOT_DELIVERED -> refund lands with the PAYER
//
// Balances are read before and after each settlement. The point is to show
// native GEN actually moving to the correct party, not merely a status string.
import fs from 'fs';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const A = process.env.ADJ_ADDRESS;
const PAYER = process.env.PAYER_ADDR || payer.address;
const AGENT = process.env.AGENT_ADDR || agent.address;
const DEPOSIT = 1n * 10n ** 18n; // 1 GEN

if (!A) { console.error('ADJ_ADDRESS required'); process.exit(1); }

// Keys come from the environment, never from a checked-in path. The escrow
// wallets used for the recorded run were shredded afterwards, so a re-run needs
// fresh throwaway keys exported as PAYER_PK and AGENT_PK.
function keyOf(v) {
  const s = String(v || '').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return '0x' + s;
  throw new Error('malformed key: set PAYER_PK and AGENT_PK');
}
const payer = createAccount(keyOf(process.env.PAYER_PK));
const agent = createAccount(keyOf(process.env.AGENT_PK));
const client = createClient({ chain: studioDevnet, account: payer });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const fees = await createClient({ chain: studioDevnet }).estimateTransactionFees({});
const FEE = { distribution: fees.distribution, feeValue: fees.feeValue };
console.log('contract', A);
console.log('feeValue', String(FEE.feeValue));

const bal = async (a) => Number(await client.getBalance({ address: a })) / 1e18;

async function leaderResult(hash) {
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    for (const host of ['explorer-studio-dev.genlayer.com', 'explorer-studio-next.genlayer.com']) {
      try {
        const txt = await (await fetch(`https://${host}/api/transactions/${hash}`)).text();
        if (!txt.trim().startsWith('{')) continue;
        // The explorer emits raw control characters inside string values, which
        // is not valid JSON; strip them or the receipt is silently lost.
        const clean = txt.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, ' ');
        const lr = JSON.parse(clean)?.transaction?.consensus_data?.leader_receipt;
        const e = Array.isArray(lr) ? lr[0] : lr;
        if (e?.execution_result) return { result: e.execution_result, stderr: String(e?.genvm_result?.stderr || '') };
      } catch { /* indexing race */ }
    }
  }
  return { result: null, stderr: '' };
}

async function dispute(id) {
  const r = await client.readContract({ address: A, functionName: 'get_dispute', args: [id] });
  return JSON.parse(typeof r === 'string' ? r : JSON.stringify(r));
}

async function nextDisputeFor(url) {
  for (let i = 0; i < 40; i++) {
    for (let n = 0; n < 24; n++) {
      try {
        const d = await dispute('DSP-' + n);
        if (d.service_url === url && d.status === 'open') return 'DSP-' + n;
      } catch { /* not created yet */ }
    }
    await sleep(5000);
  }
  return null;
}

async function run(label, url, claim) {
  console.log('\n========== ' + label + ' ==========');
  const pb0 = await bal(PAYER), ab0 = await bal(AGENT);
  console.log('before  payer', pb0.toFixed(4), '| agent', ab0.toFixed(4));

  const openHash = await client.writeContract({
    account: payer, address: A, functionName: 'open_dispute',
    args: [AGENT, url, claim], value: DEPOSIT, fees: FEE,
  });
  console.log('open tx', openHash);
  const openRes = await leaderResult(openHash);
  console.log('open leader', openRes.result);

  const id = await nextDisputeFor(url);
  if (!id) { console.log('DISPUTE DID NOT APPEAR'); return false; }
  const d0 = await dispute(id);
  console.log('job', id, 'payer', d0.payer.slice(0, 10), 'agent', d0.agent.slice(0, 10), 'amount', d0.amount);

  const pb1 = await bal(PAYER);
  console.log('escrowed: payer dropped by', (pb0 - pb1).toFixed(4), 'GEN');

  const resHash = await client.writeContract({
    account: agent, address: A, functionName: 'resolve', args: [id], value: 0n, fees: FEE,
  });
  console.log('resolve tx', resHash);
  const res = await leaderResult(resHash);
  console.log('resolve leader', res.result);
  if (res.stderr) console.log('stderr:', res.stderr.slice(-300).replace(/\n/g, ' | '));

  // An external message pays on FINALIZATION, not on acceptance. The write can
  // sit ACCEPTED for a long while with the balance still in the contract, so
  // poll both balances rather than sampling once and declaring failure.
  let d1 = await dispute(id);
  let pb2 = await bal(PAYER), ab2 = await bal(AGENT);
  for (let i = 0; i < 60 && d1.status === 'open'; i++) {
    await sleep(10000);
    d1 = await dispute(id);
    pb2 = await bal(PAYER); ab2 = await bal(AGENT);
  }
  console.log('after   status', d1.status, '| verdict', d1.verdict);
  console.log('after   payer', pb2.toFixed(4), '| agent', ab2.toFixed(4));
  // Balances only, no derived delta: the acting wallet also pays gas, so a
  // signed delta here reads as "gained -1.0000 GEN" for a payout that in fact
  // delivered a full 1 GEN.
  console.log('BALANCES payer', pb2.toFixed(4), '| agent', ab2.toFixed(4),
              '| escrowed', (Number(d1.amount) / 1e18).toFixed(4));

  if (d1.status === 'open') { console.log('RESULT  UNSETTLED'); return false; }
  const winner = d1.status === 'resolved_agent' ? 'AGENT' : 'PAYER';
  console.log('RESULT  SETTLED ->', winner, '| escrow', (Number(d1.amount) / 1e18).toFixed(4),
              'GEN released to', winner === 'AGENT' ? 'the agent' : 'the payer');
  return true;
}

const stamp = Date.now();
const ok1 = await run('REACHABLE evidence', 'https://en.wikipedia.org/wiki/Autonomous_agent?e2e=' + stamp,
  'the cited service page is live and supports the claim');
const ok2 = await run('UNREACHABLE evidence', 'https://does-not-exist-9f3a2b.example/svc-' + stamp,
  'the service is unreachable and was never delivered');

console.log('\n=== SUMMARY: reachable settled', ok1, '| unreachable settled', ok2, '===');
process.exit(ok1 && ok2 ? 0 : 2);