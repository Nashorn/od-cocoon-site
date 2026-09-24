import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';

const root = resolve('public');
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
const page = await context.newPage();
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.url().startsWith(base) && response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
const state = name => page.waitForFunction(name => document.querySelector('arc-showcase')?.presentation?.state === name, name);
const inspect = fn => page.locator('arc-showcase').evaluate(fn);
const shot = async name => { await page.locator('#showcase').scrollIntoViewIfNeeded(); await page.screenshot({ path: `${artifacts}/${name}.png` }); };
try {
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.locator('arc-showcase[ready]').waitFor();
  assert.equal(await inspect(s => s.team.parts.member.constructor.ancestors.map(c => c.name).includes('ProfileCard')), true);
  assert.equal(await inspect(s => s.team.parts.member.root.adoptedStyleSheets.includes(s.skin.sheet) && s.team.parts.admin.root.adoptedStyleSheets.includes(s.skin.sheet)), true);
  assert.deepEqual(await page.locator('code-explorer').evaluate(e => Object.keys(e.getFiles())), ['constraint.js', 'cloth.js', 'point.js']);
  assert.equal(await inspect(s => s.presentation.mode), 'explore');
  assert.equal(await page.locator('arc-team-access').getAttribute('exploded'), null);
  await page.locator('.viewport').scrollIntoViewIfNeeded();
  await state('explore');
  assert.equal(await page.locator('arc-team-access').getAttribute('exploded'), '');
  await page.locator('[data-mode=interface]').click(); await state('interface');
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.viewport').scrollIntoViewIfNeeded();
  await page.waitForTimeout(1000);
  assert.equal(await inspect(s => s.presentation.state), 'interface');
  console.log('PASS: default Explore 3D animates on first visibility and respects later mode choices');
  await shot('assembled');
  console.log('PASS: real Cocoon classes, shared ancestral CSS, hero preserved');
  assert.equal(await inspect(async s => {
    const team = s.team;
    const assembly = team.$('.assembly');
    const toolbar = team.parts.toolbar;
    const before = assembly.getBoundingClientRect().height;
    const originalHeight = toolbar.style.minHeight;
    const oldCardTop = team.parts.member.getBoundingClientRect().top;
    toolbar.style.minHeight = '180px';
    const moved = team.parts.member.getBoundingClientRect().top > oldCardTop + 50;
    const slot = document.createElement('div');
    slot.className = 'component-slot';
    slot.innerHTML = '<div class="part"><arc-member-card></arc-member-card></div>';
    assembly.append(slot);
    const extra = slot.querySelector('arc-member-card');
    await extra.ready;
    const grown = assembly.getBoundingClientRect().height > before + 150;
    const separate = extra.getBoundingClientRect().top >= team.parts.member.getBoundingClientRect().bottom;
    slot.remove();
    toolbar.style.minHeight = originalHeight;
    return moved && grown && separate;
  }), true);
  console.log('PASS: taller toolbar and additional component flow without overlap');


  await page.locator('arc-access-toolbar button').click();
  await state('playing');
  assert.match(await page.locator('arc-member-card .status-label').textContent(), /Alex approved/);
  assert.match(await page.locator('arc-admin-card .status-label').textContent(), /Alex added/);
  assert.equal(await page.locator('.connections path').count(), 2);
  // Live endpoint geometry, not fixed screen coordinates.
  assert.equal(await inspect(s => {
    const point = s.overlay.point(s.team.endpoint('toolbar', 'approve'));
    const path = s.overlay.lines[0].path.getPointAtLength(0);
    return Math.hypot(point.x - path.x, point.y - path.y) < 1;
  }), true);
  await page.locator('#pause').click();
  const frozen = await page.locator('.connections circle').first().getAttribute('cy');
  await page.waitForTimeout(150);
  assert.equal(await page.locator('.connections circle').first().getAttribute('cy'), frozen);
  await shot('signal-paused');
  await page.locator('#pause').click();
  await state('interface');
  assert.equal(await page.locator('arc-team-access').getAttribute('exploded'), null);
  assert.match(await page.locator('arc-member-card .status-label').textContent(), /approved/);
  console.log('PASS: real signal, two listeners, moving anchors, pause/resume and reassembly');

  await page.locator('[data-mode=explore]').click(); await state('explore');
  await inspect(s => s.presentation.rotate(100, -100));
  assert.deepEqual(await inspect(s => [s.presentation.yaw, s.presentation.pitch]), [25, 6]);
  await page.locator('#reset-view').click();
  assert.deepEqual(await inspect(s => [s.presentation.yaw, s.presentation.pitch]), [-17, 19]);
  const depths = () => inspect(s => [...s.team.root.querySelectorAll('.part')].map(p => new DOMMatrix(getComputedStyle(p).transform).m43));
  const initialDepth = (await depths())[0];
  await page.locator('#depth').evaluate(input => { input.value = '150'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  const lifted = await depths();
  assert.equal(new Set(lifted).size, 1);
  assert.ok(Math.abs(lifted[0] - initialDepth * 1.5) < .01);
  await page.locator('#depth').evaluate(input => input.dispatchEvent(new Event('change', { bubbles: true })));
  await page.locator('#reset-view').click();
  await page.waitForTimeout(900);
  assert.equal(await page.locator('#depth').inputValue(), '100');
  assert.ok(Math.abs((await depths())[0] - initialDepth) < .01);
  console.log('PASS: shared Z depth slider and reset');
  await shot('exploded');
  await page.locator('[data-mode=inspect]').click(); await state('inspecting');
  await page.locator('#radius').evaluate(input => { input.value = '30'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  assert.deepEqual(await inspect(s => [getComputedStyle(s.team.parts.member).borderRadius, getComputedStyle(s.team.parts.admin).borderRadius]), ['30px', '30px']);
  await page.locator('[data-color="#282041"]').click();
  assert.deepEqual(await inspect(s => [getComputedStyle(s.team.parts.member).backgroundColor, getComputedStyle(s.team.parts.admin).backgroundColor]), ['rgb(40, 32, 65)', 'rgb(40, 32, 65)']);
  await page.locator('#host-css').fill(':host { border-radius: 12px; background: #0d302c; border-color: #63e8bc; }');
  await page.locator('#apply-css').click();
  assert.deepEqual(await inspect(s => [getComputedStyle(s.team.parts.member).borderRadius, getComputedStyle(s.team.parts.admin).borderRadius]), ['12px', '12px']);
  await page.locator('#host-css').fill(':host { border-radius: 30px; position: fixed; }');
  await page.locator('#apply-css').click();
  assert.match(await page.locator('#inspector-result').textContent(), /valid/);
  assert.equal(await inspect(s => getComputedStyle(s.team.parts.member).borderRadius), '12px');
  await page.locator('[data-tab=html]').click();
  await page.waitForFunction(() => document.querySelector('arc-showcase').$('#source-code code').textContent.includes('<template>'));
  assert.equal(await page.locator('arc-member-card').getAttribute('xray'), 'html');
  await page.locator('[data-tab=js]').click();
  await page.waitForFunction(() => document.querySelector('arc-showcase').$('#source-code code').textContent.includes('extends ProfileCard'));
  await page.locator('[data-tab=css]').click();
  await shot('inspector');
  console.log('PASS: live CSS inheritance, validated editor, actual HTML/JS source and x-ray');

  await page.locator('[data-mode=interface]').click(); await state('interface');
  await page.locator('arc-access-toolbar select').selectOption('jordan');
  // Interrupt before the visual transition finishes: actual action must survive.
  await page.locator('[data-mode=inspect]').click(); await state('inspecting');
  assert.equal(await page.locator('arc-member-card .name').textContent(), 'Jordan Park');
  await page.locator('[data-mode=interface]').click(); await state('interface');
  await page.locator('arc-access-toolbar button').click();
  await page.locator('#reset-demo').click(); await state('interface');
  await page.waitForTimeout(2000);
  assert.equal(await page.locator('arc-member-card .name').textContent(), 'Alex Lee');
  assert.equal(await page.locator('arc-member-card .status-label').textContent(), 'Pending');
  assert.equal(await inspect(s => s.presentation.state), 'interface');
  assert.equal(await inspect(s => getComputedStyle(s.team.parts.member).borderRadius), '18px');
  assert.equal(await page.locator('.connections path').count(), 0);
  // Repeated input cancels old timelines; Cocoon replay storage stays bounded.
  await inspect(s => { for (let i = 0; i < 15; i++) s.presentation.play('approve', s.team.parts.toolbar.person); s.presentation.setMode('explore'); });
  await state('explore');
  assert.equal(await inspect(s => [...s.session.topics].every(topic => (globalThis._eventObjects.get(topic)?.size || 0) <= 1)), true);
  console.log('PASS: interrupted actions, reset cancellation, repeated playback, bounded replay');

  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator('[data-mode=interface]').click(); await state('interface');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await shot(`assembled-${width}`);
    await page.locator('[data-mode=inspect]').click(); await state('inspecting');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('[data-color="#282041"]').click();
    await shot(`inspector-${width}`);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#reset-demo').click(); await state('interface');
  await page.locator('arc-access-toolbar button').click(); await state('interface');
  assert.match(await page.locator('arc-member-card .status-label').textContent(), /Alex approved/);
  console.log('PASS: mobile/tablet layouts, inspector controls and reduced motion');

  const oldPrefix = await inspect(s => s.session.prefix);
  await inspect(s => { const parent = s.parentElement; s.remove(); parent.append(s); });
  await page.waitForFunction(oldPrefix => { const s = document.querySelector('arc-showcase'); return s.session?.prefix !== oldPrefix && !!s.presentation && s.team?.parts?.member?.session === s.session; }, oldPrefix);
  await inspect(s => s.ready);
  assert.equal(await page.evaluate(prefix => [...globalThis._eventObjects.keys()].some(key => key.startsWith(prefix)), oldPrefix), false);
  // A second instance has independent signals and its own editable base skin.
  await page.evaluate(async () => {
    const second = document.createElement('arc-showcase');
    second.id = 'second-stage';
    document.querySelector('#showcase').append(second);
    await second.ready;
    const first = document.querySelector('arc-showcase');
    first.skin.set('border-radius', '35px');
    first.presentation.play('approve', first.team.parts.toolbar.person);
  });
  assert.equal(await page.locator('#second-stage').evaluate(s => getComputedStyle(s.team.parts.member).borderRadius), '18px');
  assert.equal(await page.locator('#second-stage').evaluate(s => s.team.parts.member.$('.status-label').textContent), 'Pending');
  await page.locator('#second-stage').evaluate(s => s.remove());
  assert.deepEqual(errors, []);
  console.log(`PASS: remount cleanup, multiple-instance isolation; no browser errors or failed local requests\nScreenshots: ${artifacts}`);
} catch (error) { await page.screenshot({ path: `${artifacts}/failure.png`, fullPage: true }); console.error('Browser errors:', errors); throw error; }
finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
