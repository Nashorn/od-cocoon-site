import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const root = resolve('.');
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2' };
const serve = folder => createServer(async (req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  const path = resolve(folder, '.' + (pathname === '/' ? '/index.html' : pathname));
  if (!path.startsWith(folder + '/')) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/json' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', () => done(`http://127.0.0.1:${server.address().port}`)));
const server = process.env.COCOON_TEST_URL ? null : serve(root);
const base = process.env.COCOON_TEST_URL || await listen(server);
const artifacts = '/tmp/cocoon-raytracer-integration';
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } });
await context.addInitScript(() => { try { localStorage.setItem('cocoon.analytics-consent.v1', JSON.stringify({ choice: 'denied', expires: Date.now() + 86400000 })); } catch {} });
const host = await context.newPage(), errors = [];
host.on('pageerror', error => errors.push(error.message));
host.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const renderAfter = async (frame, action) => {
  await frame.evaluate(() => { window.nextRay = new Promise(done => document.addEventListener('raytracer:rendered', event => done(event.detail), { once: true })); });
  await action();
  return frame.evaluate(() => window.nextRay);
};
try {
  await host.goto(base + '/index.html#showcase', { waitUntil: 'networkidle' });
  await host.locator('nav a[href="#parallel"]').click();
  await host.waitForFunction(() => document.querySelector('#parallel-frame').classList.contains('ready'));
  const frame = host.frames().find(item => item.url().includes('/parallel/raytracer.html'));
  const iframeCount = await host.locator('iframe').count();
  assert.deepEqual(await frame.locator('.example-picker [data-example]').evaluateAll(buttons => buttons.map(button => button.dataset.example)), ['raytracer', 'mandelbrot']);
  await frame.waitForFunction(() => document.querySelector('arc-raytracer')?.field?.session.result, null, { timeout: 90000 });
  const shell = frame.locator('arc-raytracer');
  const initial = await frame.evaluate(() => document.querySelector('arc-raytracer').field.session.result);
  assert.equal(initial.samples, 96);
  assert.equal(await host.locator('iframe').count(), iframeCount, 'reuse the section iframe');
  assert.match(await host.locator('#parallel-frame').getAttribute('title'), /Ray Tracer/);
  assert.equal(await shell.locator('[data-example="raytracer"]').getAttribute('aria-current'), 'page');
  await host.locator('#parallel').screenshot({ path: artifacts + '/desktop.png' });
  console.log('PASS: enabled Ray Tracer picker, same iframe, desktop render and frame title');

  // Source must pause a running render and show the real, reusable sample files.
  await shell.locator('#samples').selectOption('256');
  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor();
  await frame.waitForFunction(() => !MainLoop.isRunning() && !document.querySelector('arc-raytracer').field.rendering);
  assert.equal(await frame.evaluate(() => document.querySelector('arc-raytracer').field.session.pool), null);
  assert.match(await shell.locator('#source-explorer .code').textContent(), /renderTile/);
  assert.equal(await shell.locator('#source-explorer .code').getAttribute('contenteditable'), 'false');
  assert.equal(await shell.locator('#live-label').textContent(), 'SOURCE');
  await shell.locator('#close-source').click();
  await frame.waitForFunction(() => document.querySelector('arc-raytracer').field.rendering);
  await renderAfter(frame, () => shell.locator('#samples').selectOption('24'));

  await shell.locator('#render').click();
  await shell.locator('#stop').click();
  assert.equal(await frame.evaluate(() => document.querySelector('arc-raytracer').field.session.pool), null);
  const stopped = await shell.locator('canvas.scene').evaluate(c => c.toDataURL());
  await host.waitForTimeout(300);
  assert.equal(await shell.locator('canvas.scene').evaluate(c => c.toDataURL()), stopped);

  await shell.locator('#render').click();
  await host.locator('nav a[href="#top"]').click();
  await frame.waitForFunction(() => !MainLoop.isRunning() && !document.querySelector('arc-raytracer').field.rendering);
  assert.equal(await frame.evaluate(() => document.querySelector('arc-raytracer').field.session.pool), null);
  await renderAfter(frame, () => host.locator('nav a[href="#parallel"]').click());
  console.log('PASS: source, stop, stale-pixel protection and offscreen pause/resume');

  await host.setViewportSize({ width: 390, height: 844 });
  await shell.locator('arc-raytracer-field').scrollIntoViewIfNeeded();
  await frame.waitForFunction(() => document.querySelector('arc-raytracer').field.session.result?.width === 640 && !document.querySelector('arc-raytracer').field.rendering, null, { timeout: 60000 });
  assert.ok(await host.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.ok(await frame.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await host.locator('#parallel').screenshot({ path: artifacts + '/mobile.png' });

  // At mobile resolution Preview makes the blocking comparison short enough for QA.
  const threadedImage = await shell.locator('canvas.scene').evaluate(c => c.toDataURL());
  const main = await renderAfter(frame, () => shell.locator('[data-threads="0"]').click());
  assert.equal(main.threads, 0);
  assert.ok(main.worstFrame >= main.time * .8, 'measure the real main-thread stall');
  assert.equal(await shell.locator('canvas.scene').evaluate(c => c.toDataURL()), threadedImage, 'same image on main and workers');
  const threaded = await renderAfter(frame, () => shell.locator('[data-threads="max"]').click());
  assert.ok(threaded.speedup > 1, 'workers speed up the same scene');
  assert.ok(threaded.worstFrame < main.worstFrame / 2);
  await renderAfter(frame, () => shell.locator('#reset').click());
  assert.equal(await shell.locator('#samples').inputValue(), '96');
  console.log('PASS: mobile fit, identical main/worker image, measured stall, speedup and reset');

  const downloadPromise = host.waitForEvent('download');
  await shell.locator('#download').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'cocoon-raytracer.zip');
  await download.saveAs(artifacts + '/raytracer.zip');
  const folder = await mkdtemp('/tmp/cocoon-raytracer-export-');
  execFileSync('unzip', ['-q', artifacts + '/raytracer.zip', '-d', folder]);
  const exported = serve(resolve(folder, 'raytracer')), exportURL = await listen(exported);
  try {
    const offline = await browser.newContext({ viewport: { width: 800, height: 900 } });
    const demo = await offline.newPage(), failures = [], external = [];
    await offline.route('**/*', route => {
      if (route.request().url().startsWith(exportURL)) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    demo.on('pageerror', error => failures.push(error.message));
    demo.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
    await demo.goto(exportURL);
    await demo.waitForFunction(() => document.querySelector('#result').textContent.includes('threads'), null, { timeout: 60000 });
    await demo.locator('#samples').selectOption('24');
    await demo.waitForFunction(() => document.querySelector('#result').textContent.includes('24 samples'), null, { timeout: 60000 });
    await demo.locator('#main').click();
    await demo.waitForFunction(() => document.querySelector('#result').textContent.includes('Main thread:'), null, { timeout: 60000 });
    assert.deepEqual(failures, []); assert.deepEqual(external, []);
    console.log('PASS: extracted Ray Tracer ZIP on workers and main thread, no external requests');
    await offline.close();
  } finally { exported.close(); }

  await shell.locator('[data-example="mandelbrot"]').click();
  await frame.waitForURL('**/parallel/index.html');
  await frame.locator('arc-mandelbrot-field').scrollIntoViewIfNeeded();
  await frame.waitForFunction(() => document.querySelector('arc-parallel')?.field?.hasRendered && !document.querySelector('arc-parallel').field.rendering);
  assert.equal(await frame.locator('[data-example="raytracer"]').isEnabled(), true);
  assert.deepEqual(errors, []);
  console.log(`PASS: ${base}/index.html#showcase → Multicore → Ray Tracer → Mandelbrot; existing iframe, source, cancellation, offscreen pause/resume, mobile, main-thread parity/stall, worker speedup, reset, and offline standalone ZIP.`);
  console.log(JSON.stringify({ initial, main, threaded, artifacts }, null, 2));
} catch (error) {
  console.log('BROWSER ERRORS', errors);
  await host.screenshot({ path: artifacts + '/failure.png', fullPage: true });
  throw error;
} finally { await browser.close(); server?.close(); }
