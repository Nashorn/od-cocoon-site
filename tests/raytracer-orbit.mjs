import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { homeView, orbitView, cameraPosition } from '../parallel/src/examples/raytracer/OrbitCamera.js';

assert.deepEqual(cameraPosition(homeView), [0, 3.05, 8.8]);
for (const dy of [-1e6, 1e6]) {
  const view = orbitView(homeView, 1e6, dy), camera = cameraPosition(view);
  assert.ok(view.yaw >= -Math.PI && view.yaw <= Math.PI);
  assert.ok(view.pitch >= .09 && view.pitch <= 1.1);
  assert.ok(camera.every(Number.isFinite) && camera[1] > 0);
}
const root = resolve('.'), mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const server = process.env.COCOON_TEST_URL ? null : createServer(async (req, res) => {
  const path = resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
  if (!path.startsWith(root + '/')) { res.writeHead(403).end(); return; }
  try { res.writeHead(200, { 'Content-Type': mime[extname(path)] || 'application/json' }).end(await readFile(path)); }
  catch { res.writeHead(404).end(); }
});
if (server) await new Promise(done => server.listen(0, '127.0.0.1', done));
const base = process.env.COCOON_TEST_URL || `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ channel: 'chrome' });
const artifacts = '/tmp/cocoon-raytracer-orbit';
await mkdir(artifacts, { recursive: true });
const errors = [];
const observe = page => {
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.url().startsWith(base) && r.status() >= 400) errors.push(r.url()); });
};
const finished = page => page.waitForFunction(() => document.querySelector('arc-raytracer')?.field?.session.result && !document.querySelector('arc-raytracer').field.rendering, null, { timeout: 60000 });
const state = page => page.evaluate(() => {
  const f = document.querySelector('arc-raytracer').field, s = f.session;
  return { view: f.view, camera: s.camera, generation: s.generation, orbiting: s.orbiting, frames: s.orbitFrames, previewTime: s.orbitPreviewTime, result: s.result, comparisons: s.results, samples: s.samples, threads: s.threads, pool: s.pool?.size, drag: Boolean(f.drag) };
});
try {
  const page = await browser.newPage({ viewport: { width: 1100, height: 1100 } });
  observe(page);
  await page.goto(base + '/parallel/raytracer.html');
  await finished(page);
  await page.locator('#samples').selectOption('24');
  await finished(page);
  const canvas = page.locator('canvas.scene');
  const home = await canvas.evaluate(c => c.toDataURL());
  const before = await state(page);
  await canvas.click();
  assert.equal((await state(page)).generation, before.generation, 'a click without a drag does not rerender');
  const box = await canvas.boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 10, y + 1);
  await page.evaluate(() => window.dragPool = document.querySelector('arc-raytracer').field.session.pool);
  for (let i = 2; i <= 16; i++) { await page.mouse.move(x + i * 8, y + i); await page.waitForTimeout(20); }
  const preview = await state(page);
  assert.ok(preview.orbiting && preview.frames > 1 && preview.view.yaw !== 0);
  assert.equal(preview.result, null, 'preview is not a benchmark');
  assert.deepEqual(preview.comparisons, { main: null, threads: null });
  assert.ok(await page.evaluate(() => window.dragPool === document.querySelector('arc-raytracer').field.session.pool), 'reuse the drag worker pool');
  await page.mouse.move(box.x + box.width + 20, y + 20); // capture continues outside the canvas
  await page.mouse.up();
  await finished(page);
  const refined = await state(page);
  assert.equal(refined.drag, false);
  assert.equal(refined.orbiting, false);
  assert.equal(refined.samples, 24);
  assert.deepEqual(refined.result.camera, refined.camera);
  assert.notEqual(await canvas.evaluate(c => c.toDataURL()), home);
  await page.waitForTimeout(250);
  await canvas.screenshot({ path: artifacts + '/orbited.png' });
  await page.locator('#reset-view').click();
  await finished(page);
  assert.equal(await canvas.evaluate(c => c.toDataURL()), home, 'Reset view exactly restores the original picture');
  assert.equal((await state(page)).samples, 24, 'Reset view preserves quality');

  await canvas.press('ArrowLeft');
  await finished(page);
  assert.notEqual((await state(page)).view.yaw, 0);
  await canvas.press('Home');
  await finished(page);
  assert.equal(await canvas.evaluate(c => c.toDataURL()), home);

  // Main-thread selection is retained, but interaction previews must remain on workers.
  await page.locator('[data-threads="0"]').click();
  await finished(page);
  await page.mouse.move(x, y); await page.mouse.down();
  await page.mouse.move(x + 45, y, { steps: 5 });
  const mainPreview = await state(page);
  assert.equal(mainPreview.threads, 0);
  assert.ok(mainPreview.pool > 0);
  assert.deepEqual(mainPreview.comparisons, { main: null, threads: null });
  await canvas.dispatchEvent('pointercancel', { pointerId: await page.evaluate(() => document.querySelector('arc-raytracer').field.drag.id) });
  await page.mouse.up();
  await finished(page);
  assert.equal((await state(page)).result.threads, 0);
  assert.equal((await state(page)).result.speedup, null);
  await page.close();
  console.log(`PASS: bounds, click threshold, sustained previews (${preview.frames} frames; last ${preview.previewTime.toFixed(1)} ms), worker reuse, outside release, exact reset, keyboard, pointer cancellation and benchmark invalidation`);

  const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const mobile = await mobileContext.newPage();
  observe(mobile);
  await mobile.goto(base + '/parallel/raytracer.html');
  const mobileCanvas = mobile.locator('canvas.scene');
  await mobileCanvas.scrollIntoViewIfNeeded();
  await finished(mobile);
  await mobile.locator('#samples').selectOption('24');
  await mobileCanvas.scrollIntoViewIfNeeded();
  await finished(mobile);
  const cdp = await mobileContext.newCDPSession(mobile);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
  const rect = await mobileCanvas.boundingBox(), tx = rect.x + rect.width / 2, ty = rect.y + rect.height / 2;
  await touch('touchStart', tx, ty);
  for (let i = 1; i <= 10; i++) { await touch('touchMove', tx + i * 8, ty); await mobile.waitForTimeout(20); }
  assert.ok((await state(mobile)).orbiting, 'horizontal touch drag orbits');
  await touch('touchEnd');
  await finished(mobile);
  const rotated = (await state(mobile)).camera;
  const scrollBefore = await mobile.evaluate(() => scrollY);
  await touch('touchStart', tx, ty);
  for (let i = 1; i <= 8; i++) { await touch('touchMove', tx, ty - i * 12); await mobile.waitForTimeout(20); }
  await touch('touchEnd');
  await mobile.waitForTimeout(300);
  assert.ok(await mobile.evaluate(before => scrollY > before + 10, scrollBefore), 'vertical swipe scrolls the page');
  assert.deepEqual((await state(mobile)).camera, rotated, 'vertical scrolling does not rotate');
  assert.equal((await state(mobile)).drag, false);
  assert.deepEqual(errors, []);
  await mobileContext.close();
  console.log('PASS: real touch orbit/refinement and native vertical scrolling, no browser errors');
} finally { await browser.close(); server?.close(); }
