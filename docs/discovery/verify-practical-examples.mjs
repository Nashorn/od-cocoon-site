import { readFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { Marked } from 'marked';
const docs = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFile(resolve(docs, name), 'utf8');
const blocks = (text, lang) => [...text.matchAll(new RegExp('```'+lang+'\\n([\\s\\S]*?)```', 'g'))].map(m => m[1]);
const markdown = new Marked();
async function checkDirectory(path) {
  for (const entry of await readdir(path, { withFileTypes: true })) {
    if (entry.name === 'discovery') continue; // Evidence includes historical, intentionally obsolete links.
    const file = resolve(path, entry.name);
    if (entry.isDirectory()) await checkDirectory(file);
    else if (entry.name.endsWith('.md')) {
      const text = await readFile(file, 'utf8');
      await markdown.parse(text);
      const links = [];
      markdown.walkTokens(markdown.lexer(text), token => {
        if (token.type === 'link' || token.type === 'image') links.push(token.href);
      });
      for (const href of links) {
        const target = href.split('#')[0];
        if (target && !/^(?:[a-z]+:|\/)/i.test(target)) await access(resolve(dirname(file), target));
      }
    }
  }
}
await checkDirectory(docs);
const runtime = await readFile(new URL('../../vendor/cocoon/framework.src.js', import.meta.url), 'utf8');
const eventCode = blocks(await read('api/events.md'), 'javascript').slice(0, 2).join('\n');
const searchCode = blocks(await read('api/watching-inputs.md'), 'javascript')[0];
const commentCode = blocks((await read('api/template-syntax.md')).split('## Example: display a customer comment as text')[1], 'javascript')[0];
const salesCode = blocks(await read('api/threading.md'), 'javascript')[0];
const app = await read('api/application.md');
const appJS = blocks(app, 'javascript');
const appHTML = blocks(app, 'html');
const appCSS = blocks(app, 'css');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
 const page = await browser.newPage();
 const errors = []; page.on('pageerror', e => errors.push(e.message));
 await page.route('http://docs.test/**', route => {
   const path = new URL(route.request().url()).pathname;
   const assets = {
    '/index.html': ['text/html', '<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="/kernel.js" data-kernel data-rootpath="./" data-sandbox="false"></script></head><body></body></html>'],
    '/kernel.js': ['text/javascript', runtime],
    '/application/index.html': ['text/html', appHTML[0]],
    '/application/node_modules/od-cocoon/framework.src.js': ['text/javascript', runtime],
    '/application/.importmap': ['application/json', blocks(app, 'json')[0]],
    '/application/src/applications/MyApplication/index.js': ['text/javascript', appJS[0]],
    '/application/src/components/Greeting/index.js': ['text/javascript', appJS[1]],
    '/application/src/components/Greeting/index.html': ['text/html', appHTML[1]],
    '/application/src/components/Greeting/index.css': ['text/css', appCSS[0]],
    '/application/src/applications/MyApplication/index.css': ['text/css', appCSS[1]],
   };
   const item = assets[path];
   return item ? route.fulfill({contentType:item[0],body:item[1]}) : route.fulfill({status:404,body:path});
 });
 await page.goto('http://docs.test/index.html');
 await page.waitForFunction(() => window.application && globalThis.Component);
 await page.addScriptTag({ content: eventCode+'\n'+searchCode+'\n'+commentCode });
 await page.evaluate(() => {
   for (const name of ['product-picker', 'basket-summary', 'contact-search', 'comment-preview']) document.body.appendChild(document.createElement(name));
 });
 await page.locator('product-picker button').click();
 assert.equal(await page.locator('basket-summary p').textContent(), 'Coffee: $12.00');
 await page.evaluate(() => document.body.appendChild(document.createElement('basket-summary')));
 await page.waitForFunction(() => [...document.querySelectorAll('basket-summary')].every(c => c.shadowRoot?.querySelector('p')?.textContent === 'Coffee: $12.00'));
 // A new subscriber sees all events, including duplicate selections, in order.
 assert.deepEqual(await page.evaluate(() => { const seen=[]; const publisher=document.querySelector('product-picker'); publisher.fire('docs:history',{id:1});publisher.fire('docs:history',{id:2});const stop=publisher.subscribe('docs:history',e=>seen.push(e.detail.id));stop();return seen;}), [1,2]);
 await page.locator('contact-search input').fill('grace');
 assert.equal(await page.locator('contact-search li').textContent(), 'Grace Hopper');
 await page.locator('contact-search input').fill('zzz');
 assert.equal(await page.locator('contact-search [role="status"]').textContent(), 'No contacts found.');
 await page.evaluate(async () => { await document.querySelector('contact-search').render(); await document.querySelector('product-picker').render(); });
 assert.equal(await page.locator('contact-search li').count(), 3);
 const cleanup = await page.evaluate(async () => {
  const picker=document.querySelector('product-picker');const old=picker.shadowRoot.querySelector('button');
  picker.remove(); await new Promise(r=>setTimeout(r,0));
  let calls=0;const stop=document.querySelector('basket-summary').subscribe('shop:selection',()=>calls++);const before=calls;old.click();const after=calls;
  document.body.appendChild(picker);await new Promise(r=>setTimeout(r,100));picker.shadowRoot.querySelector('button').click();stop();return {removed:after-before,reconnected:calls-after};
 });
 assert.deepEqual(cleanup,{removed:0,reconnected:1});
 assert.equal(await page.locator('comment-preview img').count(),0);
 assert.match(await page.locator('comment-preview p').textContent(),/^<img/);
 const sales = await page.evaluate(async code => { const result=[];const previous=console.log;console.log=value=>result.push(value);try{await new Function('return (async()=>{'+code+'})()')();}finally{console.log=previous;}return result;}, salesCode);
 assert.deepEqual(sales,[{Coffee:30,Tea:18}]);
 await page.goto('http://docs.test/application/index.html');
 await page.waitForFunction(() => document.querySelector('components-greeting')?.shadowRoot?.querySelector('h1'));
 assert.equal(await page.locator('components-greeting h1').textContent(),'Hello, Cocoon.');
 assert.equal(await page.locator('components-greeting h1').evaluate(n=>getComputedStyle(n).color),'rgb(95, 233, 189)');
 assert.deepEqual(errors,[]);
 console.log('Docs passed: Markdown/local file links, exact application files, signal replay and cleanup/reconnection, contact filtering/rerender, safe text, worker sales aggregation.');
} finally { await browser.close(); }
