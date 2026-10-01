import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { chromium } from 'playwright';
import { renderTile } from '../parallel/raytracer-proof/renderer.js';

// Sampling must be independent of worker scheduling and tile boundaries.
const job={x:0,y:0,width:16,height:12,imageWidth:16,imageHeight:12,samples:8,depth:5};
const whole=new Float32Array(renderTile(job).pixels);
assert.ok(whole.every(Number.isFinite));
assert.deepEqual(new Float32Array(renderTile(job).pixels),whole);
for(let y=0;y<12;y+=4)for(let x=0;x<16;x+=4){
  const tile=new Float32Array(renderTile({...job,x,y,width:4,height:4}).pixels);
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)for(let c=0;c<3;c++){
    assert.equal(tile[(row*4+col)*3+c],whole[((y+row)*16+x+col)*3+c]);
  }
}
const first=new Float32Array(renderTile({...job,samples:4}).pixels);
const second=new Float32Array(renderTile({...job,samples:4,sampleStart:4}).pixels);
whole.forEach((v,i)=>assert.ok(Math.abs(v-first[i]-second[i])<0.0001,'progressive sums agree'));

const root=resolve('.');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
  const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(!path.startsWith(root+'/')){res.writeHead(403).end();return;}
  try{res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/json'}).end(await readFile(path));}
  catch{res.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
const base=`http://127.0.0.1:${server.address().port}`;
const artifacts=process.env.RAY_ARTIFACTS||'/tmp/cocoon-raytracer-proof';
await mkdir(artifacts,{recursive:true});
const browser=await chromium.launch({channel:'chrome'});
const errors=[],external=[];
const context=await browser.newContext({viewport:{width:1600,height:1050}});
await context.route('**/*',route=>{
  if(route.request().url().startsWith(base))return route.continue();
  external.push(route.request().url());return route.abort();
});
const page=await context.newPage();
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
const finished=()=>page.waitForFunction(()=>window.rayStudio?.result||window.rayStudio?.error,null,{timeout:120000});
try{
  await page.goto(base+'/parallel/raytracer-proof/index.html');
  await finished();
  const studio=await page.evaluate(()=>({result:rayStudio.result,error:rayStudio.error,pool:rayStudio.pool}));
  assert.equal(studio.error,null);
  assert.equal(studio.result.samples,96);
  assert.equal(studio.pool,null,'workers are released after rendering');
  assert.ok(studio.result.worstFrame<250,`responsive heartbeat: ${studio.result.worstFrame} ms`);
  await page.waitForTimeout(350);
  await page.screenshot({path:artifacts+'/desktop.png',fullPage:true});
  await page.locator('#scene').screenshot({path:artifacts+'/scene.png'});

  // The serialized worker function must match the direct function, including transfers.
  const workerPixels=await page.evaluate(async job=>{
    const {renderTile}=await import('./renderer.js');
    const pool=new core.lang.ThreadPool(renderTile,2);
    try{return Array.from(new Float32Array((await pool.run(job)).pixels));}
    finally{pool.terminate();}
  },job);
  assert.deepEqual(workerPixels,Array.from(whole));

  await page.locator('#quality').selectOption('256');
  await page.waitForFunction(()=>rayStudio.running&&rayStudio.started);
  await page.locator('#stop').click();
  assert.equal(await page.evaluate(()=>rayStudio.pool),null);
  assert.equal(await page.evaluate(()=>rayStudio.running),false);
  const stopped=await page.locator('#scene').evaluate(c=>c.toDataURL());
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),stopped,'cancelled workers cannot paint stale tiles');
  await page.locator('#quality').selectOption('24');
  await finished();
  assert.equal(await page.evaluate(()=>rayStudio.result.samples),24);
  const checksum=await page.locator('#scene').evaluate(c=>c.toDataURL());
  await page.locator('#render').click();
  await finished();
  assert.equal(await page.locator('#scene').evaluate(c=>c.toDataURL()),checksum,'repeat render is deterministic');

  await page.setViewportSize({width:390,height:844});
  await page.reload();
  await finished();
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'mobile fits');
  await page.waitForTimeout(350);
  await page.screenshot({path:artifacts+'/mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  assert.deepEqual(external,[],'proof renders entirely from local files');
  console.log('PASS: deterministic tiles and progressive sampling; Cocoon worker parity; desktop rendering and responsiveness; cancellation without stale paint; quality changes; repeat render; mobile fit; no external requests or browser errors.');
  console.log(JSON.stringify(studio.result,null,2));
  console.log(`Screenshots: ${artifacts}`);
}finally{await browser.close();server.close();}
