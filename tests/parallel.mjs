import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('.');
const mime = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };
const serve = folder => createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(folder, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(folder + '/')) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/json' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`)));
const server = serve(root);
const base = await listen(server);
const artifacts = process.env.SHOWCASE_ARTIFACTS || '/tmp/arc-showcase-verification';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : { channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
const host = await context.newPage();
const errors = [];
host.on('pageerror', error => errors.push(error.message));
host.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });

// Arms a listener before `action`, so the render it starts can't finish unobserved.
const renderAfter = async (page, action) => {
  await page.evaluate(() => {
    window.nextRender = new Promise(done => document.addEventListener('mandelbrot:rendered', event => done(event.detail), { once: true }));
  });
  await action();
  return page.evaluate(() => window.nextRender);
};

try {
  await context.addInitScript(() => { try { localStorage.setItem('cocoon.analytics-consent.v1', JSON.stringify({ choice: 'denied', expires: Date.now() + 86400000 })); } catch {} });
  await host.goto(base, { waitUntil: 'networkidle' });
  assert.equal(await host.locator('#parallel-frame').getAttribute('src'), null, 'parallel must remain lazy above section');
  await host.locator('nav a[href="#parallel"]').click();
  await host.waitForFunction(() => document.querySelector('#parallel-frame').classList.contains('ready'), null, { timeout: 20000 });
  const page = host.frames().find(f => f.url().includes('/parallel/index.html'));
  const shell = page.locator('arc-parallel');
  await page.waitForFunction(() => document.querySelector('arc-parallel')?.field?.hasRendered, null, { timeout: 20000 });
  await page.waitForFunction(() => !document.querySelector('arc-parallel').field.rendering, null, { timeout: 30000 });

  const max = await page.evaluate(() => document.querySelector('arc-parallel').field.maxThreads);
  assert.equal(await shell.locator('.thread-count').textContent(), String(max));
  assert.equal(await page.evaluate(() => core.lang.ThreadPool.defaultSize()), max);

  const main = await renderAfter(page, () => shell.locator('[data-threads="0"]').click());
  assert.equal(main.threads, 0);
  assert.ok(main.worstFrame >= main.time * 0.8, `main-thread render blocks frames (${main.worstFrame} vs ${main.time})`);
  const threaded = await renderAfter(page, () => shell.locator('[data-threads="max"]').click());
  assert.equal(threaded.threads, max);
  assert.ok(threaded.speedup > 1.5, `threads beat the main thread (${threaded.speedup?.toFixed(2)}×)`);
  assert.ok(threaded.worstFrame < main.worstFrame / 2, 'threaded render keeps frames flowing');
  assert.match(await shell.locator('#render-time').textContent(), /faster/);
  await shell.screenshot({ path: artifacts + '/parallel-desktop.png' });

  const span = await page.evaluate(() => document.querySelector('arc-parallel').field.view.span);
  const canvas = page.locator('arc-mandelbrot-field canvas.fractal');
  await renderAfter(page, () => canvas.click());
  assert.ok(await page.evaluate(() => document.querySelector('arc-parallel').field.view.span) < span, 'click zooms in');
  await renderAfter(page, () => canvas.press('Digit0'));
  assert.equal(await page.evaluate(() => document.querySelector('arc-parallel').field.view.span), span, '0 returns home');

  await shell.locator('#iterations').fill('2000');
  await renderAfter(page, () => shell.locator('#iterations').dispatchEvent('change'));
  assert.equal(await page.evaluate(() => document.querySelector('arc-parallel').field.iterations), 2000);
  await renderAfter(page, () => shell.locator('#reset').click());
  assert.equal(await page.evaluate(() => document.querySelector('arc-parallel').field.iterations), 1000);
  assert.equal(await shell.locator('[data-threads="max"]').getAttribute('aria-pressed'), 'true');

  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor();
  const source = shell.locator('#source-explorer .code');
  assert.ok((await source.textContent()).includes('ThreadPool'));
  assert.equal(await source.getAttribute('contenteditable'), 'false');
  await page.waitForFunction(() => !MainLoop.isRunning());
  await shell.locator('#close-source').click();
  await page.waitForFunction(() => MainLoop.isRunning());

  await host.locator('nav a[href="#top"]').click();
  await host.waitForTimeout(700);
  assert.equal(await page.evaluate(() => MainLoop.isRunning()), false, 'offscreen loop stops');
  await host.setViewportSize({ width: 390, height: 844 });
  await renderAfter(page, () => host.locator('nav a[href="#parallel"]').click());
  await page.waitForFunction(() => MainLoop.isRunning());
  const mobileCanvas = await page.evaluate(() => { const c = document.querySelector('arc-parallel').field.canvas; return [c.width, c.height]; });
  assert.ok(mobileCanvas[0] < 1000, `canvas re-rendered at mobile size (${mobileCanvas})`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile fits iframe');
  assert.ok(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'mobile fits landing');
  await shell.screenshot({ path: artifacts + '/parallel-mobile.png' });

  const downloadPromise = host.waitForEvent('download');
  await shell.locator('#download').click();
  const download = await downloadPromise;
  await download.saveAs(artifacts + '/mandelbrot.zip');
  assert.equal(download.suggestedFilename(), 'cocoon-mandelbrot.zip');
  const { execFileSync } = await import('node:child_process');
  const { mkdtemp } = await import('node:fs/promises');
  const folder = await mkdtemp('/tmp/cocoon-mandelbrot-export-');
  execFileSync('unzip', ['-q', artifacts + '/mandelbrot.zip', '-d', folder]);
  const exported = serve(resolve(folder, 'mandelbrot'));
  const exportURL = await listen(exported);
  try {
    const offline = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    const demo = await offline.newPage();
    const failures = [], external = [];
    await offline.route('**/*', route => {
      if (route.request().url().startsWith(exportURL)) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    demo.on('pageerror', error => failures.push(error.message));
    demo.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await demo.goto(exportURL, { waitUntil: 'networkidle' });
    await demo.waitForFunction(() => document.querySelector('#result')?.textContent.includes('threads'), null, { timeout: 30000 });
    await demo.locator('#main').click();
    await demo.waitForFunction(() => document.querySelector('#result').textContent.includes('faster'), null, { timeout: 30000 });
    assert.deepEqual(external, []); assert.deepEqual(failures, []);
    await offline.close();
    console.log('PASS: extracted ZIP renders on threads and main thread without external requests');
  } finally { exported.close(); }
  assert.deepEqual(errors, []);
  console.log(`PASS: lazy boot, ${max}-thread pool ${threaded.speedup.toFixed(1)}× faster than main thread, main-thread stall measured, zoom, iterations, reset, source, offscreen stop, mobile and ZIP download`);
} catch (error) { console.log('BROWSER ERRORS', errors); throw error; }
finally { await browser.close(); server.close(); }
