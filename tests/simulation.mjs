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
  await context.addInitScript(() => { try { localStorage.setItem('cocoon.analytics-consent.v1',JSON.stringify({choice:'denied',expires:Date.now()+86400000})); } catch {} });
  await host.goto(base,{waitUntil:'networkidle'});
  assert.equal(await host.locator('#simulation-frame').getAttribute('src'),null,'simulation must remain lazy above section');
  await host.locator('nav a[href="#simulation"]').click();
  const frame=host.locator('#simulation-frame').contentFrame();
  await frame.locator('arc-flocking-field canvas').waitFor({timeout:20000});
  await host.waitForFunction(() => document.querySelector('#simulation-frame').classList.contains('ready'),null,{timeout:20000});
  page=host.frames().find(f=>f.url().includes('/simulation/index.html'));
  await page.waitForFunction(()=>document.querySelector('arc-simulation')?.field?.fps>0);
  const shell=page.locator('arc-simulation');
  await shell.locator('#fps-limit').fill('15');
  assert.equal(await page.evaluate(()=>Math.round(MainLoop.getMaxAllowedFPS())),15);
  assert.equal(await page.evaluate(()=>MainLoop.getSimulationTimestep()),1000/60);
  // Observe actual World draws, not just the slider label or loop setting.
  const draws=await shell.evaluate(async el=>{
    const field=el.field, original=field.onDraw;
    const times=[];
    field.onDraw=function(...args){times.push(performance.now());return original.apply(this,args);};
    await new Promise(resolve=>setTimeout(resolve,1200));
    field.onDraw=original;
    return times.length;
  });
  assert.ok(draws>0 && draws<=19, `15 FPS cap rendered ${draws} frames in 1.2s`);
  await shell.locator('#fps-limit').fill('30');
  assert.equal(await page.evaluate(()=>Math.round(MainLoop.getMaxAllowedFPS())),30);
  await shell.locator('#pause').click();
  assert.equal(await page.evaluate(()=>MainLoop.isRunning()),false);
  const firstSample=await shell.evaluate(el=>{
    const field=el.field;field.frames=0;field.lastMeter=0;
    for(let i=0;i<=42;i++)field.onUpdate(1000+i*(1000/60));
    return field.fps;
  });
  assert.equal(firstSample,60,'first reading counts elapsed frame intervals');
  const positions=await shell.evaluate(el=>el.field.model.birds.map(b=>[b.x,b.y]));
  await host.waitForTimeout(150);
  assert.deepEqual(await shell.evaluate(el=>el.field.model.birds.map(b=>[b.x,b.y])),positions);
  await shell.locator('#agents').fill('700');
  assert.equal(await shell.evaluate(el=>el.field.model.birds.length),700);
  assert.equal(await shell.locator('#speed').isVisible(),false);
  assert.equal(await shell.evaluate(el=>el.field.model.speed),1);
  await shell.locator('[data-mode="repel"]').click();
  assert.equal(await shell.evaluate(el=>el.field.mode),'repel');
  await shell.locator('#obstacles').click();
  assert.equal(await shell.evaluate(el=>el.field.model.obstaclesEnabled),false);
  await shell.locator('#reset').click();
  assert.equal(await shell.evaluate(el=>el.field.model.birds.length),400);
  assert.equal(await page.evaluate(()=>MainLoop.getMaxAllowedFPS()),Infinity);
  assert.equal(await shell.locator('#fps-limit-value').textContent(),'Max');
  await shell.locator('#pause').click();
  await page.waitForFunction(()=>MainLoop.isRunning());
  await shell.locator('#view-source').click();
  await shell.locator('.source-view').waitFor();
  const explorer=shell.locator('#source-explorer');
  const source=explorer.locator('.code');
  assert.ok((await source.textContent()).includes('extends World'));
  assert.equal(await source.getAttribute('contenteditable'),'false');
  assert.equal(await source.evaluate(el=>getComputedStyle(el).userSelect),'text');
  const files=await explorer.evaluate(el=>el.getFiles());
  await source.focus();await source.press('KeyX');await source.press('Backspace');
  assert.deepEqual(await explorer.evaluate(el=>el.getFiles()),files);
  assert.equal(await explorer.getByRole('button',{name:'New file',exact:true}).isVisible(),false);
  await explorer.locator('[data-path="src/examples/flocking/Steering.js"]').click();
  assert.ok((await source.textContent()).includes('class Steering'));
  await explorer.locator('[data-path="src/examples/flocking/Steering.js"]').click({button:'right'});
  assert.equal(await explorer.locator('.ctx').isVisible(),false);
  await source.evaluate(el=>{
    const transfer=new DataTransfer();transfer.items.add(new File(['changed'],'injected.js',{type:'text/javascript'}));
    el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}));
  });
  assert.deepEqual(await explorer.evaluate(el=>el.getFiles()),files);
  await shell.screenshot({path:artifacts+'/flocking-source.png'});
  assert.equal(await page.evaluate(()=>MainLoop.isRunning()),false);
  await shell.locator('#close-source').click();
  await page.waitForFunction(()=>MainLoop.isRunning());
  await shell.screenshot({path:artifacts+'/flocking-desktop.png'});
  await host.locator('nav a[href="#top"]').click();
  await host.waitForTimeout(700);
  assert.equal(await page.evaluate(()=>MainLoop.isRunning()),false,'offscreen loop stops');
  await host.setViewportSize({width:390,height:844});
  await host.locator('nav a[href="#simulation"]').click();
  await page.waitForFunction(()=>MainLoop.isRunning());
  await shell.screenshot({path:artifacts+'/flocking-mobile.png'});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile fits iframe');
  assert.ok(await host.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile fits landing');
  await shell.screenshot({path:artifacts+'/flocking-mobile.png'});
  const canvas=shell.locator('canvas');
  await canvas.focus();
  await canvas.press('ArrowRight');
  assert.equal(await shell.evaluate(el=>el.field.model.pointer.active),true);
  await canvas.press('Escape');
  assert.equal(await shell.evaluate(el=>el.field.model.pointer.active),false);
  const downloadPromise=host.waitForEvent('download');
  await shell.locator('#download').click();
  const download=await downloadPromise;
  await download.saveAs(artifacts+'/flocking.zip');
  assert.equal(download.suggestedFilename(),'cocoon-flocking-worlds.zip');
  const {execFileSync} = await import('node:child_process');
  const {mkdtemp} = await import('node:fs/promises');
  const folder=await mkdtemp('/tmp/cocoon-flocking-export-');
  execFileSync('unzip',['-q',artifacts+'/flocking.zip','-d',folder]);
  const appRoot=resolve(folder,'flocking-worlds');
  const exported=createServer(async(req,res)=>{
    const pathname=new URL(req.url,'http://localhost').pathname;
    const file=resolve(appRoot,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(appRoot+'/')){res.writeHead(403).end();return;}
    try{res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/json'}).end(await readFile(file));}
    catch{res.writeHead(404).end();}
  });
  await new Promise(resolve=>exported.listen(0,'127.0.0.1',resolve));
  const exportURL='http://127.0.0.1:'+exported.address().port;
  try {
    const offline=await browser.newContext({reducedMotion:'reduce',hasTouch:true,viewport:{width:390,height:844}});
    const demo=await offline.newPage();
    const failures=[],external=[];
    await offline.route('**/*',route=>{
      if(route.request().url().startsWith(exportURL)) return route.continue();
      external.push(route.request().url());return route.abort();
    });
    demo.on('pageerror',error=>failures.push(error.message));
    demo.on('response',response=>{if(response.status()>=400)failures.push(response.url());});
    await demo.goto(exportURL,{waitUntil:'networkidle'});
    await demo.waitForFunction(()=>window.application?.field?.model);
    assert.equal(await demo.evaluate(()=>MainLoop.isRunning()),false,'reduced motion starts paused');
    await demo.locator('#pause').click();
    await demo.waitForFunction(()=>MainLoop.isRunning());
    const bounds=await demo.locator('canvas').boundingBox();
    const cdp=await offline.newCDPSession(demo);
    const point={x:bounds.x+bounds.width/2,y:bounds.y+bounds.height/2};
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
    assert.equal(await demo.locator('arc-flocking-field').evaluate(el=>el.model.pointer.active),true,'touch controls the field');
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.equal(await demo.locator('arc-flocking-field').evaluate(el=>el.model.pointer.active),false);
    await demo.waitForFunction(()=>window.application.field.fps>0);
    assert.deepEqual(external,[]);assert.deepEqual(failures,[]);
    await offline.close();
    console.log('PASS: extracted ZIP runs without external requests; reduced motion, resume and touch input');
  } finally {exported.close();}
  assert.deepEqual(errors,[]);
  console.log('PASS: lazy World boot, live FPS, controls, pause, source, offscreen stop, mobile and ZIP download');
} catch(error) {console.log('BROWSER ERRORS',errors);throw error;}
finally { await browser.close(); server.close(); }
