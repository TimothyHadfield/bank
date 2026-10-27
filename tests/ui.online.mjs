// Two phones, one online room, against the real free Firebase project (th-board-games):
//   node tests/ui.online.mjs <baseUrl> [outDir]
// Host makes a room (host + friend + one computer, 10 rounds), the friend joins by code, both
// tap the real Roll / Bank buttons until the game ends. Fails on console/page errors or no finish.
import { createRequire } from 'node:module';
import path from 'node:path';
import os from 'node:os';
const require = createRequire(import.meta.url);
const pw = require(path.join(os.homedir(), '.claude/tools/node_modules/playwright'));
const base = process.argv[2] || 'http://127.0.0.1:18500/';
const out = process.argv[3] || '.';
const errors = [];
const browser = await pw.webkit.launch({ headless: true });
async function open(tag) {
  const ctx = await browser.newContext({ ...pw.devices['iPhone 15'] });
  await ctx.addInitScript(() => { try { if (!localStorage.getItem('bank:settings')) localStorage.setItem('bank:settings', JSON.stringify({ mode: 'online', computers: 2, rounds: 10, speed: 'fast' })); } catch (e) {} });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { if (!/firestore\.googleapis\.com.*channel/.test(e.message)) errors.push(tag + ' pageerror: ' + e.message); });
  page.on('console', (m) => { if (m.type() === 'error') errors.push(tag + ' console: ' + m.text()); });
  page.on('requestfailed', (r) => { const u = r.url(); if (!/firestore\.googleapis\.com.*(Listen|Write)\/channel/.test(u)) errors.push(tag + ' failed: ' + u); });
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.BankApp, null, { timeout: 30000 });
  return page;
}
const host = await open('host');
const friend = await open('friend');
const t0 = Date.now();
try {
  for (const p of [host, friend]) { await p.evaluate(() => document.querySelector('[data-mode=online]')?.click()); await p.waitForSelector('#oname'); }
  await host.fill('#oname', 'Tim');
  await host.click('[data-act=create]');
  await host.waitForSelector('.code-big', { timeout: 30000 });
  const code = (await host.textContent('.code-big')).trim();
  console.log('room', code);
  await friend.fill('#oname', 'Sam');
  await friend.fill('#ocode', code.toLowerCase());
  await friend.click('[data-act=join]');
  await friend.waitForSelector('.code-big', { timeout: 30000 });
  await host.waitForFunction(() => document.querySelectorAll('.lobby-seats li').length === 3 && !/Open seat/.test(document.querySelector('.lobby-seats li:nth-child(2)').textContent), null, { timeout: 30000 });
  await host.screenshot({ path: path.join(out, 'online-lobby-host.png') });
  await friend.screenshot({ path: path.join(out, 'online-lobby-friend.png') });
  await host.click('[data-act=ostart]');
  const driver = () => {
    window.__drv = { rolls: 0, banks: 0, over: false };
    setInterval(() => {
      const A = window.BankApp, G = A.G; if (!G || G.mode !== 'online') return;
      if (G.s.over) { window.__drv.over = true; return; }
      if (A.busy) return;
      const me = G.here[0];
      const bank = document.querySelector(`[data-act=bank][data-seat="${me}"]:not(:disabled)`);
      if (bank && Math.random() < 0.12) { window.__drv.banks++; bank.click(); return; }
      const roll = document.querySelector('[data-act=roll]:not(:disabled)');
      if (roll && G.s.roller === me) { window.__drv.rolls++; roll.click(); }
    }, 500);
  };
  await host.evaluate(driver); await friend.evaluate(driver);
  let shot = false;
  while (Date.now() - t0 < 20 * 60000) {
    await host.waitForTimeout(3000);
    const [h, f] = [await host.evaluate(() => window.__drv), await friend.evaluate(() => window.__drv)];
    if (!shot && h.rolls + f.rolls > 10) { shot = true; await host.screenshot({ path: path.join(out, 'online-game-host.png') }); await friend.screenshot({ path: path.join(out, 'online-game-friend.png') }); }
    if (h.over && f.over) break;
  }
  const [h, f] = [await host.evaluate(() => window.__drv), await friend.evaluate(() => window.__drv)];
  if (!(h.over && f.over)) errors.push('game did not finish on both phones');
  const same = await host.evaluate(() => JSON.stringify(window.BankApp.G.s.scores)) === await friend.evaluate(() => JSON.stringify(window.BankApp.G.s.scores));
  if (!same) errors.push('final scores differ between the phones');
  await host.waitForTimeout(2000);
  await host.screenshot({ path: path.join(out, 'online-over-host.png') });
  await friend.screenshot({ path: path.join(out, 'online-over-friend.png') });
  console.log(JSON.stringify({ code, host: h, friend: f, minutes: +((Date.now() - t0) / 60000).toFixed(1) }));
} catch (e) { errors.push('run: ' + String(e).slice(0, 300)); }
await browser.close();
console.log(JSON.stringify({ errors }, null, 1));
if (errors.length) process.exit(1);
