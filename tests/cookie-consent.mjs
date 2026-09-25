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
  const tags = [];
  await context.route('**/analytics-config.js', route => route.fulfill({
    contentType: 'text/javascript', body: "export const measurementId = 'G-TEST123';"
  }));
  await context.route('https://www.googletagmanager.com/**', route => {
    tags.push(route.request().url());
    return route.fulfill({contentType:'text/javascript', body:''});
  });
  await host.goto(base, {waitUntil:'networkidle'});
  const banner = host.locator('arc-cookie-consent');
  assert.equal(await banner.locator('.banner').isVisible(), true);
  assert.equal(tags.length, 0);
  await banner.getByRole('button', {name:'Cookie settings', exact:true}).click();
  assert.equal(await banner.locator('[data-choice=denied]').evaluate(node => node === node.getRootNode().activeElement), true);
  await banner.getByRole('button', {name:'Reject', exact:true}).click();
  await host.reload({waitUntil:'networkidle'});
  assert.equal(await banner.locator('.banner').isVisible(), false);
  assert.equal(tags.length, 0);
  await host.locator('footer [data-cookie-settings]').click();
  await banner.getByRole('button', {name:'Accept', exact:true}).click();
  await host.waitForFunction(() => document.querySelector('script[src*="googletagmanager"]'));
  await host.waitForTimeout(100);
  assert.equal(tags.length, 1);
  assert.equal(await banner.locator('.banner').isVisible(), false);
  await host.evaluate(() => document.cookie = '_ga=example; path=/');
  await host.locator('footer [data-cookie-settings]').click();
  await Promise.all([
    host.waitForEvent('load'),
    banner.getByRole('button', {name:'Reject', exact:true}).click(),
  ]);
  await host.waitForLoadState('networkidle');
  assert.equal(tags.length, 1);
  assert.ok(!(await host.evaluate(() => document.cookie)).includes('_ga='));
  await host.setViewportSize({width:390,height:844});
  await host.locator('footer [data-cookie-settings]').click();
  assert.ok(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await banner.getByRole('button', {name:'Accept', exact:true}).isVisible(), true);
  await host.screenshot({path:'/tmp/cookie-consent-mobile.png'});
  await host.setViewportSize({width:1440,height:1100});
  await host.screenshot({path:'/tmp/cookie-consent-desktop.png'});
  console.log('PASS: default blocking, reject persistence, accept loading, withdrawal, cookie cleanup, settings and mobile layout');
} finally {
  await browser.close();
  server.close();
}
