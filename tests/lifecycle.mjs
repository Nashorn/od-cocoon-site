import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const mime = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.json':'application/json', '.woff2':'font/woff2', '.svg':'image/svg+xml' };
const server = createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(root + '/')) return res.writeHead(403).end();
  try {
    const body = await readFile(path);
    res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath:process.env.CHROME_PATH } : { channel:'chrome' });
const page = await browser.newPage({ viewport:{ width:1440, height:1000 } });
const errors = [];
page.on('pageerror', error => errors.push(error.message));

try {
  await page.goto(base, { waitUntil:'networkidle' });
  assert.equal(await page.locator('#lifecycle-frame').getAttribute('src'), null, 'lifecycle lab remains lazy above its section');
  await page.locator('a[href="#lifecycle"]').click();
  await page.waitForFunction(() => document.querySelector('#lifecycle-frame')?.classList.contains('ready'), null, { timeout:20000 });
  const frame = page.locator('#lifecycle-frame').contentFrame();
  const shell = frame.locator('arc-lifecycle');
  await shell.locator('.lifecycle-stage').waitFor();

  await shell.locator('#replay').click();
  await page.waitForTimeout(7000);
  assert.equal(await shell.locator('#current-phase').textContent(), 'WORLD');
  assert.equal(await shell.locator('#live-component hello-world').count(), 1);

  await shell.locator('[data-example="lazy"]').click();
  assert.match(await shell.locator('#world-status').textContent(), /awaiting intersection/);
  await shell.locator('#play').click();
  assert.equal(await shell.locator('#current-phase').textContent(), 'STYLE');

  await shell.locator('[data-example="reconnect"]').click();
  await shell.locator('#play').click();
  assert.equal(await shell.locator('#current-phase').textContent(), 'SLEEP');
  await page.waitForTimeout(1100);
  assert.equal(await shell.locator('#current-phase').textContent(), 'WORLD');

  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor();
  assert.match(await shell.locator('#source-explorer .code').textContent(), /class LifecycleCard/);
  assert.equal(await shell.locator('#source-explorer .code').getAttribute('contenteditable'), 'false');
  await shell.locator('#close-source').click();

  await page.setViewportSize({ width:390, height:844 });
  await page.locator('a[href="#lifecycle"]').click();
  assert.ok(await shell.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'lifecycle iframe fits mobile');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing page fits mobile');
  assert.deepEqual(errors, []);
  console.log('PASS: lazy boot, lifecycle playback, lazy gate, reconnect, source explorer and mobile layout');
} finally {
  await browser.close();
  server.close();
}
