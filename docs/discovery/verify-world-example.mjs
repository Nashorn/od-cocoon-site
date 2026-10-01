// Executes the three example files directly from the public World Markdown.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const doc=await readFile(new URL('../api/world.md',import.meta.url),'utf8');
const html=doc.match(/```html\n([\s\S]*?)```/)[1];
const js=doc.match(/```javascript\n([\s\S]*?)```/)[1];
const css=doc.match(/```css\n([\s\S]*?)```/)[1];
const kernel=await readFile(new URL('../../vendor/cocoon/framework.src.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__ball_docs__/**',route=>{
 const path=new URL(route.request().url()).pathname;
 if(path.endsWith('/framework.src.js'))return route.fulfill({contentType:'text/javascript',body:kernel});
 if(path.endsWith('/BouncingBall/index.js'))return route.fulfill({contentType:'text/javascript',body:js});
 if(path.endsWith('/BouncingBall/index.css'))return route.fulfill({contentType:'text/css',body:css});
 if(path==='/__ball_docs__/index.html')return route.fulfill({contentType:'text/html',body:html});
 return route.fulfill({status:404,body:'Unexpected request'});
 });
 await page.goto('http://127.0.0.1:8081/__ball_docs__/index.html');
 await page.waitForFunction(()=>window.world?.ball?.x>85&&world.isRunning());
 await page.click('#toggle');assert.equal(await page.locator('#toggle').textContent(),'Resume');
 const paused=await page.evaluate(()=>({...world.ball}));await page.waitForTimeout(100);assert.deepEqual(await page.evaluate(()=>({...world.ball})),paused);
 const collision=await page.evaluate(()=>{world.ball.x=623;world.ball.y=343;world.ball.vx=180;world.ball.vy=120;world.onFixedUpdate(1000/60);world.onDraw();return {x:world.ball.x,y:world.ball.y,vx:world.ball.vx,vy:world.ball.vy,pixel:[...world.context.getImageData(world.ball.x,world.ball.y,1,1).data]};});
 assert.deepEqual(collision,{x:624,y:344,vx:-180,vy:-120,pixel:[95,233,189,255]});
 await page.click('#toggle');await page.waitForFunction(()=>world.isRunning()&&world.ball.x<620);assert.equal(await page.locator('#toggle').textContent(),'Pause');
 await page.setViewportSize({width:375,height:700});assert.ok(await page.locator('canvas').evaluate(c=>c.getBoundingClientRect().right<=innerWidth));
 await page.evaluate(()=>world.onDisconnected());assert.equal(await page.evaluate(()=>world.isRunning()),false);assert.deepEqual(errors,[]);
 console.log('World Markdown example passed: startup, movement, pause/resume, both wall collisions, canvas pixel, mobile width, cleanup; no page errors.');
}finally{await browser.close();}
