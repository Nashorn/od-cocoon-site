import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, stat, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileDocumentation, buildDocumentation } from '../../scripts/build-docs.mjs';

async function fixture(t) {
 const dir = await mkdtemp(join(tmpdir(), 'cocoon-docs-'));
 t.after(() => rm(dir, { recursive: true, force: true })); // Only the temporary fixture created by this test.
 const docsDir=join(dir,'docs'), outputFile=join(dir,'out','bundle.json');
 await mkdir(join(docsDir,'api'),{recursive:true});
 const manifest={schemaVersion:1,documents:[
  {id:'home',source:'index.md',route:'/documentation',title:'Documentation',related:['api.card']},
  {id:'api.card',source:'api/card.md',route:'/documentation/api/card',title:'Card',related:[]},
 ],navigation:[{id:'start',label:'Start here',documents:['home']},{id:'api',label:'API',documents:['api.card']}]};
 const save = () => writeFile(join(docsDir,'manifest.json'),JSON.stringify(manifest));
 await save();
 await writeFile(join(docsDir,'index.md'),'# Documentation\n\n[Card](api/card.md#usage) and [site](/index.html).\n');
 await writeFile(join(docsDir,'api/card.md'),'# Card\n\nA useful card.\n\n## Usage\n\nChoose **Coffee**.\n\n## Usage\n\nSecond example.\n\n## Usage-1\n\nCollision example.\n');
 return {dir,docsDir,outputFile,manifest,save};
}

test('content, links, collision-safe anchors, navigation, search, and inverse relationships',async t=>{
 const f=await fixture(t);const b=await compileDocumentation(f);
 assert.match(b.documents.home.bodyHtml,/href="\/documentation\/api\/card#usage"/);
 assert.match(b.documents.home.bodyHtml,/href="\/index.html"/);
 assert.deepEqual(b.documents['api.card'].toc.map(h=>h.id),['usage','usage-1','usage-1-1']);
 assert.match(b.documents['api.card'].bodyHtml,/<h2 id="usage-1-1">/);
 assert.equal(b.documents.home.next.id,'api.card');
 assert.equal(b.documents['api.card'].previous.id,'home');
 assert.equal(b.documents['api.card'].breadcrumbs[1].title,'API');
 assert.equal(b.documents.home.related[0].route,'/documentation/api/card');
 assert.equal(b.search.find(s=>s.url.endsWith('#usage')).text,'Choose Coffee.');
 assert.deepEqual(b.dependencies['api/card.md'].linkedFrom,['home']);
 assert.deepEqual(b.dependencies['api/card.md'].relatedFrom,['home']);
 assert.equal(b.routes['/documentation/api/card'],'api.card');
});

test('a canonical edit updates content, TOC and search; identical builds do not rewrite output',async t=>{
 const f=await fixture(t);const first=await buildDocumentation(f);
 const bytes=await readFile(f.outputFile,'utf8'),mtime=(await stat(f.outputFile)).mtimeMs;
 assert.equal((await buildDocumentation(f)).written,false);
 assert.equal(await readFile(f.outputFile,'utf8'),bytes);
 assert.equal((await stat(f.outputFile)).mtimeMs,mtime);
 await writeFile(join(f.docsDir,'api/card.md'),'# Card\n\nUpdated content.\n\n## Usage\n\nNew coffee example.\n\n## Shipping\n\nShips tomorrow.\n');
 const next=await buildDocumentation(f);
 assert.equal(next.written,true);
 assert.notEqual(next.bundle.buildHash,first.bundle.buildHash);
 assert.notEqual(next.bundle.documents['api.card'].sourceHash,first.bundle.documents['api.card'].sourceHash);
 assert.match(next.bundle.documents['api.card'].bodyHtml,/Updated content/);
 assert.equal(next.bundle.documents['api.card'].toc.at(-1).id,'shipping');
 assert.ok(next.bundle.search.some(s=>s.text==='Ships tomorrow.'));
 assert.ok(!next.bundle.search.some(s=>s.text==='Second example.'));
 assert.deepEqual(next.bundle.documents.home,first.bundle.documents.home);
});

test('route changes propagate through incoming links, related links, navigation and search',async t=>{
 const f=await fixture(t);await buildDocumentation(f);
 f.manifest.documents[1].route='/documentation/api/product-card';await f.save();
 const {bundle:b}=await buildDocumentation(f);
 assert.match(b.documents.home.bodyHtml,/product-card#usage/);
 assert.equal(b.documents.home.next.route,'/documentation/api/product-card');
 assert.equal(b.documents.home.related[0].route,'/documentation/api/product-card');
 assert.equal(b.navigation[1].documents[0].route,'/documentation/api/product-card');
 assert.ok(b.search.filter(s=>s.documentId==='api.card').every(s=>s.url.startsWith('/documentation/api/product-card')));
 assert.equal(b.routes['/documentation/api/card'],undefined);
});

test('source renaming retains identity after source-relative links are updated',async t=>{
 const f=await fixture(t);
 f.manifest.documents[1].source='api/product.md';await f.save();
 await writeFile(join(f.docsDir,'api/product.md'),'# Card\n\n## Usage\n\nCoffee.\n');
 await writeFile(join(f.docsDir,'index.md'),'# Documentation\n\n[Card](api/product.md#usage)\n');
 const b=await compileDocumentation(f);
 assert.equal(b.routes['/documentation/api/card'],'api.card');
 assert.equal(b.documents['api.card'].source,'api/product.md');
 assert.equal(b.dependencies['api/card.md'],undefined);
});

for(const [name,change,message] of [
 ['duplicate IDs',m=>m.documents[1].id='home',/duplicate ID/],
 ['duplicate routes',m=>m.documents[1].route='/documentation',/duplicate route/],
 ['duplicate sources',m=>m.documents[1].source='index.md',/duplicate source/],
 ['unknown related IDs',m=>m.documents[0].related=['missing'],/unknown related/],
 ['unknown navigation IDs',m=>m.navigation[0].documents=['missing'],/unknown navigation/],
 ['missing navigation entries',m=>m.documents.push({id:'hidden',source:'hidden.md',route:'/documentation/hidden',title:'Hidden',related:[]}),/missing navigation placement/],
 ['duplicate navigation entries',m=>m.navigation[1].documents.push('home'),/duplicate navigation placement/],
 ['unsafe source paths',m=>m.documents[1].source='../secret.md',/inside docs/],
 ['noncanonical routes',m=>m.documents[1].route='/documentation/api/card/',/invalid documentation route/],
]) test(`rejects ${name}`,async t=>{const f=await fixture(t);change(f.manifest);await f.save();await assert.rejects(compileDocumentation(f),message);});

test('missing source and symlink escape fail with source context',async t=>{
 const f=await fixture(t);await rm(join(f.docsDir,'api/card.md'));
 await assert.rejects(compileDocumentation(f),/api.card: cannot read api\/card.md/);
 await writeFile(join(f.dir,'secret.md'),'# Secret');
 await symlink(join(f.dir,'secret.md'),join(f.docsDir,'api/card.md'));
 await assert.rejects(compileDocumentation(f),/source escapes/);
});

test('unpublished source links and broken cross-page/same-page anchors are rejected',async t=>{
 const f=await fixture(t);await writeFile(join(f.docsDir,'internal.md'),'# Internal');
 for(const [link,error] of [['internal.md',/not in manifest/],['api/card.md#missing',/missing heading/],['#missing',/missing heading/],['/documentation/missing',/not in manifest/]]) {
  await writeFile(join(f.docsDir,'index.md'),`# Documentation\n\n[Link](${link})\n`);
  await assert.rejects(compileDocumentation(f),error);
 }
});

test('failed validation preserves last valid output and check mode writes nothing',async t=>{
 const f=await fixture(t);await buildDocumentation({...f,check:true});
 await assert.rejects(stat(f.outputFile),{code:'ENOENT'});
 await buildDocumentation(f);const before=await readFile(f.outputFile,'utf8');
 await writeFile(join(f.docsDir,'index.md'),'# Documentation\n\n[Broken](api/card.md#missing)');
 await assert.rejects(buildDocumentation(f),/missing heading/);
 assert.equal(await readFile(f.outputFile,'utf8'),before);
});

test('removed documents disappear from all generated structures',async t=>{
 const f=await fixture(t);await buildDocumentation(f);
 f.manifest.documents.splice(1);f.manifest.documents[0].related=[];f.manifest.navigation.splice(1);await f.save();
 await writeFile(join(f.docsDir,'index.md'),'# Documentation\n\nJust the landing page.');
 const {bundle:b}=await buildDocumentation(f);
 assert.deepEqual(Object.keys(b.documents),['home']);assert.equal(b.search.length,1);
 assert.equal(b.documents.home.next,null);assert.equal(b.dependencies['api/card.md'],undefined);
});

test('reference links, formatted headings, fragments and queries resolve without editing code examples',async t=>{
 const f=await fixture(t);
 await writeFile(join(f.docsDir,'index.md'),'# Documentation\n\n[Card][card]\n\n[card]: api/card.md?mode=learn#usage\n\n```html\n<a href="internal.md">Example only</a>\n```\n');
 await writeFile(join(f.docsDir,'api/card.md'),'# Card\n\n## **Usage**\n\n[Same](#usage)\n');
 const b=await compileDocumentation(f);
 assert.match(b.documents.home.bodyHtml,/href="\/documentation\/api\/card\?mode=learn#usage"/);
 assert.match(b.documents.home.bodyHtml,/internal.md/);
 assert.equal(b.documents['api.card'].toc[0].id,'usage');
});

test('raw navigation and executable link schemes do not bypass resolution',async t=>{
 const f=await fixture(t);
 for(const [body,error] of [['<a href="internal.md">Hidden</a>',/raw navigation/],['[Bad](javascript:alert)',/unsupported link scheme/]]) {
  await writeFile(join(f.docsDir,'index.md'),'# Documentation\n\n'+body);
  await assert.rejects(compileDocumentation(f),error);
 }
});

test('real canonical docs compile; internal artifacts are excluded and website files stay untouched',async()=>{
 const websiteFiles=['../../docs.html','../../get-started.html','../../index.html'];
 const before=await Promise.all(websiteFiles.map(file=>readFile(new URL(file,import.meta.url),'utf8')));
 const b=await compileDocumentation();
 assert.equal(Object.keys(b.documents).length,21);
 assert.ok(Object.values(b.documents).every(d=>!d.source.startsWith('discovery/')));
 assert.ok(b.search.length>100);
 assert.ok(Object.values(b.documents).every(d=>!d.bodyHtml.includes('id="undefined"')));
 const after=await Promise.all(websiteFiles.map(file=>readFile(new URL(file,import.meta.url),'utf8')));
 assert.deepEqual(after,before);
});
