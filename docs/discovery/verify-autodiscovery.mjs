import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime=await readFile(new URL('../../vendor/cocoon/framework.src.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
const origin=process.env.COCOON_TEST_URL||'http://127.0.0.1:8081';
const results=[];
try{
 for(const mode of ['default','disabled','ordered','error','missing','explicit']){
  const page=await browser.newPage();const requests=[];
  await page.route('**/__discovery_docs__/**',async route=>{
   const req=route.request(),path=new URL(req.url()).pathname;requests.push(req.method()+' '+path);
   if(path.endsWith('/kernel.js'))return route.fulfill({contentType:'text/javascript',body:runtime});
   if(path.endsWith('/index.html'))return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" ${mode==='disabled'?'data-sandbox="false"':mode==='ordered'||mode==='error'?'data-sandbox="first components"':''} ${mode==='explicit'?'data-namespace="apps.TestApp" data-controller="index.js"':''}></script></head><body><hello-world></hello-world></body></html>`});
   if(path.endsWith('/src/apps/TestApp/index.js'))return route.fulfill({contentType:'text/javascript',body:'namespace `apps` (class TestApp extends Application {static skin=null;async onConnected(data){await super.onConnected(data);window.testDone=true;}});'});
   if(path.includes('/first/'))return route.fulfill({status:mode==='error'?403:404,body:''});
   if(path.endsWith('/HelloWorld/index.js')&&mode!=='missing')return route.fulfill({contentType:'text/javascript',body:'namespace `components`(class HelloWorld extends Component {static tag="hello-world";static skin=null;html(){return "<template><span>ready</span></template>";}});'});
   if(path.endsWith('/LaterCard/index.js'))return route.fulfill({contentType:'text/javascript',body:'namespace `components`(class LaterCard extends Component {static tag="later-card";static skin=null;inShadow(){return true;}html(){return "<template><inner-card></inner-card></template>";}});'});
   if(path.endsWith('/InnerCard/index.js'))return route.fulfill({contentType:'text/javascript',body:'namespace `components`(class InnerCard extends Component {static tag="inner-card";static skin=null;html(){return "<template>nested</template>";}});'});
   return route.fulfill({status:404,body:''});
  });
  await page.goto(origin+'/__discovery_docs__/index.html');
  await page.waitForFunction(()=>window.application);
  if(mode==='default'||mode==='ordered'){
   await page.waitForFunction(()=>document.querySelector('hello-world')?.textContent==='ready');
   assert.equal(requests.filter(x=>x==='HEAD /__discovery_docs__/src/components/HelloWorld/index.js').length,1);
   if(mode==='ordered')assert.ok(requests.indexOf('HEAD /__discovery_docs__/src/first/HelloWorld/index.js')<requests.indexOf('HEAD /__discovery_docs__/src/components/HelloWorld/index.js'));
   if(mode==='default'){
    await page.evaluate(()=>document.body.appendChild(document.createElement('later-card')));
    await page.waitForFunction(()=>document.querySelector('later-card')?.shadowRoot?.querySelector('inner-card')?.textContent==='nested');
   }
  }else if(mode==='missing'){
   await page.waitForFunction(()=>Application.componentLoader.loads.has('hello-world'));
   await page.evaluate(()=>Application.componentLoader.loads.get('hello-world'));
   await page.evaluate(async()=>{const e=document.createElement('hello-world');document.body.appendChild(e);await Application.componentLoader.scan(document);});
   assert.equal(requests.filter(x=>x.includes('HEAD')&&x.includes('HelloWorld')).length,1);
  }else if(mode==='error'){
   await page.waitForFunction(()=>Application.componentLoader.loads.has('hello-world'));
   await page.evaluate(()=>Application.componentLoader.loads.get('hello-world').catch(()=>{}));
   assert.ok(!requests.some(x=>x.includes('/components/HelloWorld')));
  }else{
   if(mode==='explicit')await page.waitForFunction(()=>window.testDone);
   assert.ok(!requests.some(x=>x.includes('HelloWorld')));
  }
  results.push({mode,passed:true,headRequests:requests.filter(x=>x.startsWith('HEAD '))});await page.close();
 }
 console.log(JSON.stringify(results,null,2));
}finally{await browser.close();}
