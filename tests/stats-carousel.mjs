import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { const body = await readFile(path); res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/json' }).end(body); }
  catch { res.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const artifacts = process.env.SHOWCASE_ARTIFACTS || '/tmp/arc-showcase-verification';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const host = await context.newPage();
let page;
const errors = [];
host.on('pageerror', error => errors.push(error.message));
host.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

try {
  await host.goto(base, { waitUntil: 'networkidle' });
  const frame = host.frames().find(f => f.url().includes('/showcase/'));
  const carousel = frame.locator('arc-stats-carousel');
  await carousel.locator('.tile').first().waitFor();
  await carousel.scrollIntoViewIfNeeded();
  for (const width of [1920, 1440, 700, 390]) {
    await host.setViewportSize({ width, height: 1100 });
    const bounds = await carousel.evaluate(c => {
      const a = c.getBoundingClientRect();
      const b = document.querySelector('arc-showcase').querySelector('.showcase').getBoundingClientRect();
      return { left: a.left - b.left, right: a.right - b.right };
    });
    assert.ok(Math.abs(bounds.left) < 1 && Math.abs(bounds.right) < 1, JSON.stringify({width, bounds}));
  }
  await host.setViewportSize({width: 1440, height: 1100});
  assert.equal(await carousel.locator('.tile').count(), 4);
  assert.equal(await carousel.locator('.navigation').isVisible(), false);
  assert.equal(await carousel.locator('.indicators').isVisible(), false);
  assert.equal(await carousel.locator('.next').isDisabled(), true);
  await carousel.evaluate(c => c.renderTiles([...c.tiles, {...c.tiles[0], value: 'Extra'}]));
  await carousel.scrollIntoViewIfNeeded();
  await carousel.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await carousel.locator('.next').click();
  await host.waitForTimeout(650);
  assert.ok(await carousel.locator('.track').evaluate(e => e.scrollLeft > 0));
  assert.equal(await carousel.locator('.next').isDisabled(), true);
  await carousel.locator('.previous').click();
  await host.waitForTimeout(650);
  assert.equal(await carousel.locator('.previous').isDisabled(), true);
  await carousel.evaluate(c => c.renderTiles());
  await host.screenshot({path: '/tmp/stats-desktop.png'});
  await host.setViewportSize({width: 390, height: 844});
  await carousel.scrollIntoViewIfNeeded();
  await carousel.locator('.track').focus();
  await host.keyboard.press('ArrowRight');
  await host.waitForTimeout(650);
  assert.ok(await carousel.locator('.track').evaluate(e => e.scrollLeft > 0));
  assert.ok(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await carousel.locator('.navigation').isVisible(), false);
  assert.equal(await carousel.locator('.indicators').isVisible(), false);
  await carousel.evaluate(c => c.renderTiles([...c.tiles, {...c.tiles[0], value: 'Extra'}]));
  assert.equal(await carousel.locator('.navigation').isVisible(), true);
  assert.equal(await carousel.locator('.indicators').isVisible(), true);
  assert.ok(await carousel.locator('.indicators button').count() > 1);
  await carousel.locator('.indicators button').last().click();
  await host.waitForTimeout(650);
  assert.equal(await carousel.locator('.next').isDisabled(), true);
  assert.equal(await carousel.locator('.indicators button').last().getAttribute('aria-current'), 'true');
  await host.screenshot({path: '/tmp/stats-mobile.png'});
  assert.deepEqual(errors, []);
  console.log('PASS: carousel extra tiles, end states, previous/next, keyboard, mobile overflow, iframe sizing');
} finally {
  await browser.close();
  server.close();
}
