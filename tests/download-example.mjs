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
  await host.goto(base, {waitUntil: 'networkidle'});
  const frame = host.frames().find(f => f.url().includes('/showcase/'));
  await frame.locator('arc-showcase[ready]').waitFor();
  await frame.locator('#try-flow').click();
  await frame.locator('.editor-workspace').waitFor({state:'visible'});
  await frame.locator('arc-showcase').evaluate(s => {
    const path = 'src/examples/team/TeamAccess/index.html';
    const text = s.workspace.editor.getFiles()[path];
    s.workspace.editor.setFiles({[path]:text.replace('Team access', 'Downloaded draft')});
  });
  await frame.locator('#close-editor').click();
  const downloadEvent = host.waitForEvent('download');
  await frame.locator('#download-example').click();
  const download = await downloadEvent;
  await download.saveAs('/tmp/cocoon-team-access.zip');
  const {execFileSync} = await import('node:child_process');
  const {mkdtemp} = await import('node:fs/promises');
  const tmp = await mkdtemp('/tmp/cocoon-export-');
  execFileSync('unzip', ['-q', '/tmp/cocoon-team-access.zip', '-d', tmp]);
  const appRoot = resolve(tmp, 'team-access');
  const exported = createServer(async (req, res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    try {
      const file = resolve(appRoot, '.' + (name === '/' ? '/index.html' : name));
      const body = await readFile(file);
      res.writeHead(200, {'Content-Type': mime[extname(file)] || 'application/json'}).end(body);
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(r => exported.listen(0, '127.0.0.1', r));
  const url = 'http://127.0.0.1:' + exported.address().port;
  try {
    const offline = await browser.newContext();
    const demo = await offline.newPage();
    const external = [], failures = [];
    await offline.route('**/*', route => {
      if (route.request().url().startsWith(url)) return route.continue();
      external.push(route.request().url()); return route.abort();
    });
    demo.on('pageerror', e => failures.push(e.message));
    demo.on('response', r => { if (r.status() >= 400) failures.push(r.url()); });
    await demo.goto(url);
    await demo.locator('arc-member-card .status-label').waitFor();
    await demo.locator('arc-access-toolbar select').selectOption('jordan');
    await demo.locator('arc-access-toolbar button').click();
    await demo.waitForFunction(() => document.querySelector('arc-team-access')
      .querySelector('arc-member-card').querySelector('.status-label').textContent.includes('approved'));
    assert.match(await demo.locator('arc-team-access .shell-header h3').textContent(), /Downloaded draft/);
    assert.equal(await demo.locator('arc-showcase').count(), 0);
    assert.deepEqual(external, []);
    assert.deepEqual(failures, []);
    await demo.screenshot({path:'/tmp/cocoon-export.png',fullPage:true});
    console.log('PASS: ZIP extracts; standalone app boots with external requests blocked; selection and approval work');
    await offline.close();
  } finally { exported.close(); }
} finally {
  await browser.close();
  server.close();
}
