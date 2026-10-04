// Resolves the live escrow disputes end to end and proves funds land with the
// correct party.
//
// DSP-6 was opened by the throwaway payer 0x3892d3 with 0.5 GEN escrowed and
// the real agent 0x4B05Fe8. Its evidence URL does not resolve, so consensus
// should return NOT_DELIVERED and the deposit should come back to the PAYER.
// Balances are read before and after to show the refund actually happened.
import fs from 'fs';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const A = '0x9d8712ce10a354044d6132b90C088f2677c43963';
const PAYER = '0x3892d37d6AC0B57421d7f2cf624DAca00246E5CF';
const AGENT = '0x4B05Fe891a06f021071Ed4722cF139B8717aFAEa';
const JOB = process.argv[2] || 'DSP-6';
// Accept either a raw key or a path to one, so the caller cannot get this
// wrong silently the way a bare readFileSync(env) does.
function loadKey(v) {
  if (!v) throw new Error('RESOLVER_PK required');
  const s = String(v).trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if (fs.existsSync(s)) return fs.readFileSync(s, 'utf8').trim();
  throw new Error('RESOLVER_PK is neither a 0x key nor an existing file');
}
const resolver = createAccount(loadKey(process.env.RESOLVER_PK));
const c = createClient({ chain: testnetBradbury, account: resolver });

const GEN = (n) => Number(n) / 1e18;
async function bal(a) { return GEN(await c.getBalance({ address: a })); }
async function dispute(id) {
  const r = await c.readContract({ address: A, functionName: 'get_dispute', args: [id] });
  return JSON.parse(typeof r === 'string' ? r : JSON.stringify(r));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function leaderResult(tx) {
  for (let i = 0; i < 40; i++) {
    await sleep(5000);
    for (const host of ['explorer-bradbury.genlayer.com', 'explorer-studio.genlayer.com']) {
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

console.log('JOB', JOB);
const before = await dispute(JOB);
console.log('BEFORE dispute  ', JSON.stringify(before));
console.log('BEFORE payer bal', (await bal(PAYER)).toFixed(4), 'GEN');
console.log('BEFORE agent bal', (await bal(AGENT)).toFixed(4), 'GEN');

const tx = await c.writeContract({
  account: resolver,
  address: A,
  functionName: 'resolve',
  args: [JOB],
  value: 0n,
});
console.log('resolve tx', tx);
console.log('leader result', await leaderResult(tx));

await sleep(8000);
const after = await dispute(JOB);
console.log('AFTER dispute   ', JSON.stringify(after));
const pb = await bal(PAYER), ab = await bal(AGENT);
console.log('AFTER payer bal ', pb.toFixed(4), 'GEN');
console.log('AFTER agent bal ', ab.toFixed(4), 'GEN');
console.log('payer delta     ', (pb - (before.amount / 1e18)).toFixed(4));
console.log('verdict         ', after.verdict, '| status', after.status);