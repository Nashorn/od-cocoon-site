import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime=await readFile(new URL('../../vendor/cocoon/framework.src.js',import.meta.url),'utf8');
const example=await readFile('/Users/jasonsmith/Development/Arc2D/src/ui/components/MessageBar/index.html','utf8');
const syntaxDoc=await readFile(new URL('../api/template-syntax.md',import.meta.url),'utf8');
const sampleController=syntaxDoc.match(/```javascript\n([\s\S]*?)```/)[1];
const sampleTemplate=syntaxDoc.split('`src/components/CountryPicker/index.html`:')[1].match(/```html\n([\s\S]*?)```/)[1];
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__language_docs__/**',route=>{
 const path=new URL(route.request().url()).pathname;
 if(path.endsWith('/kernel.js'))return route.fulfill({contentType:'text/javascript',body:runtime});
 if(path.endsWith('/components/CountryPicker/index.html'))return route.fulfill({contentType:'text/html',body:sampleTemplate});
 if(path.endsWith('.css'))return route.fulfill({contentType:'text/css',body:':host {display:block}'});
 return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" data-sandbox="false"></script></head><body></body></html>'});
 });
 await page.goto('http://127.0.0.1:8081/__language_docs__/index.html');
 const result=await page.evaluate(async ({example,sampleController})=>{
 const checks=[];const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+': '+JSON.stringify({actual,expected}));checks.push({name,actual});};
 const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timeout '+fn);};
 const Demo=namespace `languageprobe`(class MessageBar extends Component{
 static skin=null;inShadow(){return true;}async hello(){return '<strong>Hello</strong>';}
 get countries(){return this._countries;}
 async onConnected(){this._countries=[{name:'United States'},{name:'Canada'},{name:'Afghanistan'},{name:'Albania'}];await super.onConnected({testing:123});}
 html(){return example;}
 });
 const c=new Demo;document.body.appendChild(c);await wait(()=>c.hasAttribute('namespace'));
 check('actual Arc2D template async method',c.root.querySelector('strong').textContent,'Hello');
 check('actual Arc2D template count',c.root.querySelector('b').textContent,'4 countries');
 check('actual Arc2D template conditional option',c.root.querySelector('select > option').textContent.trim(),'Select from 4 Countries');
 check('actual Arc2D template mapped options',c.root.querySelectorAll('optgroup option').length,4);
 check('actual Arc2D template selected option',c.root.querySelector('option[selected]').value,'United States');
 const engine=c.getTemplateEngine();const parse=async (str,data={})=>(await engine.parse('<template>'+str+'</template>',data,c)).fragment;
 check('multi statement loop', (await parse('<% let out=""; for (let i=0;i<3;i++) { out += `<b>${i}</b>`; } return out; %>')).querySelectorAll('b').length,3);
 check('conditional empty branch',(await parse('<% if(this.visible) return "<b>yes</b>"; return ""; %>',{visible:false})).textContent,'');
 check('independent block scopes',(await parse('<% const local="A"; return local; %><% return typeof local; %>')).textContent,'Aundefined');
 check('missing return prints undefined',(await parse('<% const local=1; %>')).textContent,'undefined');
 check('native interpolation',(await parse('<b>${this.message}</b>',{message:'native'})).textContent,'native');
 check('unjoined array inserts commas',(await parse('<%= ["A","B"] %>')).textContent,'A,B');
 check('awaited Promise.all rows',(await parse('<% const rows=await Promise.all(this.items.map(async n=>`<i>${await Promise.resolve(n*2)}</i>`)); return rows.join(""); %>',{items:[2,3]})).textContent,'46');
 check('async without await interpolates promise',(await parse('<%= this.hello() %>')).textContent,'[object Promise]');
 const events=[];const data={first:async()=>{events.push('first');return 'A';},second:async()=>{events.push('second');return 'B';}};
 check('multiple awaited blocks',(await parse('<%= await this.first() %><%= await this.second() %>',data)).textContent,'AB');check('await blocks sequential',events,['first','second']);
 const conditional=await parse('<input type="checkbox" <%= this.checked ? "checked" : "" %> >',{checked:false});check('conditional boolean attribute',conditional.querySelector('input')?.checked,false);
 const isName='language-span';
 const Builtin=namespace `languageprobe`(class CustomSpan extends HTMLSpanElement.with(IHtmlComponent){static tag='language-span';static extends='span';static skin=null;inShadow(){return true;}html(){return '<template><b>span content</b><slot></slot></template>';}async onConnected(data){await super.onConnected(data);this.on('click',()=>{this.clickCount=(this.clickCount||0)+1;});}});
 const markup=document.createElement('div');markup.innerHTML='<span is="language-span">slotted</span>';document.body.appendChild(markup);const span=markup.firstElementChild;await wait(()=>span.hasAttribute('namespace'));
 check('customized span native type',span instanceof HTMLSpanElement,true);check('customized span cocoon class',span instanceof Builtin,true);check('customized span shadow template',span.shadowRoot.querySelector('b').textContent,'span content');span.click();check('customized span listener',span.clickCount,1);
 const programmatic=document.createElement('span',{is:isName});document.body.appendChild(programmatic);await wait(()=>programmatic.hasAttribute('namespace'));check('programmatic is creation',programmatic instanceof Builtin,true);
 const wrong=document.createElement(isName);check('autonomous spelling not equivalent',wrong instanceof Builtin,false);
 const tooLate=document.createElement('span');tooLate.setAttribute('is',isName);document.body.appendChild(tooLate);check('setting is afterward not upgrade',tooLate instanceof Builtin,false);
 const Button=namespace `languageprobe`(class ActionButton extends HTMLButtonElement.with(IHtmlComponent){static tag='language-button';static extends='button';static inline=true;static skin=null;});
 const button=document.createElement('button',{is:'language-button'});button.textContent='Save';button.disabled=true;document.body.appendChild(button);await wait(()=>button.hasAttribute('namespace'));check('native button preserved',[button instanceof HTMLButtonElement,button.textContent,button.disabled],[true,'Save',true]);
 (0,eval)(sampleController);
 const published=new components.CountryPicker;document.body.appendChild(published);await wait(()=>published.hasAttribute('namespace'));
 check('documented CountryPicker async heading',published.root.querySelector('h2').textContent,'Choose a destination');
 check('documented CountryPicker selected code',published.root.querySelector('select').value,'US');
 check('documented CountryPicker option count',published.root.querySelectorAll('optgroup option').length,4);
 const adjacent=(await parse('<input type="checkbox" <%= this.checked ? "checked" : "" %>>',{checked:false}));check('adjacent close delimiter consumes tag bracket',adjacent.querySelector('input'),null);
 return checks;
 },{example,sampleController});
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:result.length,checks:result},null,2));
}finally{await browser.close();}
