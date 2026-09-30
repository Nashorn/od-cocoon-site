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
  assert.equal(await shell.locator('#current-phase').textContent(), 'DEFINE', 'lifecycle opens at phase 03');

  const phaseLayers = ['.layer-page','.layer-page','.layer-element','.layer-root','.layer-root','.layer-style','.layer-content','.layer-page','#live-component'];
  for (let phase = 0; phase < phaseLayers.length; phase++) {
    await shell.locator(`.phase-rail [data-phase="${phase}"]`).click();
    await shell.locator('.stage-grid').click({ position:{ x:20, y:20 } });
    await page.waitForTimeout(900);
    const inspection = await shell.evaluate((host, selector) => {
      const root = host.shadowRoot;
      const active = root.querySelector(selector);
      const others = [...root.querySelectorAll('.layer-assembly > .layer:not(.is-inspected-layer), .layer-assembly > .live-component:not(.is-inspected-layer)')];
      return {
        active:active?.classList.contains('is-inspected-layer'),
        inspecting:root.querySelector('.layer-assembly').classList.contains('is-inspecting'),
        visibleOthers:others.filter(layer => getComputedStyle(layer).visibility !== 'hidden').length,
        overflowX:active.scrollWidth - active.clientWidth,
        overflowY:active.scrollHeight - active.clientHeight
      };
    }, phaseLayers[phase]);
    assert.deepEqual(inspection, { active:true, inspecting:true, visibleOthers:0, overflowX:0, overflowY:0 }, `phase ${phase + 1} inspects only its active layer`);
    if (phase === 7) {
      const worldSource = await shell.locator('.page-source-world').textContent();
      assert.match(worldSource, /<!doctype html>/, 'world-ready page retains a valid doctype');
      assert.match(worldSource, /<hello-world>[\s\S]*#shadow-root \(open\)[\s\S]*<\/hello-world>/, 'world-ready page shows the hydrated host in body');
    }
  }
  await shell.locator('.phase-rail [data-phase="2"]').click();
  assert.equal(await shell.locator('.layer-assembly').evaluate(node => node.classList.contains('is-inspecting')), false, 'phase change closes layer inspection');
  await shell.locator('.stage-grid').click({ position:{ x:20, y:20 } });
  await shell.locator('#step').click();
  assert.equal(await shell.locator('.layer-assembly').evaluate(node => node.classList.contains('is-inspecting')), false, 'step closes layer inspection');

  await shell.locator('#replay').click();
  await page.waitForTimeout(7000);
  assert.equal(await shell.locator('#current-phase').textContent(), 'CONNECTED & RENDERED');
  assert.equal(await shell.locator('#live-component hello-world').count(), 1);

  await shell.locator('[data-example="lazy"]').click();
  assert.match(await shell.locator('#world-status').textContent(), /awaiting intersection/);
  await shell.locator('#play').click();
  assert.equal(await shell.locator('#current-phase').textContent(), 'STYLE');

  await shell.locator('[data-example="reconnect"]').click();
  await shell.locator('#play').click();
  assert.equal(await shell.locator('#current-phase').textContent(), 'SLEEP');
  await page.waitForTimeout(1100);
  assert.equal(await shell.locator('#current-phase').textContent(), 'CONNECTED & RENDERED');

  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor();
  const helloWorldSource = await shell.locator('#source-explorer .code').textContent();
  assert.match(helloWorldSource, /^namespace `examples` \(/);
  assert.match(helloWorldSource, /class HelloWorld extends Component/);
  assert.doesNotMatch(helloWorldSource, /export default/);
  assert.equal(await shell.locator('#source-explorer .code').getAttribute('contenteditable'), 'false');
  await shell.locator('#close-source').click();

  await page.setViewportSize({ width:390, height:844 });
  await page.locator('a[href="#lifecycle"]').click();
  assert.ok(await shell.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'lifecycle iframe fits mobile');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'landing page fits mobile');
  assert.deepEqual(errors, []);
  console.log('PASS: nine-phase layer inspection, lifecycle playback, lazy gate, reconnect, source explorer and mobile layout');
} finally {
  await browser.close();
  server.close();
}
