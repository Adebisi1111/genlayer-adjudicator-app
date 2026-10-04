// Proves whether the unsettleable resolve is caused by an unreachable evidence
// URL. _adjudicate calls gl.nondet.web.render with no try/except, so a fetch
// failure raises inside the leader task and consensus never concludes - which
// is exactly what the unresolvable-host disputes did.
import fs from 'fs';
import { createClient, createAccount } from 'genlayer-js';
import { testnetBradbury } from 'genlayer-js/chains';

const A = '0x9d8712ce10a354044d6132b90C088f2677c43963';
const PAYER = '0x3892d37d6AC0B57421d7f2cf624DAca00246E5CF';
const AGENT = '0x4B05Fe891a06f021071Ed4722cF139B8717aFAEa';
function loadKey(v){ const s=String(v).trim();
  if(/^0x[0-9a-fA-F]{64}$/.test(s)) return s;
  if(fs.existsSync(s)) return fs.readFileSync(s,'utf8').trim(); throw new Error('bad key'); }
const acct = createAccount(loadKey(process.env.PAYER_PK));
const c = createClient({ chain: testnetBradbury, account: acct });
const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
const bal = async (a)=>Number(await c.getBalance({address:a}))/1e18;

async function dispute(id){
  const r = await c.readContract({address:A, functionName:'get_dispute', args:[id]});
  return JSON.parse(typeof r==='string'?r:JSON.stringify(r));
}
async function leaderResult(tx){
  for(let i=0;i<48;i++){
    await sleep(5000);
    for(const host of ['explorer-bradbury.genlayer.com','explorer-studio.genlayer.com']){
      try{
        const txt = await (await fetch(`https://${host}/api/transactions/${tx}`)).text();
        if(!txt.trim().startsWith('{')) continue;
        const clean = txt.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,' ');
        const lr = JSON.parse(clean)?.transaction?.consensus_data?.leader_receipt;
        const e = Array.isArray(lr)?lr[0]:lr;
        if(e?.execution_result) return e.execution_result;
      }catch{}
    }
  }
  return null;
}

// Wikipedia is reachable from GenVM per the genlayer-web-fetch-guide skill.
// example.com also works. Use a reachable host and a fresh path so the evidence
// is actually fetchable.
const url = 'https://en.wikipedia.org/wiki/Autonomous_agent?run=' + Date.now();

console.log('PAYER bal', (await bal(PAYER)).toFixed(4), '| AGENT bal', (await bal(AGENT)).toFixed(4));

const openTx = await c.writeContract({ account: acct, address: A, functionName: 'open_dispute',
  args: [AGENT, url, 'the service page is unreachable'], value: 100000000000000000n });
console.log('open envelope', openTx);

let newId = null;
for(let i=0;i<30;i++){
  await sleep(5000);
  for(let n=0;n<20;n++){
    const id='DSP-'+n;
    try{
      const d = await dispute(id);
      if(d.payer.toLowerCase()===PAYER.toLowerCase() && d.service_url===url){ newId=id; break; }
    }catch{}
  }
  if(newId) break;
}
if(!newId){ console.error('DISPUTE_NEVER_APPEARED'); process.exit(3); }
console.log('job', newId, JSON.stringify(await dispute(newId)));

const resTx = await c.writeContract({ account: acct, address: A, functionName:'resolve', args:[newId], value:0n });
console.log('resolve envelope', resTx);
const res = await leaderResult(resTx);
console.log('leader result', res);
await sleep(8000);
const after = await dispute(newId);
console.log('AFTER', JSON.stringify(after));
console.log('payer', (await bal(PAYER)).toFixed(4), 'agent', (await bal(AGENT)).toFixed(4));
if(after.status==='open'){ console.error('STILL_OPEN'); process.exit(2); }
console.log('SETTLED', after.status, after.verdict);
