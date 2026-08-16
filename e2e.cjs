const { chromium } = require('playwright');

const BRADBURY_RPC = 'https://rpc-bradbury.genlayer.com';
const BRADBURY_CHAIN_ID_HEX = '0x1085'; // 4221

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Inject a mock EIP-1193 provider BEFORE any script runs
  // Inject a mock EIP-1193 provider BEFORE any script runs
  await page.addInitScript(async (cfg) => {
    // load viem signer from local bundled file (test-only)
    const { privateKeyToAccount } = await import('/signer.bundle.js');
    const acct = privateKeyToAccount(cfg.pk);
    let chainId = cfg.chainIdHex;
    const provider = {
      isMetaMask: true,
      request: async ({ method, params }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts') return [acct.address];
        if (method === 'eth_chainId') return chainId;
        if (method === 'wallet_switchEthereumChain') { chainId = params[0].chainId; return null; }
        if (method === 'wallet_addEthereumChain') { chainId = params[0].chainId; return null; }
        if (method === 'personal_sign') {
          return await acct.signMessage({ message: { raw: params[0] } });
        }
        if (method === 'eth_sendTransaction') {
          const r = await fetch(cfg.rpc, { method:'POST', headers:{'content-type':'application/json'},
            body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_sendTransaction', params:[params[0]] }) });
          const j = await r.json();
          if (j.error) throw new Error(j.error.message);
          return j.result;
        }
        if (method === 'eth_getTransactionCount') {
          const r = await fetch(cfg.rpc, { method:'POST', headers:{'content-type':'application/json'},
            body: JSON.stringify({ jsonrpc:'2.0', id:1, method:'eth_getTransactionCount', params:[acct.address,'latest'] }) });
          return (await r.json()).result;
        }
        if (method === 'eth_estimateGas') return '0x5208';
        if (method === 'eth_gasPrice') return '0x3b9aca00';
        if (method === 'eth_blockNumber') { const r=await fetch(cfg.rpc,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_blockNumber'})}); return (await r.json()).result; }
        if (method === 'wallet_getSnaps') return { 'npm:genlayer-wallet-plugin': { id:'npm:genlayer-wallet-plugin', version:'1.0.0' } };
        if (method === 'wallet_requestSnaps') return { 'npm:genlayer-wallet-plugin': { id:'npm:genlayer-wallet-plugin', version:'1.0.0' } };
        const r = await fetch(cfg.rpc, { method:'POST', headers:{'content-type':'application/json'},
          body: JSON.stringify({ jsonrpc:'2.0', id:1, method, params: params||[] }) });
        return (await r.json()).result;
      },
      on: () => {}, removeListener: () => {},
    };
    window.ethereum = provider;
  }, {
    pk: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d',
    chainIdHex: BRADBURY_CHAIN_ID_HEX,
    rpc: BRADBURY_RPC,
  });

  const errors = [];
  page.on('console', m => { if (m.type()==='error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto('http://localhost:3001/', { waitUntil:'networkidle' });
  await page.waitForTimeout(800);

  // Click Connect
  await page.click('#connectBtn');
  await page.waitForTimeout(1000);
  const afterConnect = await page.evaluate(() => document.getElementById('netNote').textContent + ' | ' + document.getElementById('addr').textContent);
  console.log('AFTER CONNECT:', afterConnect);

  // Fill dispute form and submit a real open_dispute write against Bradbury
  await page.fill('#agent', '0x1111111111111111111111111111111111111111');
  await page.fill('#service', 'payment');
  await page.fill('#claim', 'did not deliver');
  await page.fill('#amount', '0');
  const txResult = await page.evaluate(async () => {
    const client = window.__getClient();
    if (!client) return 'NO CLIENT after connect';
    try {
      const txHash = await client.writeContract({
        address: '0xa80BD90cDa1BDFF2f7442cAA6415686b2935965F',
        functionName: 'open_dispute',
        args: ['0x1111111111111111111111111111111111111111', 'payment', 'did not deliver'],
        value: 0n,
      });
      return 'TX HASH: ' + txHash;
    } catch(e){ return 'WRITE ERR: ' + e.message; }
  });
  console.log('WRITE RESULT:', txResult);

  console.log('CONSOLE ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
