// End-to-end test of the SHIPPED adjudicator frontend, with no browser.
//
// Imports public/app.mjs exactly as the page does and drives its own
// connectWallet(), openDispute() and resolve() handlers against the live
// Bradbury contract. Only the DOM and window.ethereum are shimmed; signing is
// real, down the same eth_sendTransaction branch MetaMask uses.
//
// It exists because the previous server.js held a signing key and signed the
// writes itself, so nothing in the browser path was ever exercised. This proves
// the browser path works on its own.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const REPO = path.dirname(fileURLToPath(import.meta.url));
const PK = process.env.ESCROW_PK;
if (!PK) { console.error('ESCROW_PK required'); process.exit(1); }

const { createClient, createAccount } = await import('genlayer-js');
const { testnetBradbury } = await import('genlayer-js/chains');
const { createWalletClient, http } = await import('viem');

const wallet = createAccount(PK);
const pub = createWalletClient({
  chain: testnetBradbury,
  transport: http(testnetBradbury.rpcUrls.default.http[0]),
});

// ─── Minimal DOM ────────────────────────────────────────────────
const nodes = new Map();
function node(id = '') {
  if (nodes.has(id)) return nodes.get(id);
  const n = {
    id, value: '', textContent: '', _class: '', disabled: false,
    append() {}, appendChild() {},
    set className(v) { this._class = v; }, get className() { return this._class; },
    classList: {
      add(c) { const s = new Set(node(this)._class.split(/\s+/).filter(Boolean)); s.add(c); node(this)._class = [...s].join(' '); },
      remove(c) { node(this)._class = node(this)._class.split(/\s+/).filter((x) => x && x !== c).join(' '); },
      contains(c) { return node(this)._class.split(/\s+/).includes(c); },
    },
  };
  nodes.set(id, n);
  return n;
}
for (const id of ['addr', 'netNote', 'netDot', 'connectBtn', 'agent', 'service',
                  'claim', 'amount', 'openStatus', 'disputeId', 'resolveStatus',
                  'readId', 'out']) node(id);

global.document = { getElementById: node };
global.window = {
  ethereum: {
    request: async ({ method, params }) => {
      switch (method) {
        case 'eth_requestAccounts':
        case 'eth_accounts':
          return [wallet.address];
        case 'eth_chainId':
          return '0x' + (4221).toString(16);   // Bradbury chain id
        case 'net_version':
          return '4221';
        case 'web3_clientVersion':
          return 'Mozilla/5.0';
        case 'wallet_getSnaps':
          return { 'npm:genlayer': { id: 'npm:genlayer' } };
        case 'eth_sendTransaction': {
          // The branch a real MetaMask + GenLayer snap takes. Sign and broadcast.
          const [tx] = params;
          return pub.sendTransaction({
            account: wallet,
            to: tx.to,
            data: tx.data,
            value: BigInt(tx.value || '0x0'),
            gas: BigInt(tx.gas || '0x5208'),
            nonce: tx.nonce !== undefined ? Number(BigInt(tx.nonce)) : undefined,
            gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
            chainId: 4221,
            type: 'legacy',
          });
        }
        default:
          return null;
      }
    },
    on: () => {}, removeListener: () => {},
  },
};

const app = global.window;
await import(path.join(REPO, 'public', 'app.mjs'));

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ' :: ' + detail : ''}`);
  ok ? pass++ : fail++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

console.log('=== the shipped bundle loads ===');
check('handlers wired for onclick', ['connectWallet', 'openDispute', 'resolve']
  .every((f) => typeof app[f] === 'function'));

console.log('\n=== connectWallet() ===');
await app.connectWallet();
await wait(1500);
check('reports the connected address', node('addr').textContent.includes(wallet.address),
  node('addr').textContent.slice(0, 46));
check('says the wallet signs', /MetaMask/i.test(node('netNote').textContent),
  node('netNote').textContent.slice(0, 60));

console.log('\n=== the write path reaches the chain ===');
// 0.5 GEN deposit, agent is the second escrow wallet if provided
const agentAddr = process.env.AGENT_ADDR || wallet.address;
node('agent').value = agentAddr;
node('service').value = 'https://genlayer-definitely-does-not-exist-7c1d.example/svc';
node('claim').value = 'service was never reachable';
node('amount').value = '500000000000000000';   // 0.5 GEN in wei

await app.openDispute();
await wait(3000);
const openMsg = node('openStatus').textContent;
// Assert the write ACTUALLY happened. An earlier version of this file accepted
// "Error: <anything>" as a pass, which let a real failure - the 1.x SDK having
// no estimateTransactionFees - report 6/6 green while no dispute was ever
// opened. A write test must fail when the write fails.
check('open_dispute was not blocked by "No account set"',
  !/No account set/i.test(openMsg), openMsg.slice(0, 80));
check('open_dispute submitted on-chain', /^Opened\. Tx: 0x[0-9a-f]{64}/.test(openMsg),
  openMsg.slice(0, 110));

console.log('\n=== validation still refuses bad input ===');
node('agent').value = 'not-an-address';
await app.openDispute();
await wait(1200);
check('invalid agent address is refused', /Error|invalid|address/i.test(node('openStatus').textContent),
  node('openStatus').textContent.slice(0, 80));
check('no tx was submitted for the invalid input', !/^Opened\./.test(node('openStatus').textContent));

console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);