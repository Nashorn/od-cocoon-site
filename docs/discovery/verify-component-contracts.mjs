// Run from the site checkout: node docs/discovery/verify-component-contracts.mjs
// Isolated routed fixtures use the real vendored kernel; no site files are served differently to other clients.
import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const origin = process.env.COCOON_TEST_URL || 'http://127.0.0.1:8081';
const runtime = await readFile(new URL('../../vendor/cocoon/framework.src.js', import.meta.url), 'utf8');
const browser = await chromium.launch({channel:'chrome', headless:true});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/__docs_probe__/**', async route => {
    const url = new URL(route.request().url());
    if(url.pathname.endsWith('/kernel.js')) return route.fulfill({contentType:'text/javascript',body:runtime});
    if(url.pathname.endsWith('/index.html') && url.pathname === '/__docs_probe__/index.html') return route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script></head><body></body></html>`});
    if(url.pathname.endsWith('.css')) return route.fulfill({contentType:'text/css',body:':host { --external: 1; }'});
    if(url.pathname.endsWith('.html')) return route.fulfill({contentType:'text/html',body:`<template><output data-file="${url.pathname}">file</output></template>`});
    return route.fulfill({status:404,body:'Not found'});
  });
  await page.goto(origin+'/__docs_probe__/index.html');
  await page.waitForFunction(()=>globalThis.Component && window.application);
  const results = await page.evaluate(async()=>{
    const results=[];
    const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+': '+JSON.stringify({actual,expected}));results.push({name,actual});};
    const wait=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timed out: '+fn);};
    const mount=async C=>{const c=new C;document.body.appendChild(c);await wait(()=>c.hasAttribute('namespace'));return c;};
    const Base=namespace `docsprobe`(class BaseCard extends Component { static skin=null; html(){return '<template><output>base</output></template>';} });
    const Child=namespace `docsprobe`(class ChildCard extends Base {});
    check('qualified tag',customElements.get('docsprobe-base-card')===Base,true);
    const Explicit=namespace `docsprobe`(class ExplicitCard extends Base {static tag='explicit-probe';});
    const Derived=namespace `docsprobe`(class DerivedCard extends Explicit {});
    check('explicit tag',customElements.get('explicit-probe')===Explicit,true);
    check('explicit tag not inherited',customElements.get('docsprobe-derived-card')===Derived,true);
    const child=await mount(Child);
    check('child gets its own conventional template',child.querySelector('output').dataset.file,'/__docs_probe__/src/docsprobe/ChildCard/index.html');
    const Inherited=namespace `docsprobe`(class InheritedCard extends Base {html(){return super.html();}});
    check('explicit template inheritance',(await mount(Inherited)).textContent,'base');
    const light=await mount(Base);check('default light root',light.root===light,true);check('default inShadow',light.inShadow(),false);
    const Shadow=namespace `docsprobe`(class ShadowCard extends Base {inShadow(){return true;}html(){return '<template><output class="inside">shadow</output><slot></slot></template>';}});
    const shadow=await mount(Shadow);const outside=document.createElement('span');outside.className='outside';shadow.appendChild(outside);
    check('shadow root',shadow.root===shadow.shadowRoot,true);
    check('query shadow first',shadow.querySelector('.inside').textContent,'shadow');
    check('query host fallback',shadow.querySelector('.outside')===outside,true);
    const Items=namespace `docsprobe`(class ItemsCard extends Base {html(){return '<template><span class="item">A</span></template>';}});
    const items=await mount(Items);check('findAll default partial timeout',(await items.findAll('.item',{scan_duration:20})).length,1);
    check('findAll returns array',Array.isArray(await items.findAll('.item',{expect:1})),true);
    check('find missing timeout',await items.find('.missing',300,20),null);
    const added=items.find('.later',300,200);const node=document.createElement('i');node.className='later';items.appendChild(node);check('find child mutation',await added===node,true);
    const trace=[];
    const Lifecycle=namespace `docsprobe`(class LifecycleCard extends Base {
      async onConnected(data){trace.push('before');await super.onConnected(data);trace.push('after');}
      html(){return '<template>lifecycle</template>';}
      onRendered(){trace.push('rendered');}
      onAwake(){trace.push('awake');}
      async onDisconnected(){trace.push('disconnected');}
      onSleep(){trace.push('sleep');}
    });
    const listener=e=>{if(e.target===document)trace.push('signal');};document.addEventListener('connected',listener);
    const life=await mount(Lifecycle);document.removeEventListener('connected',listener);
    check('connection ordering',trace,['before','rendered','awake','signal','after']);life.remove();await wait(()=>trace.includes('sleep'));check('disconnect ordering',trace.slice(-2),['disconnected','sleep']);
    const Data=namespace `docsprobe`(class DataCard extends Base {calls=0;html(){this.calls++;return '<template><output><%= this.message || "initial" %></output></template>';}});
    const data=await mount(Data);const firstData=data.data;const next={message:'next'};await data.render(next);check('render uses supplied data',data.textContent,'next');check('render does not save supplied data',data.data===firstData,true);check('template cached',Object.hasOwn(next,'calls'),false);check('render data prototype',Object.getPrototypeOf(next)===data,true);
    const Inline=namespace `docsprobe`(class InlineCard extends Base {static inline=true;html(){throw Error('inline loaded template');}});
    const inline=new Inline;inline.textContent='preserved';document.body.appendChild(inline);await wait(()=>inline.hasAttribute('namespace'));check('inline preserves content',inline.textContent,'preserved');
    const StylesBase=namespace `docsprobe`(class StylesBase extends Component {html(){return '<template>styles</template>';}inShadow(){return true;}css(){return ':host { --inline-base: 1; }';}});
    const StylesChild=namespace `docsprobe`(class StylesChild extends StylesBase {styles=['extra.css'];html(){return super.html();}css(){return ':host { --inline-child: 1; }';}});
    const styled=await mount(StylesChild);
    const describe=s=>s.cssRules[0]?.cssText.includes('--inline-base')?'base-inline':s.cssRules[0]?.cssText.includes('--inline-child')?'child-inline':s.url?.endsWith('extra.css')?'extra':s.constructor.name;
    check('stylesheet order',styled.root.adoptedStyleSheets.map(describe),['StylesBase','base-inline','StylesChild','child-inline','extra']);
    const Disable=namespace `docsprobe`(class DisabledSkin extends StylesBase {static skin=null;html(){return super.html();}css(){return ':host {--disabled-inline:1}';}});
    const disabled=await mount(Disable);check('skin null skips own inline too',disabled.root.adoptedStyleSheets.some(s=>s.cssRules[0]?.cssText.includes('--disabled-inline')),false);check('skin null retains parent css',disabled.root.adoptedStyleSheets.length,2);
    const FieldCss=namespace `docsprobe`(class FieldCssCard extends Base {css=()=>':host {--field:1}';hasOwnSkin(){return true;}html(){return super.html();}});
    const field=await mount(FieldCss);check('instance css field is not collected',field.stylesheets.some(s=>s.cssRules?.[0]?.cssText.includes('--field:')),false);
    const late=new CSSStyleSheet;late.replaceSync(':host {--late:1}');check('add return',styled.stylesheets.add(late),undefined);await wait(()=>styled.root.adoptedStyleSheets.includes(late));check('late add prepends',styled.root.adoptedStyleSheets[0]===late,true);
    const count=styled.root.adoptedStyleSheets.length;styled.stylesheets.add(late);check('add identity dedup',styled.root.adoptedStyleSheets.length,count);
    const shared=new CSSStyleSheet;shared.replaceSync(':host {--shared:1}');shared.url='/tokens.css';document.adoptedStyleSheets.push(shared);application.fire('stylesheet:adopted',{sheet:shared});
    const Adopt=namespace `docsprobe`(class AdoptCard extends Shadow {html(){return super.html();}shouldAdoptDocumentStyleSheets(){return ['tokens.css'];}});
    const adopt=await mount(Adopt);check('document sheet replay',adopt.root.adoptedStyleSheets[0]===shared,true);
    const quiet=new CSSStyleSheet;quiet.replaceSync(':host{--quiet:1}');document.adoptedStyleSheets.push(quiet);check('unannounced document sheet not adopted',adopt.root.adoptedStyleSheets.includes(quiet),false);
    const key='docs:replay';light.fire(key,{n:1});light.fire(key,{n:2});const seen=[];const unsub=light.subscribe(key,e=>seen.push(e.detail.n));light.fire(key,{n:3});unsub();light.fire(key,{n:4});check('replay and unsubscribe',seen,[1,2,3]);
    check('dispatch returns event',light.dispatchEvent('probe') instanceof CustomEvent,true);
    const flat={bubbles:false,n:1};const flatEvent=light.dispatchEvent('flat',flat);check('flat event flag removed',[flatEvent.bubbles,'bubbles' in flat],[true,false]);
    const nestedEvent=light.dispatchEvent('nested',{detail:{n:2},bubbles:false});check('nested event flags honored',nestedEvent.bubbles,false);
    let clicks=0,matched=null;shadow.on('click',e=>{clicks++;matched=e.matchedTarget;},false,'.inside');shadow.querySelector('.inside').click();check('delegation matched target',[clicks,matched===shadow.querySelector('.inside')],[1,true]);
    const input=document.createElement('input');light.appendChild(input);const watched=[];const handle=light.watch(input,'value',e=>watched.push([e.old,e.value]));input.value='new';input.dispatchEvent(new Event('input'));handle.unwatch();input.value='ignored';input.dispatchEvent(new Event('input'));check('watch initial falsy and unchanged old',watched,[['',null],['','new']]);
    const plain={count:0};let plainCalls=0;light.watch(plain,'count',()=>plainCalls++);plain.count=1;check('watch is not arbitrary property reactivity',plainCalls,1);
    const appended=document.createElement('b');check('append resolves node',await light.append(appended)===appended,true);
    check('rect center',typeof light.getBoundingClientRect().center.x,'number');
    // Declarative roots are created by the HTML parser before component registration.
    const dsd=document.createElement('div');dsd.setHTMLUnsafe('<docsprobe-declarative-card><template shadowrootmode="open"><output>declarative</output></template></docsprobe-declarative-card>');document.body.appendChild(dsd);
    namespace `docsprobe`(class DeclarativeCard extends Base {html(){throw Error('declarative should preserve markup');}});
    const declarative=dsd.firstElementChild;await wait(()=>declarative.hasAttribute('namespace'));check('declarative existing root preserved',declarative.root.textContent,'declarative');
    const dynamic=document.createElement('div');dynamic.setHTMLUnsafe('<docsprobe-declarative-dynamic><template shadowrootmode="open"><output><%= "existing" %></output></template></docsprobe-declarative-dynamic>');document.body.appendChild(dynamic);
    namespace `docsprobe`(class DeclarativeDynamic extends Base {static declarative=false;html(){return '<template>external</template>';}});
    const dynamicCard=dynamic.firstElementChild;await wait(()=>dynamicCard.hasAttribute('namespace'));check('declarative dynamic branch precedes declarative false',dynamicCard.root.textContent,'existing');

    const attrWait=items.find('.attribute-only',300,25);node.className='attribute-only';check('attribute-only change does not wake find',await attrWait,null);
    let manualCalls=0;const forcedOff=light.watch(input,'value',()=>manualCalls++,false);check('watch force false',manualCalls,0);forcedOff.unwatch();
    check('watch absent target',light.watch('.does-not-exist','value',()=>{}),undefined);
    const Dark=namespace `docsprobe`(class DarkCard extends Component {static skin='dark';inShadow(){return true;}});
    const dark=await mount(Dark);check('named skin html path',dark.querySelector('output').dataset.file,'/__docs_probe__/src/docsprobe/DarkCard/skins/dark/index.html');check('getSkin',dark.getSkin(),{name:'dark',path:'skins/dark/'});
    const noCss=namespace `docsprobe`(class NoInlineCss extends StylesChild {static csstext=false;html(){return super.html();}});
    const noInline=await mount(noCss);check('csstext false suppresses ancestry inline',noInline.root.adoptedStyleSheets.some(s=>s.cssRules[0]?.cssText.includes('--inline-')),false);
    const ownTemplate=namespace `docsprobe`(class OwnTemplateCard extends Base {template='<template>instance provider</template>';});
    check('own instance template precedes html',(await mount(ownTemplate)).textContent,'instance provider');
    const staticDsd=document.createElement('div');staticDsd.setHTMLUnsafe('<docsprobe-own-declarative><template shadowrootmode="open">static old</template></docsprobe-own-declarative>');document.body.appendChild(staticDsd);
    namespace `docsprobe`(class OwnDeclarative extends Base {static declarative=false;html(){return '<template>own new</template>';}});
    await wait(()=>staticDsd.firstElementChild.hasAttribute('namespace'));check('declarative false replaces static content',staticDsd.firstElementChild.root.textContent,'own new');
    const asyncTrace=[];let finishHook;
    const AsyncRendered=namespace `docsprobe`(class AsyncRenderedCard extends Base {html(){return super.html();}async onRendered(){asyncTrace.push('start');await new Promise(resolve=>{finishHook=resolve;});asyncTrace.push('finish');}});
    const asyncRendered=await mount(AsyncRendered);check('async onRendered not awaited',asyncTrace,['start']);finishHook();await wait(()=>asyncTrace.includes('finish'));
    const historyPayload={item:1};light.fire('docs:mutable',historyPayload);historyPayload.item=9;let replayValue;const off=light.subscribe('docs:mutable',e=>replayValue=e.detail.item);off();check('signal retains payload reference',replayValue,9);
    const forwarded=new CSSStyleSheet;forwarded.replaceSync(':host{--detached:1}');forwarded.url='/tokens.css';adopt.remove();await new Promise(r=>setTimeout(r,0));application.fire('stylesheet:adopted',{sheet:forwarded});check('disconnect stops document sheet adoption',adopt.root.adoptedStyleSheets.includes(forwarded),false);
    const tempData={};await data.render(tempData);check('template provider cached across renders',Object.hasOwn(tempData,'calls'),false);
    let nativeAccessorFailed=false;try { await data.render({}); const engine=data.getTemplateEngine(); await engine.parse('<template><%= this.title %></template>',{},data); }catch(error){nativeAccessorFailed=/Illegal invocation/.test(error.message);}check('native accessor via plain data receiver fails',nativeAccessorFailed,true);
    return results;
  });
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({passed:results.length,checks:results},null,2));
} finally { await browser.close(); }
