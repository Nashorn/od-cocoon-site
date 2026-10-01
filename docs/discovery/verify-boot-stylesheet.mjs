import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime = await readFile(new URL('../../vendor/cocoon/framework.src.js', import.meta.url), 'utf8');
const origin = process.env.COCOON_TEST_URL || 'http://127.0.0.1:8081';
const browser = await chromium.launch({channel:'chrome',headless:true});
let allowController, allowSheet;
const controllerGate = new Promise(resolve=>{allowController=resolve;});
const sheetGate = new Promise(resolve=>{allowSheet=resolve;});
try {
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__boot_docs__/**',async route=>{
  const path=new URL(route.request().url()).pathname;
  if(path.endsWith('/kernel.js'))return route.fulfill({contentType:'text/javascript',body:runtime});
  if(path==='/__boot_docs__/index.html')return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" data-src-path="/src/" data-namespace="docsboot.App" data-controller="index.js" data-adopted-stylesheet="index.css" data-sandbox="false"></script></head><body></body></html>`});
  if(path==='/__boot_docs__/src/docsboot/App/index.css'){await sheetGate;return route.fulfill({contentType:'text/css',body:'.shared { color: rgb(12, 34, 56); }'});}
  if(path==='/__boot_docs__/src/docsboot/App/index.js'){await controllerGate;return route.fulfill({contentType:'text/javascript',body:'namespace `docsboot` (class App extends Application {async onConnected(data){await super.onConnected(data);window.appComplete=true;}});'});}
  return route.fulfill({status:404,body:'Not found'});
 });
 await page.goto(origin+'/__boot_docs__/index.html',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{
  namespace `docsboot`(class SharedCard extends Component {
   static skin=null;
   inShadow(){return true;}
   html(){return '<template><span class="shared">Shared</span></template>';}
   shouldAdoptDocumentStyleSheets(){return '/docsboot/App/index.css';}
  });
  window.earlyCard=new docsboot.SharedCard;document.body.appendChild(earlyCard);
 });
 await page.waitForFunction(()=>earlyCard.hasAttribute('namespace'));
 allowSheet();
 await page.waitForFunction(()=>document.adoptedStyleSheets.some(s=>s.url?.endsWith('/docsboot/App/index.css')) && earlyCard.root.adoptedStyleSheets.length===1);
 const before=await page.evaluate(()=>({appAbsent:!window.application,color:getComputedStyle(earlyCard.querySelector('.shared')).color}));
 assert.equal(before.appAbsent,true);assert.equal(before.color,'rgb(12, 34, 56)');
 allowController();await page.waitForFunction(()=>window.appComplete);
 await page.evaluate(()=>{window.lateCard=new docsboot.SharedCard;document.body.appendChild(lateCard);});
 await page.waitForFunction(()=>lateCard.hasAttribute('namespace'));
 const result=await page.evaluate(()=>{
 const matching=document.adoptedStyleSheets.filter(s=>s.url?.endsWith('/docsboot/App/index.css'));return {documentCopies:matching.length,sameObject:earlyCard.root.adoptedStyleSheets[0]===matching[0]&&lateCard.root.adoptedStyleSheets[0]===matching[0],lateColor:getComputedStyle(lateCard.querySelector('.shared')).color,url:matching[0].url};
 });
 assert.equal(result.documentCopies,1);assert.equal(result.sameObject,true);assert.equal(result.lateColor,'rgb(12, 34, 56)');assert.deepEqual(errors,[]);
 console.log(JSON.stringify({beforeController:before,afterController:result},null,2));
} finally { allowController();allowSheet();await browser.close(); }
