const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  await page.goto('http://localhost:3001/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  // try clicking connect (will fail gracefully without metamask)
  const note = await page.evaluate(() => {
    const btn = document.getElementById('connectBtn');
    if (btn) btn.click();
    return new Promise(r => setTimeout(() => {
      r(document.getElementById('netNote') ? document.getElementById('netNote').textContent : 'no netNote');
    }, 800));
  });
  console.log('NETNOTE:', note);
  console.log('CONSOLE ERRORS:', errors.length ? errors.join('\n') : 'none');
  await browser.close();
})();
