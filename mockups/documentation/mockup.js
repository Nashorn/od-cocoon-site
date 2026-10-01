const $ = selector => document.querySelector(selector);
const escape = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const svg = (body, color='#7ca8ff') => `<svg viewBox="0 0 356 207" aria-hidden="true"><defs><linearGradient id="g${color.slice(1)}" x2="0.8" y2="1"><stop stop-color="${color}" stop-opacity=".2"/><stop offset="1" stop-color="${color}" stop-opacity=".04"/></linearGradient></defs><g fill="url(#g${color.slice(1)})" stroke="${color}" stroke-width="1.15" stroke-linejoin="round">${body}</g></svg>`;
const graphics = [
 svg('<path d="m122 133 13-49c24-30 55-43 97-35 8 39-7 74-37 97l-48 13-25-26Z"/><path d="m135 84-27 1-21 31 35 17m73 13-1 24-32 18-15-29"/><circle cx="184" cy="97" r="17"/><path d="m121 150-16 22m26-12-10 24m-13-45-25 11" fill="none"/><path d="M213 49c-1 16 5 23 19 24"/>'),
 svg('<path d="m111 62 133-23v115l-133 24Z"/><path d="m111 62-9-5 133-23 9 5M102 57v115l9 6"/><path d="m133 80 133-23v115l-133 24Z" fill="#131c36"/><path d="m133 80-8-5 133-23 8 5M125 75v115l8 6M133 96l133-23"/><circle cx="248" cy="70" r="1.8"/><circle cx="255" cy="69" r="1.8"/><path d="m153 119 13 7-13 12m25-2 24-4" fill="none" stroke-width="3"/>','#ad96ff'),
 svg('<path d="m177 35 75 38-75 39-75-39 75-38Z"/><path d="m102 73 75 39v56l-75-39V73Zm75 39 75-39v56l-75 39v-56Z"/><path d="m178 18 25 13-25 13-25-13 25-13ZM75 125l25 13v35l-25-13v-35Zm25 13 22-12v35l-22 12m22-47-25-13-22 12M255 145l25-13v-35l-25 13v35Zm0-35-22-12v35l22 12m-22-47 25-13 22 12"/><path d="m177 112 0 56" fill="none"/>','#5fe9bd'),
 svg('<path d="m108 65 72-30 73 30-73 31-72-31Zm0 22 72 31 73-31v24l-73 31-72-31V87Zm0 47 72 30 73-30v24l-73 31-72-31v-24Z"/><path d="m180 96 0-61m-45 19 73 30m-53-39 72 31m-107 39 0 11m20-3 0 12m20-4 0 13m-40 18 0 10m20-3 0 12m20-4 0 13" fill="none"/>')
];
const cardData = [
 ['api.application','Quickstart','Build your first application with native components, imports, and shared styles.'],
 ['api.template-syntax','Templates & rendering','Bring your HTML to life with expressions, conditions, loops, and async templates.'],
 ['api.component','Components','Compose reusable interfaces with native elements, lifecycle hooks, and inheritance.'],
 ['api.threading','Multicore threading','Move heavy computation into workers and keep your application responsive.']
];
$('#cards').innerHTML = cardData.map(([id,title,description],i)=>`<a class="card" href="#${id}"><div class="card-art">${graphics[i]}</div><h2>${title}<span>↗</span></h2><p>${description}</p></a>`).join('');
$('.hero-art').innerHTML = graphics[0].replace('<svg ','<svg class="art-left" ') + graphics[2].replace('<svg ','<svg class="art-top" ') + graphics[1].replace('<svg ','<svg class="art-right" ');
let bundle, current='overview', observer;
const groups=[['Get started',['overview','get-started','api.application','compatibility']],['Build your interface',['api.component','api.template-syntax','api.templates','api.styling','api.light-and-shadow-dom','api.customized-built-in-elements']],['Application essentials',['api.namespaces-and-imports','api.script-attributes','api.lifecycle','api.events','api.watching-inputs','api.selectors-and-dom']],['Go further',['api.class-composition','api.component-autodiscovery','api.world','api.threading','api.page-readiness']]];
const names={overview:'Introduction','get-started':'Your first component','api.application':'Quickstart','api.light-and-shadow-dom':'Shadow & light DOM','api.customized-built-in-elements':'Native elements','api.namespaces-and-imports':'Namespaces & imports','api.component-autodiscovery':'Autodiscovery','api.selectors-and-dom':'Selectors & DOM','api.world':'World & simulation'};
let toastTimer;
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),2200);}
async function copy(text){try{await navigator.clipboard.writeText(text);toast('Copied to clipboard');}catch{toast('Clipboard unavailable in this browser');}}
function closeMenu(){document.body.classList.remove('nav-open');$('.menu').setAttribute('aria-expanded','false');}
$('.menu').onclick=()=>{const open=document.body.classList.toggle('nav-open');$('.menu').setAttribute('aria-expanded',String(open));};$('.scrim').onclick=closeMenu;$('.sidebar').addEventListener('click',event=>{if(event.target.closest('a'))closeMenu();});
function renderNavigation(){ $('#navigation').innerHTML=groups.map(([title,ids])=>`<section class="nav-group"><h2>${title}</h2>${ids.map(id=>`<a href="#${id}" data-doc="${id}">${escape(names[id]||bundle.documents[id].title)}</a>`).join('')}</section>`).join(''); }
function linkFor(url){const parsed=new URL(url,location.origin);const id=bundle.routes[parsed.pathname];return id?'#'+id+parsed.hash.replace('#','/'):url;}
function showPage(){
 const [id='overview',anchor]=decodeURIComponent(location.hash.slice(1)).split('/');current=bundle.documents[id]?id:'overview';
 const home=current==='overview';$('#overview').hidden=!home;$('#article').hidden=home;document.title=`${home?'Documentation':bundle.documents[current].title} — Cocoon design preview`;
 document.querySelectorAll('[data-doc]').forEach(a=>{a.classList.toggle('active',a.dataset.doc===current);if(a.dataset.doc===current)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
 document.querySelectorAll('[data-tab]').forEach(a=>a.classList.toggle('current',a.dataset.tab===(current.startsWith('api.')?'api':'overview')));
 closeMenu();observer?.disconnect();
 if(!home){
 const doc=bundle.documents[current];$('#section-label').textContent=groups.find(([,ids])=>ids.includes(current))?.[0]||'API reference';
 $('#article-body').innerHTML=doc.bodyHtml;
 const note=[...$('#article-body').querySelectorAll('p')].find(p=>p.textContent.startsWith('This reference describes the inspected runtime.'));note?.classList.add('reference-note');
 $('#article-body').querySelectorAll('a').forEach(a=>a.setAttribute('href',linkFor(a.getAttribute('href'))));
 $('#article-body').querySelectorAll('pre').forEach(pre=>{const code=pre.querySelector('code');pre.dataset.language=code?.className.replace('language-','')||'Code';const button=document.createElement('button');button.className='copy-code';button.textContent='Copy';button.onclick=()=>copy(code.textContent);pre.append(button);});
 $('#toc').innerHTML=doc.toc.filter(h=>h.depth===2).map(h=>`<a href="#${current}/${h.id}" data-heading="${h.id}">${escape(h.title)}</a>`).join('');
 $('#related').innerHTML=doc.related.length?'Related reading<br>'+doc.related.map(d=>`<a href="#${d.id}">${escape(d.title)} ↗</a>`).join(''):'';
 $('#pager').innerHTML=[doc.previous?`<a href="#${doc.previous.id}"><small>Previous</small>← ${escape(doc.previous.title)}</a>`:'<span></span>',doc.next?`<a href="#${doc.next.id}"><small>Next</small>${escape(doc.next.title)} →</a>`:''].join('');
 $('#copy-page').onclick=async()=>{const response=await fetch('../../docs/'+doc.source);if(response.ok)copy(await response.text());else toast('Unable to load Markdown');};
 observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){document.querySelectorAll('#toc a').forEach(a=>a.classList.toggle('active',a.dataset.heading===entry.target.id));}},{rootMargin:'-80px 0px -65% 0px'});$('#article-body').querySelectorAll('h2').forEach(h=>observer.observe(h));
 }
 if(anchor)requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView());else scrollTo({top:0,behavior:'instant'});
}
const dialog=$('#search-dialog'),input=$('#search-input');
function search(){const words=input.value.trim().toLowerCase().split(/\s+/).filter(Boolean);const results=words.length?bundle.search.filter(s=>words.every(w=>(s.title+' '+s.heading+' '+s.text).toLowerCase().includes(w))).slice(0,8):Object.values(bundle.documents).slice(0,6).map(d=>({documentId:d.id,title:d.title,heading:'Open reference',url:d.route}));$('#search-results').innerHTML=results.length?results.map(s=>`<a href="${linkFor(s.url)}">${escape(s.heading)}<small>${escape(s.title)}</small></a>`).join(''):'<p>No matches. Try “styles”, “events”, or “template”.</p>';}
$('.search-trigger').onclick=()=>{if(!bundle)return;dialog.showModal();search();input.focus();};input.oninput=search;$('#search-results').onclick=e=>{if(e.target.closest('a'))dialog.close();};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('#search-results a')?.click();}};
document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key==='k'){e.preventDefault();$('.search-trigger').click();}if(e.key==='Escape')closeMenu();});
try{const response=await fetch('./content.json');if(!response.ok)throw Error('Run npm run docs:preview to generate the preview content.');bundle=await response.json();renderNavigation();showPage();addEventListener('hashchange',showPage);}catch(error){$('#navigation').textContent=error.message;toast('Preview content could not load.');}
