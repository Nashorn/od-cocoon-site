import { chromium } from 'playwright';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const runtime=await readFile(new URL('../../vendor/cocoon/framework.src.js',import.meta.url),'utf8');
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/__dom_docs__/**',route=>{
 if(new URL(route.request().url()).pathname.endsWith('.css'))return route.fulfill({contentType:'text/css',body:':host { --file: 1; }'});
 if(new URL(route.request().url()).pathname.endsWith('/kernel.js'))return route.fulfill({contentType:'text/javascript',body:runtime});
 return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><style>body {--brand:rgb(10, 20, 30);color:rgb(0, 0, 0)} .design {color:rgb(200, 0, 0)}</style><script type="importmap">{"imports":{}}</script><script src="./kernel.js" data-kernel data-rootpath="./" data-sandbox="false"></script></head><body></body></html>'});
 });
 await page.goto('http://127.0.0.1:8081/__dom_docs__/index.html');
 const result=await page.evaluate(async()=>{
 const results=[];const check=(name,actual,expected)=>{if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error(name+JSON.stringify({actual,expected}));results.push({name,actual});};
 const wait=async f=>{for(let i=0;i<200;i++){if(f())return;await new Promise(r=>setTimeout(r,5));}throw Error('Timeout '+f);};
 const template='<template><article><slot name="heading">Default heading</slot><span class="design">Internal</span><span class="token" style="color:var(--brand)">Token</span><button>Action</button><slot>Default body</slot></article></template>';
 const Light=namespace `domprobe`(class LightCard extends Component {static skin=null;html(){return template;}});
 const Shadow=namespace `domprobe`(class ShadowCard extends Component {static skin=null;inShadow(){return true;}html(){return template;}shouldAdoptDocumentStyleSheets(){return 'shared-design.css';}});
 const light=new Light;light.innerHTML='<b slot="heading">Supplied heading</b><em>Supplied body</em>';const oldLight=light.firstChild;document.body.appendChild(light);await wait(()=>light.hasAttribute('namespace'));
 const shadow=new Shadow;shadow.innerHTML='<b slot="heading">Supplied heading</b><em>Supplied body</em>';const oldShadow=shadow.firstChild;document.body.appendChild(shadow);await wait(()=>shadow.hasAttribute('namespace'));
 check('light root is host',light.root===light,true);check('shadow root separate',shadow.root===shadow.shadowRoot,true);
 check('light initial children replaced',oldLight.isConnected,false);check('shadow initial children retained',oldShadow.parentNode===shadow,true);
 check('light slot no projection',light.querySelector('slot').assignedNodes().length,0);
 check('shadow named slot projects node',shadow.root.querySelector('slot[name]').assignedNodes()[0]===oldShadow,true);
 check('shadow default slot projects node',shadow.root.querySelector('slot:not([name])').assignedNodes()[0].tagName,'EM');
 check('document sees light internals',document.querySelector('domprobe-light-card .design')!==null,true);
 check('document cannot query shadow internals',document.querySelector('domprobe-shadow-card .design'),null);
 check('page selectors reach light',getComputedStyle(light.querySelector('.design')).color,'rgb(200, 0, 0)');
 check('page selectors do not reach shadow',getComputedStyle(shadow.querySelector('.design')).color,'rgb(0, 0, 0)');
 check('tokens inherit without sheet adoption',getComputedStyle(shadow.querySelector('.token')).color,'rgb(10, 20, 30)');
 shadow.style.setProperty('--brand','rgb(40, 50, 60)');check('host token override',getComputedStyle(shadow.querySelector('.token')).color,'rgb(40, 50, 60)');
 const inner=shadow.querySelector('button');const seen=[];document.addEventListener('dom-probe',e=>seen.push({targetIsHost:e.target===shadow,pathHasInner:e.composedPath().includes(inner)}));
 inner.dispatchEvent(new CustomEvent('dom-probe',{bubbles:true,composed:false}));check('noncomposed stays inside shadow',seen.length,0);
 inner.dispatchEvent(new CustomEvent('dom-probe',{bubbles:true,composed:true}));check('composed event retargeted',seen,[{targetIsHost:true,pathHasInner:true}]);
 const previousButton=shadow.querySelector('button');await shadow.render({});check('rerender replaces shadow internals',shadow.querySelector('button')===previousButton,false);check('rerender retains light children',shadow.firstChild===oldShadow,true);check('rerender restores slot assignment',shadow.root.querySelector('slot[name]').assignedNodes()[0]===oldShadow,true);
 const Inline=namespace `domprobe`(class InlineCard extends Component {static skin=null;static inline=true;});const inline=new Inline;inline.innerHTML='<p>Original</p>';const original=inline.firstChild;document.body.appendChild(inline);await wait(()=>inline.hasAttribute('namespace'));check('inline preserves existing light children',inline.firstChild===original,true);
 const sheet=new CSSStyleSheet;sheet.url='/shared-design.css';sheet.replaceSync('.design {color:rgb(0, 100, 0)}');await wait(()=>application._stylesheetsLoaded);application.stylesheets.add(sheet);await wait(()=>shadow.root.adoptedStyleSheets.includes(sheet));
 check('opted in shadow gets shared rule',getComputedStyle(shadow.querySelector('.design')).color,'rgb(0, 100, 0)');
 check('light styles are document-owned',light.adoptedStyleSheets===undefined,true);
 const LightStyled=namespace `domprobe`(class LightStyled extends Component {html(){return '<template><b>styled</b></template>';}css(){return ':host {--inline:2;}';}});
 const styled=new LightStyled;document.body.appendChild(styled);await wait(()=>styled.hasAttribute('namespace'));
 check('light conventional sheet installed in head',!!document.head.querySelector('style[namespace="domprobe.LightStyled"]'),true);
 check('light host selector rewritten',getComputedStyle(styled).getPropertyValue('--file').trim(),'1');
 check('light namespace dedup skips later same-class inline',getComputedStyle(styled).getPropertyValue('--inline').trim(),'');
 return results;
 });
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:result.length,checks:result},null,2));
}finally{await browser.close();}
