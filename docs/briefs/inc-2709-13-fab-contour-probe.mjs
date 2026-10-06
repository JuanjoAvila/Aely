// A/B del contorno del FAB al ocultar la barra (INC-2709-13). Fixtures inventados, Chromium de escritorio.
// Separa contorno de timing: la transición de la barra se PAUSA en t=1 ms del primer frame con
// `botnav-hidden` y se mide cuánta superficie del círculo sigue pintada (píxeles del FAB frente a su
// estado visible). Sin pausa no hay medida: el screenshot no es fluidez (ver acta).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { resolvePublicFile, exactOrigin } from './inc-2709-13-fab-motion-probe.mjs';

// PNG RGBA 8-bit sin entrelazar → píxeles; suficiente para un recorte de screenshot de Chromium.
export function decodePng(buf) {
  let pos = 8, w = 0, h = 0; const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos), type = buf.toString('ascii', pos + 4, pos + 8), data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat)), bpp = 4, stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, b = y ? out[(y - 1) * stride + x] : 0, c = x >= bpp && y ? out[(y - 1) * stride + x - bpp] : 0;
      let v = raw[y * (stride + 1) + 1 + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, px: out };
}
// Píxel de FAB: lo que se aleja del color de fondo del recorte (esquina). Umbral alto: la sombra
// del FAB es tenue y no debe contar como círculo.
export function fabPixels(png) {
  const bg = [png.px[0], png.px[1], png.px[2]];
  let n = 0;
  for (let i = 0; i < png.px.length; i += 4) { const d = Math.abs(png.px[i] - bg[0]) + Math.abs(png.px[i + 1] - bg[1]) + Math.abs(png.px[i + 2] - bg[2]); if (d > 150) n++; }
  return n;
}
export function verdict(rows, minRatio) {
  const issues = [];
  for (const r of rows) {
    if (!(r.full > 1800 && r.full < 3000)) issues.push(r.name + ': el círculo visible no mide ~π·29² (±) (' + r.full + ')');
    if (!r.hiddenAtStart) issues.push(r.name + ': no se capturó el primer frame oculto');
    if (r.visibleRatioControl < 0.99) issues.push(r.name + ': el control sin ocultar ya pierde superficie');
    if (r.visibleRatioFirstHiddenFrame < minRatio) issues.push(r.name + ': primer frame oculto conserva ' + r.visibleRatioFirstHiddenFrame.toFixed(3) + ' < ' + minRatio);
  }
  return issues;
}
async function main() {
  const { chromium } = await import('@playwright/test');
  const { seedLoggedInDashboard, dismissNews } = await import('../../e2e/fixtures.mjs');
  const minRatio = Number(process.env.FAB_MIN_RATIO || 0.98);
  const root = path.join(process.cwd(), 'public');
  const server = http.createServer((req, res) => {
    const t = resolvePublicFile(root, req.url);
    if (t.status !== 200) { res.writeHead(t.status).end(); return; }
    const type = { '.html': 'text/html', '.js': 'application/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png' }[path.extname(t.file)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type }); res.end(fs.readFileSync(t.file));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}), headless: true });
  const rows = [];
  try {
    for (const c of [{ name: 'green-safe0', theme: 'green', safe: 0, width: 393 }, { name: 'cyber-safe34', theme: 'cyber', safe: 34, width: 360 }]) {
      const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: c.width, height: 812 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, timezoneId: 'UTC' });
      const page = await context.newPage();
      await page.route('**/*', route => exactOrigin(route.request().url(), url) ? route.continue() : route.abort());
      await seedLoggedInDashboard(page, { settings: { autoPrices: false, theme: c.theme } });
      await page.goto(url); await page.waitForFunction(() => document.querySelector('.botnav') && !document.getElementById('mc-load')); await dismissNews(page);
      await page.addStyleTag({ content: ':root{--safe-bottom:' + c.safe + 'px!important;}' });
      await page.evaluate(() => { const h = document.querySelector('.page.page-live'); const s = document.createElement('div'); s.style.height = '2000px'; h.appendChild(s); });
      await page.waitForTimeout(1100);
      // Los halos animados (cyber) no cuentan: se apagan para medir solo el recorte.
      await page.addStyleTag({ content: '.botnav-fab::after,.botnav::after{animation:none!important;opacity:0!important}' });
      const box = await page.evaluate(() => { const r = document.querySelector('.botnav-fab').getBoundingClientRect(); return { x: Math.floor(r.left) - 4, y: Math.floor(r.top) - 4, width: Math.ceil(r.width) + 8, height: Math.ceil(r.height) + 8 }; });
      const shot = async () => fabPixels(decodePng(await page.screenshot({ clip: box })));
      const full = await shot();
      const control = await shot();
      // Pausa la transición de la barra en t=1 ms en cuanto aparece la clase (microtarea, antes de pintar).
      await page.evaluate(() => { const n = document.querySelector('.botnav'); window.__first = null; new MutationObserver(() => { if (window.__first === null && n.classList.contains('botnav-hidden')) { window.__first = n.getAnimations().length; n.getAnimations().forEach(a => { a.pause(); a.currentTime = 1; }); } }).observe(n, { attributes: true, attributeFilter: ['class'] }); });
      const cdp = await context.newCDPSession(page); const x = Math.round(c.width / 2);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: 600 }] });
      for (let i = 1; i <= 16; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: 600 - i * 16 }] }); await page.waitForTimeout(16); }
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForFunction(() => window.__first !== null, null, { timeout: 5000 });
      const state = await page.evaluate(() => { const n = document.querySelector('.botnav'); return { hidden: n.classList.contains('botnav-hidden'), anims: window.__first, overflow: getComputedStyle(n).overflow, clipPath: getComputedStyle(n).clipPath, transform: getComputedStyle(n).transform, bottom: getComputedStyle(n).bottom }; });
      const first = await shot();
      const row = { name: c.name, full, visibleRatioControl: control / full, hiddenAtStart: state.hidden, animationsPaused: state.anims, state, firstHiddenFramePixels: first, visibleRatioFirstHiddenFrame: first / full };
      rows.push(row); console.log(JSON.stringify(row)); await context.close();
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
  const issues = verdict(rows, minRatio);
  console.log(JSON.stringify({ minRatio, issues }));
  if (issues.length) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
