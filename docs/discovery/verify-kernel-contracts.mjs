import { chromium } from 'playwright';import {readFile} from 'node:fs/promises';import assert from 'node:assert/strict';
let runtime=await readFile(new URL('../../vendor/cocoon/framework.src.js',import.meta.url),'utf8');const compositionDoc=await readFile(new URL('../api/class-composition.md',import.meta.url),'utf8');
const docModel=compositionDoc.split('## A reusable behavior')[1].match(/```javascript\n([\s\S]*?)```/)[1];
const docComponent=compositionDoc.split('## Use the same capability in a component')[1].match(/```javascript\n([\s\S]*?)```/)[1];
const browser=await chromium.launch({channel:'chrome',headless:true});
const result={baseline:process.env.COCOON_PROBE_BOOT_SOURCE ? 'site runtime with current arc-kernel bootloader substituted in the isolated fixture' : 'site runtime'};
if(process.env.COCOON_PROBE_BOOT_SOURCE){
 const boot=await readFile('/Users/jasonsmith/Development/arc-kernel/src/system/bootloader.js','utf8');
 const start=runtime.indexOf(';async function adoptDocumentStylesheet');const marker='preloadController(importMapReady);';const end=runtime.lastIndexOf(marker)+marker.length;
 assert.ok(start>=0 && end>start);runtime=runtime.slice(0,start)+boot+runtime.slice(end);
}

try{
const page=await browser.newPage();await page.addInitScript(()=>{window.readyEvents=[];window.worldTrace=[];for(const name of ['page:pre:rendered','page:rendered'])window.addEventListener(name,e=>readyEvents.push({name,detail:e.detail,at:performance.now()}));});
await page.route('**/__kernel_docs__/**',route=>{const path=new URL(route.request().url()).pathname;
if(path.endsWith('/kernel.js'))return route.fulfill({contentType:'text/javascript',body:runtime});
if(path.endsWith('/src/kernelprobe/TestWorld/index.js'))return route.fulfill({contentType:'text/javascript',body:'namespace `kernelprobe`(class TestWorld extends World {static skin=null;getSimulationTimestep(){return 1000/30;}onUpdate(t,d){worldTrace.push(["update",t,d]);}onFixedUpdate(dt){worldTrace.push(["fixed",dt]);}onDraw(a){worldTrace.push(["draw",a]);}});'});
return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" data-namespace="kernelprobe.TestWorld" data-controller="index.js" data-sandbox="false"></script></head><body></body></html>'});});
await page.goto('http://127.0.0.1:8081/__kernel_docs__/index.html');await page.waitForFunction(()=>worldTrace.some(e=>e[0]==='fixed'));
result.world=await page.evaluate(()=>{const facts={sameApp:world===application,running:world.isRunning(),step:MainLoop.getSimulationTimestep(),fixed:worldTrace.find(e=>e[0]==='fixed')[1],hasDraw:worldTrace.some(e=>e[0]==='draw')};world.onStop();facts.stopped=!world.isRunning();return facts;});assert.equal(result.world.fixed,1000/30);assert.ok(result.world.sameApp&&result.world.running&&result.world.stopped&&result.world.hasDraw);
await page.waitForFunction(()=>readyEvents.some(e=>e.name==='page:rendered'));
result.readiness=await page.evaluate(()=>readyEvents);assert.equal(result.readiness[0].name,'page:pre:rendered');assert.equal(result.readiness[1].detail.reason,'settled');assert.ok(result.readiness[1].at>=result.readiness[0].at);if(process.env.COCOON_PROBE_BOOT_SOURCE)assert.ok(result.readiness[1].at-result.readiness[0].at>=290);
result.language=await page.evaluate(()=>{const Plain=namespace `kernelprobe.models`(class Money {constructor(n){this.amount=n;}double(){return this.amount*2;}});const instance=new kernelprobe.models.Money(3);class A {value(){return 'A';}}class B{value(){return 'B';}get label(){return 'getter';}}class FieldMixin{field=1;method(){return true;}}class Mixed extends A.with(B,FieldMixin){};const mixed=new Mixed;return {returned:Plain===kernelprobe.models.Money,registry:classof('kernelprobe.models.Money')===Plain,ordinaryClass:instance.double(),mixedValue:mixed.value(),getter:mixed.label,fieldPresent:Object.hasOwn(mixed,'field'),method:mixed.method(),base:mixed instanceof A};});assert.deepEqual(result.language,{returned:true,registry:true,ordinaryClass:6,mixedValue:'B',getter:'getter',fieldPresent:false,method:true,base:true});
result.workers=await page.evaluate(async()=>{const checks=[];const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+JSON.stringify({actual,expected}));checks.push({name,actual});};
const pool=new core.lang.ThreadPool(async job=>{self.count=(self.count||0)+1;if(job.fail)throw Error('job failure');if(job.delay)await new Promise(r=>setTimeout(r,job.delay));return {count:self.count,value:job.value};},1);
check('pool serial state',(await pool.run({value:1})).count,1);let failed=false;try{await pool.run({fail:true});}catch(e){failed=e.message==='job failure';}check('job rejection',failed,true);check('pool usable after caught job error',(await pool.run({value:3})).count,3);
const first=pool.run({delay:40,value:'hold'});const queued={value:'before'};const second=pool.run(queued);queued.value='after';await first;check('queued input cloned at dispatch',(await second).value,'after');pool.terminate();
const thread=new core.lang.Thread(async job=>{await new Promise(r=>setTimeout(r,job.delay));return job.id;});check('direct concurrent result mapping',await Promise.all([thread.run({id:'slow',delay:30}),thread.run({id:'fast',delay:0})]),['slow','fast']);thread.terminate();
const doomed=new core.lang.ThreadPool(async()=>{await new Promise(r=>setTimeout(r,1000));return 1;},1);const active=doomed.run(null).catch(e=>e.message),waiting=doomed.run(null).catch(e=>e.message);doomed.terminate();check('termination active and queue errors',await Promise.all([active,waiting]),['Thread terminated','ThreadPool terminated']);
const cloning=new core.lang.Thread(x=>x);let cloneError=false;try{await cloning.run(()=>{});}catch(e){cloneError=e.name==='DataCloneError';}check('noncloneable input rejects',cloneError,true);cloning.terminate();
const raw=new core.lang.Thread(function(event){self.postMessage(event.data*2);});const message=new Promise(resolve=>{raw.onmessage=e=>resolve(e.data);});raw.postMessage(4);check('raw message receives event',await message,8);raw.terminate();return checks;});
result.composition=await page.evaluate(()=>{
 const checks=[];const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+JSON.stringify({actual,expected}));checks.push({name,actual});};
 let constructed=0;class Base{constructor(){this.baseReady=true;} label(){return 'base';}}
 class A{field='field';constructor(){constructed++;}label(){return 'A';}get status(){return this.baseReady?'ready':'missing';}static category(){return 'A';}}
 class B{label(){return 'B';}static category(){return 'B';}}
 class Mixed extends Base.with(A,B){}const mixed=new Mixed;
 check('mixin constructors not run',constructed,0);check('base constructor runs',mixed.baseReady,true);check('later mixin wins',mixed.label(),'B');check('getter descriptor copied',mixed.status,'ready');check('later static wins',Mixed.category(),'B');check('mixin fields not initialized',Object.hasOwn(mixed,'field'),false);check('not instance of mixin',mixed instanceof A,false);
 class Symbols{[Symbol.iterator](){return [1][Symbol.iterator]();}namespaceHelper(){return 1;}valid(){return 2;}}
 const omitted=new (Base.with(Symbols));check('symbol not copied',typeof omitted[Symbol.iterator],'undefined');check('reserved substring method not copied',typeof omitted.namespaceHelper,'undefined');check('ordinary method copied',omitted.valid(),2);
 class Private{#value=1;read(){return this.#value;}}let privateFailed=false;try{new (Base.with(Private))().read();}catch{privateFailed=true;}check('private field brand not supplied',privateFailed,true);
 class Parent{label(){return 'trait-parent';}}class Child extends Parent{label(){return super.label();}own(){return true;}}
 check('super keeps original home chain',new (Base.with(Child))().label(),'trait-parent');
 const object={get state(){return this.baseReady;},run(){return 'object';}};const objectMixed=new (Base.with(object));check('object descriptor mixin',[objectMixed.state,objectMixed.run()],[true,'object']);
 return checks;
});
result.flags=await page.evaluate(()=>{const script=document.querySelector('[data-kernel]');script.setAttribute('data-dynamicload','false');const falseStringStillLoads=!!Config.DYNAMICLOAD;script.setAttribute('data-dynamicload','');const emptyDisables=!Config.DYNAMICLOAD;script.removeAttribute('data-dynamicload');return {falseStringStillLoads,emptyDisables};});assert.deepEqual(result.flags,{falseStringStillLoads:true,emptyDisables:true});
await page.evaluate(code=>{(0,eval)(code+'\nwindow.docExample = new components.SelectableCard(); document.body.appendChild(docExample);');},docModel+'\n'+docComponent);
await page.waitForFunction(()=>window.docExample?.hasAttribute('namespace'));
result.documentedComposition=await page.evaluate(()=>{docExample.querySelector('button').click();return {selected:docExample.selectedId,output:docExample.querySelector('output').textContent};});assert.deepEqual(result.documentedComposition,{selected:'account',output:'Selected: account'});
console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}
