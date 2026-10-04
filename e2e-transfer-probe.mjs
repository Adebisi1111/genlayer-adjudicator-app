// Finds which native-transfer API the Studio Devnet (61997) 2.x runtime
// actually supports. The adjudicator's escrow release uses get_contract_at().emit_transfer
// and that raised `AttributeError: module 'genlayer' has no attribute 'get_contract_at'`
// at settlement time - which is why no dispute has ever paid out.
import fs from 'fs';
import { createClient, createAccount } from 'genlayer-js';
import { studioDevnet } from 'genlayer-js/chains';

const P = process.env.PROBE_ADDRESS;
const FUNDER = '0x61fd0047595A30A067f1F21F3b28C4AE8A8e3Dc3';
const RECIP = '0x4B05Fe891a06f021071Ed4722cF139B8717aFAEa';

function keyOf(p) {
  const s = fs.readFileSync(p, 'utf8').trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if (/^[0-9a-fA-F]{64}$/.test(s)) return '0x' + s;
  throw new Error('bad key ' + p);
}
const acct = createAccount(keyOf('/tmp/.funder_pk'));
const c = createClient({ chain: studioDevnet, account: acct });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const bal = async (a) => Number(await c.getBalance({ address: a })) / 1e18;

const fees = await createClient({ chain: studioDevnet }).estimateTransactionFees({});
const FEE = { distribution: fees.distribution, feeValue: fees.feeValue };

console.log('probe', P);
const r0 = await bal(RECIP);
console.log('recipient before', r0.toFixed(4));

const METHODS = ['gl_contract_at', 'gl_emit_transfer', 'contracts_registry', 'emit_transfer_top', 'has_gl_contract_at'];
for (const m of METHODS) {
  let h;
  try {
    h = await c.writeContract({ account: acct, address: P, functionName: 'probe',
      args: [RECIP, m], value: 1n * 10n ** 15n, fees: FEE });
  } catch (e) {
    console.log(m.padEnd(22), 'SUBMIT-ERR', e.message.slice(0, 70));
    continue;
  }
  // let it settle, then read the recorded log
  let log = null;
  for (let i = 0; i < 24; i++) {
    await sleep(5000);
    try {
      const r = await c.readContract({ address: P, functionName: 'get', args: [m] });
      const d = JSON.parse(typeof r === 'string' ? r : JSON.stringify(r));
      if (d.exists) { log = d.log; break; }
    } catch { /* not committed yet */ }
  }
  const r1 = await bal(RECIP);
  console.log(m.padEnd(22), '->', (log ?? 'NO-RECORD').slice(0, 76),
              '| recipient', r1.toFixed(4), r1 > r0 ? '(MOVED)' : '');
}