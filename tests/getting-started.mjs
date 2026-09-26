import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = resolve('.');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2' };
async function serve(directory) {
  const server = createServer(async (req, res) => {
    let pathname = new URL(req.url, 'http://localhost').pathname;
    if (pathname.endsWith('/')) pathname += 'index.html';
    const path = resolve(directory, '.' + pathname);
    if (!path.startsWith(directory + '/')) { res.writeHead(403).end(); return; }
    try { res.setHeader('Content-Type', mime[extname(path)] || 'application/json'); res.end(await readFile(path)); }
    catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const { server, base } = await serve(root);
const browser = await chromium.launch({ channel: 'chrome' });
const temp = await mkdtemp(join(tmpdir(), 'cocoon-start-'));
const artifacts = '/tmp/arc-showcase-verification';
await mkdir(artifacts, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.addInitScript(() => { try { localStorage.setItem('cocoon.analytics-consent.v1', JSON.stringify({ choice: 'denied', expires: Date.now() + 86400000 })); } catch {} });
  await page.goto(base);
  assert.equal(await page.locator('#getting-started').evaluate(e => e.nextElementSibling.id), 'showcase');
  await page.locator('#getting-started').scrollIntoViewIfNeeded();
  const shell = page.frameLocator('#getting-started-frame');
  await shell.locator('[data-step="0"][aria-pressed="true"]').waitFor();
  const example = shell.frameLocator('#example');
  await example.getByRole('button', { name: 'Dismiss' }).waitFor();
  await page.locator('#getting-started-frame.ready').waitFor();

  for (let step = 0; step < 3; step++) {
    await shell.locator(`[data-step="${step}"]`).click();
    await shell.locator(`[data-step="${step}"][aria-pressed="true"]`).waitFor();
    await example.getByRole('button', { name: 'Dismiss' }).waitFor();
    assert.equal(await example.locator('body').evaluate(() => !!window.importmap['components.HelloWorld']), step > 0);
    assert.equal(await example.locator('body').evaluate(() => window.application.constructor.name), step === 2 ? 'HelloApplication' : 'Application');
    if (step === 0) assert.equal(await example.locator('body').evaluate(() => performance.getEntriesByType('resource').some(r => r.name.endsWith('/.importmap'))), false);
    for (const greeting of ['Hola, mundo', 'Bonjour, le monde', 'こんにちは世界', 'Hello World']) {
      await example.getByRole('button', { name: 'Say hello' }).click();
      assert.equal(await example.locator('hello-world h1').textContent(), greeting);
    }
    await example.getByRole('button', { name: 'Dismiss' }).click();
    await example.locator('hello-world').waitFor({ state: 'detached' });
    await shell.locator('#replay').click();
    await example.getByRole('button', { name: 'Dismiss' }).waitFor();
    await example.getByRole('button', { name: 'Close', exact: true }).click();
    await example.locator('hello-world').waitFor({ state: 'detached' });
    await shell.locator('#replay').click();
    await example.getByRole('button', { name: 'Say hello' }).waitFor();
    const pending = page.waitForEvent('download');
    await shell.locator('#download').click();
    const download = await pending;
    const zip = join(temp, download.suggestedFilename());
    await download.saveAs(zip);
    execFileSync('unzip', ['-q', zip, '-d', temp]);
    const folder = join(temp, download.suggestedFilename().replace('.zip', ''));
    const offline = await serve(folder);
    const offlinePage = await browser.newPage();
    const offlineErrors = [];
    offlinePage.on('pageerror', e => offlineErrors.push(e.message));
    offlinePage.on('response', r => { if (r.status() >= 400) offlineErrors.push(r.url()); });
    await offlinePage.route('**/*', route => route.request().url().startsWith(offline.base) ? route.continue() : (offlineErrors.push(route.request().url()), route.abort()));
    try {
      if (step === 2) await offlinePage.emulateMedia({ reducedMotion: 'reduce' });
      await offlinePage.goto(offline.base);
      await offlinePage.getByRole('button', { name: 'Dismiss' }).waitFor();
      await offlinePage.getByRole('button', { name: 'Dismiss' }).click();
      await offlinePage.locator('hello-world').waitFor({ state: 'detached' });
      assert.deepEqual(offlineErrors, [], `offline step ${step}`);
    } finally { await offlinePage.close(); offline.server.close(); }
  }
  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor({ state: 'visible' });
  assert.equal(await shell.locator('#source-explorer').getAttribute('readonly'), '');
  let paths = await shell.locator('#source-explorer').evaluate(e => Object.keys(e.getFiles()));
  assert(paths.includes('index.html'));
  assert(paths.includes('src/components/HelloWorld/index.css'));
  assert(paths.includes('src/applications/HelloApplication/index.js'));
  await shell.locator('[data-step="0"]').click();
  await shell.locator('[data-step="0"][aria-pressed="true"]').waitFor();
  paths = await shell.locator('#source-explorer').evaluate(e => Object.keys(e.getFiles()));
  assert(!paths.includes('.importmap'));
  assert(!paths.includes('src/applications/HelloApplication/index.js'));
  await page.screenshot({ path: join(artifacts, 'getting-started-source.png') });
  await shell.locator('#close-source').click();
  await example.getByRole('button', { name: 'Dismiss' }).waitFor();
  await page.screenshot({ path: join(artifacts, 'getting-started-desktop.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#getting-started').scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  assert(await shell.locator('.getting-started').evaluate(e => e.getBoundingClientRect().right <= innerWidth));
  assert(await example.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await shell.locator('#view-source').evaluate(e => e.getBoundingClientRect().height), await shell.locator('#download').evaluate(e => e.getBoundingClientRect().height));
  await page.screenshot({ path: join(artifacts, 'getting-started-mobile.png') });
  await example.getByRole('button', { name: 'Dismiss' }).click();
  await example.locator('hello-world').waitFor({ state: 'detached' });
  assert.deepEqual(errors, []);
  console.log('PASS: placement, three runnable steps, dismiss/replay, read-only source switching, mobile, and all three offline ZIPs');
} finally { await browser.close(); server.close(); await rm(temp, { recursive: true, force: true }); }
