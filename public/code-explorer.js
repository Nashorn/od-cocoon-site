/* <code-explorer> — portable, dependency-free code explorer web component (shadow DOM).
Usage:
  <script src="code-explorer.js"></script>
  <code-explorer></code-explorer>            fills its container (give the parent a height)
Feed it files (all mergeable — later loads add to the tree):
  1. drag & drop a .zip, folders, or loose files onto it
  2. inline share payload — a light-DOM child carries the files, so one copy-pasted
     snippet is a self-contained "share" another page can embed:
       <code-explorer><script type="application/json">{"index.html":"…","img.png":{"b64":"…"}}<\/script></code-explorer>
  3. src="share.zip" or src="share.json" — fetched on connect (zip or JSON payload)
  4. JS API: el.setFiles({'js/app.js':'…'}) (string | Uint8Array | ArrayBuffer),
     await el.loadZip(blobOrArrayBuffer), await el.loadURL(url), el.clear()
Sharing: the built-in "share" button (sidebar header) generates that inline-payload embed
snippet from whatever is currently loaded — el.getEmbedHTML() / el.getFiles() do the same in JS.
Attributes:
  src="…"            URL of a .zip or payload .json to load on connect
  open="path"        file to open once loaded
  templates-src="…"  URL of a JSON map {"Template name": {path: content|{b64}}} — extra
                     scaffolds for the "new" (new project) dialog; or call
                     CodeExplorer.registerTemplate(name, files) in JS
  font-src="…"       URL of FontWithASyntaxHighlighter-Regular.woff2 (default: next to this script).
                     Syntax colors come from the font itself (OpenType COLR) — no highlighter JS.
File ops: "+ file" / "+ folder" in the sidebar (paths with / create folders); right-click a
file or folder to rename, delete, or create inside it; "new" scaffolds a fresh project from a
template (confirms before trashing current files). JS: createFile(path, content),
renamePath(old, new), deletePath(path), newProject(templateName).
Events: 'files-changed' (detail.count) after any load; 'file-edited' (detail.path) per edit.
Editing: the code pane is editable in place (plain text) — edits persist in the virtual
file system and flow into Preview, getFiles() and share embeds. Cmd/Ctrl+S "saves":
clears the tab dirty markers, refreshes a visible preview, fires 'files-saved'.
Theming: override CSS vars on the element: --ce-bg, --ce-panel, --ce-border, --ce-text, --ce-dim, --ce-accent.
Preview: HTML files get a Code/Preview toggle. Two swappable engines:
  - virtual (default, zero-install): the sandboxed iframe gets a tiny bootstrap + the VFS as
    JSON; it mints in-iframe blob: URLs for every file, rewrites ES-module import specifiers,
    patches fetch()/XHR/Worker to answer VFS paths, and intercepts links so multi-page
    projects navigate. No server, works inside pasted share embeds.
  - service worker (auto-upgrade): host code-explorer-sw.js next to this script (https) and
    the component detects it, registers it, and serves previews as REAL urls under __ce/… —
    full fidelity, nothing to patch. Note: sw previews run same-origin with the host page
    (allow-same-origin), so only enable it for content you trust.
The status bar shows which engine rendered the preview. */
(() => {
'use strict';
const SCRIPT_URL = (document.currentScript && document.currentScript.src) || '';
const DEFAULT_FONT = new URL('FontWithASyntaxHighlighter-Regular.woff2', SCRIPT_URL || location.href).href;
const TD = new TextDecoder(), TE = new TextEncoder();
const IMG_EXT = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', ico:'image/x-icon', avif:'image/avif', bmp:'image/bmp' };
const MIME = Object.assign({ svg:'image/svg+xml', css:'text/css', js:'text/javascript', mjs:'text/javascript', json:'application/json', html:'text/html', htm:'text/html', txt:'text/plain', md:'text/plain', woff:'font/woff', woff2:'font/woff2', ttf:'font/ttf', otf:'font/otf', wasm:'application/wasm', pdf:'application/pdf', mp3:'audio/mpeg', mp4:'video/mp4' }, IMG_EXT);
const ext = p => (p.match(/\.([a-z0-9]+)$/i) || [,''])[1].toLowerCase();
const DOT = { html:'#e0895f', htm:'#e0895f', css:'#6f9ae0', js:'#d9c268', mjs:'#d9c268', ts:'#6f9ae0', jsx:'#d9c268', tsx:'#6f9ae0', json:'#8fbf7f', md:'#9a86c9', svg:'#9a86c9' };
const kb = n => n < 1024 ? n + ' B' : n < 1048576 ? (n/1024).toFixed(1) + ' KB' : (n/1048576).toFixed(1) + ' MB';
const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const HIDDEN = p => { const segs = p.split('/'); return segs.some((s, i) => s === '__MACOSX' || s === '.DS_Store' || /^\.env(\.|$)/.test(s) || (s[0] === '.' && s.length > 1 && i < segs.length - 1)); };

/* runs INSIDE the preview iframe — stringified into srcdoc, no outer closure */
function __ceBoot(cfg) {
  const F = cfg.files, MIME = cfg.mime;
  const ext = p => (p.match(/\.([a-z0-9]+)$/i) || [,''])[1].toLowerCase();
  const mime = p => MIME[ext(p)] || 'application/octet-stream';
  const bytes = p => { const f = F[p]; if (f.u8) return f.u8; if (f.t != null) return f.u8 = new TextEncoder().encode(f.t); const bin = atob(f.b), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return f.u8 = u; };
  const text = p => F[p].t != null ? F[p].t : new TextDecoder().decode(bytes(p));
  const dirOf = p => p.split('/').slice(0, -1).join('/');
  const resolve = (dir, ref) => {
    if (!ref || /^(data:|blob:|javascript:|#|mailto:)/i.test(ref)) return null;
    ref = String(ref).split(/[?#]/)[0];
    if (/^https?:|^\/\//i.test(ref)) { try { ref = new URL(ref, 'http://x').pathname; } catch (e) { return null; } } // origin-absolute → path, suffix-matched below
    if (!ref) return null;
    const parts = (ref[0] === '/' ? ref.slice(1) : (dir ? dir + '/' : '') + ref).split('/'), out = [];
    for (const s of parts) { if (s === '.' || s === '') continue; s === '..' ? out.pop() : out.push(s); }
    let k = out.join('/'); if (F[k] != null) return k;
    for (let i = 1; i < out.length; i++) { k = out.slice(i).join('/'); if (F[k] != null) return k; } // suffix match (paths that escaped the vfs root)
    return null;
  };
  let IMAP = {};
  try { const imk = F['.importmap'] ? '.importmap' : F['importmap.json'] ? 'importmap.json' : null; if (imk) IMAP = (JSON.parse(text(imk)).imports) || {}; } catch (e) {}
  const mapSpec = ref => {
    if (IMAP[ref] != null) return IMAP[ref];
    for (const k in IMAP) if (k.endsWith('/') && ref.indexOf(k) === 0) return IMAP[k] + ref.slice(k.length);
    return ref;
  };
  const urls = {};
  const rewriteCSS = (css, dir, stack) => css
    .replace(/@import\s+(['"])([^'"]+)\1/gi, (m, q, ref) => { const k = resolve(dir, ref), u = k && urlFor(k, stack); return u ? '@import "' + u + '"' : m; })
    .replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (m, q, ref) => { const k = resolve(dir, ref), u = k && urlFor(k, stack); return u ? 'url("' + u + '")' : m; });
  const rewriteJS = (src, dir, stack) => src
    .replace(/((?:^|[^\w$.])(?:import|export)\s*(?:[\w${},*\s]+from\s*)?)(['"])([^'"]+)\2/g, (m, pre, q, ref) => { const k = resolve(dir, mapSpec(ref)), u = k && urlFor(k, stack); return u ? pre + q + u + q : m; })
    .replace(/([^\w$.]|^)import(\s*\()/g, (m, pre, par) => pre + 'window.__ceImport' + par);
  function urlFor(p, stack) {
    if (urls[p]) return urls[p];
    if (stack.indexOf(p) > -1) return null; /* import cycle: leave original */
    const e = ext(p), deeper = stack.concat(p); let blob;
    if (e === 'js' || e === 'mjs') blob = new Blob([rewriteJS(text(p), dirOf(p), deeper)], { type: 'text/javascript' });
    else if (e === 'css') blob = new Blob([rewriteCSS(text(p), dirOf(p), deeper)], { type: 'text/css' });
    else blob = new Blob([bytes(p)], { type: mime(p) });
    return urls[p] = URL.createObjectURL(blob);
  }
  let curDir = dirOf(cfg.entry);
  window.__ceImport = spec => {
    spec = String(spec);
    if (/^(blob:|data:)/i.test(spec)) return import(spec);
    const k = resolve(curDir, mapSpec(spec));
    return import(k ? urlFor(k, []) : spec);
  };
  const realFetch = window.fetch.bind(window);
  window.fetch = (input, init) => { const u = typeof input === 'string' ? input : (input && input.url) || String(input); const k = resolve(curDir, u); return k ? Promise.resolve(new Response(bytes(k), { headers: { 'Content-Type': mime(k) } })) : realFetch(input, init); };
  const XO = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (m, u) { const k = resolve(curDir, u); arguments[1] = k ? urlFor(k, []) : u; return XO.apply(this, arguments); };
  const RW = window.Worker;
  window.Worker = function (u, o) { const k = resolve(curDir, String(u)); return new RW(k ? urlFor(k, []) : u, o); };
  function render(page) {
    curDir = dirOf(page);
    let html = text(page);
    html = html.replace(/\b(src|href|poster)\s*=\s*(["'])([^"']*)\2/gi, (m, a, q, ref) => {
      const k = resolve(curDir, ref); if (!k) return m;
      if (/\.html?$/i.test(k)) return a + '=' + q + '#/' + k + q;
      const u = urlFor(k, []); return u ? a + '=' + q + u + q : m;
    });
    html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style/gi, (m, body) => body ? m.replace(body, rewriteCSS(body, curDir, [])) : m);
    html = html.replace(/(<script\b[^>]*type\s*=\s*["']?module["']?[^>]*>)([\s\S]*?)(<\/script)/gi, (m, open, body, close) => body.trim() ? open + rewriteJS(body, curDir, []) + close : m);
    document.open(); document.write(html); document.close();
    document.addEventListener('click', e => {
      const a = e.target && e.target.closest && e.target.closest('a[href]'); if (!a) return;
      const raw = a.getAttribute('href');
      const k = raw.indexOf('#/') === 0 ? raw.slice(2) : resolve(curDir, raw);
      if (k && F[k] != null && /\.html?$/i.test(k)) { e.preventDefault(); render(k); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => render(cfg.entry));
  else render(cfg.entry);
}

async function inflate(u8) {
  const st = new Blob([u8]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(st).arrayBuffer());
}
async function parseZip(buf) {
  const dv = new DataView(buf), u8 = new Uint8Array(buf);
  let i = buf.byteLength - 22, min = Math.max(0, i - 65535);
  while (i >= min && dv.getUint32(i, true) !== 0x06054b50) i--;
  if (i < min || i < 0) throw new Error('Not a zip file');
  let count = dv.getUint16(i + 10, true), off = dv.getUint32(i + 16, true);
  const out = {};
  for (let n = 0; n < count && off + 46 <= buf.byteLength; n++) {
    if (dv.getUint32(off, true) !== 0x02014b50) break;
    const method = dv.getUint16(off + 10, true), csize = dv.getUint32(off + 20, true);
    const nl = dv.getUint16(off + 28, true), el = dv.getUint16(off + 30, true), cl = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true);
    const name = TD.decode(u8.subarray(off + 46, off + 46 + nl)).replace(/\\/g, '/');
    off += 46 + nl + el + cl;
    if (name.endsWith('/') || HIDDEN(name)) continue;
    const lnl = dv.getUint16(lho + 26, true), lel = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lnl + lel, comp = u8.subarray(start, start + csize);
    if (method === 0) out[name] = comp.slice();
    else if (method === 8) out[name] = await inflate(comp);
  }
  return out;
}
function readEntryTree(entry, prefix, out) {
  return new Promise(res => {
    if (entry.isFile) entry.file(f => f.arrayBuffer().then(b => { out[prefix + entry.name] = new Uint8Array(b); res(); }, res), res);
    else if (entry.isDirectory) {
      const rd = entry.createReader(), all = [];
      const pump = () => rd.readEntries(es => {
        if (!es.length) return Promise.all(all).then(res);
        for (const e of es) all.push(readEntryTree(e, prefix + entry.name + '/', out));
        pump();
      }, res);
      pump();
    } else res();
  });
}

const CSS = `
:host{display:block;height:100%;min-height:320px;--ce-bg:#191b1f;--ce-panel:#1f2227;--ce-panel2:#24272d;--ce-border:#2e3238;--ce-text:#c9ced6;--ce-dim:#828a95;--ce-accent:#7c9fdd;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;font-size:12px;color:var(--ce-text)}
*{box-sizing:border-box;margin:0}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer;border-radius:4px}
button:hover{background:rgba(255,255,255,.07)}
button:focus-visible,.row:focus-visible{outline:2px solid var(--ce-accent);outline-offset:-2px}
.root{position:relative;display:flex;height:100%;background:var(--ce-bg);border:1px solid var(--ce-border);border-radius:6px;overflow:hidden;text-align:left}
.side{width:var(--side-w,200px);min-width:140px;background:var(--ce-panel);border-right:1px solid var(--ce-border);display:flex;flex-direction:column}
.side-head{display:flex;align-items:center;gap:2px;padding:6px 8px 5px 10px;font-size:10px;letter-spacing:.12em;color:var(--ce-dim)}
.side-head button{padding:3px;display:flex;color:var(--ce-dim)}
.side-head button:hover{color:var(--ce-text)}
.side-head svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.side-head .nf{margin-left:auto}
.tree{flex:1;overflow:auto;padding:2px 0 8px;user-select:none}
.row{display:flex;align-items:center;gap:6px;width:100%;padding:3px 8px;white-space:nowrap;text-align:left;border-radius:0;color:var(--ce-text)}
.row.act{background:rgba(124,159,221,.16)}
.row .chev{width:8px;height:8px;flex:none;border-right:1.5px solid var(--ce-dim);border-bottom:1.5px solid var(--ce-dim);transform:rotate(-45deg);transition:transform .12s}
.row.open .chev{transform:rotate(45deg)}
.row .dot{width:7px;height:7px;flex:none;border-radius:2px;background:var(--dot,#5a616b)}
.divider{width:4px;margin:0 -2px;cursor:col-resize;z-index:2;flex:none}
.divider:hover{background:rgba(124,159,221,.35)}
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.tabs{display:flex;align-items:stretch;background:var(--ce-panel);border-bottom:1px solid var(--ce-border);overflow-x:auto;scrollbar-width:thin;min-height:33px}
.tab{display:flex;align-items:center;gap:7px;padding:0 8px 0 12px;border-right:1px solid var(--ce-border);color:var(--ce-dim);white-space:nowrap;border-radius:0}
.tab.act{background:var(--ce-bg);color:var(--ce-text);box-shadow:inset 0 2px 0 var(--ce-accent)}
.tab .x{padding:1px 5px;border-radius:3px;font-size:12px;line-height:1}
.mode{margin-left:auto;display:flex;align-items:center;gap:2px;padding:0 8px}
.mode button{padding:3px 10px;color:var(--ce-dim)}
.mode button.act{background:rgba(124,159,221,.16);color:var(--ce-text)}
.mode .share{display:flex;align-items:center;gap:6px;padding:3px 10px;border:1px solid var(--ce-accent);color:var(--ce-accent)}
.mode .share:hover{background:rgba(124,159,221,.12)}
.mode .share svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.4;stroke-linecap:round;stroke-linejoin:round}
.body{flex:1;position:relative;min-height:0}
.editor{position:absolute;inset:0;display:none;overflow:auto;font:12.5px/1.55 'FontWithASyntaxHighlighter',ui-monospace,Menlo,Consolas,monospace}
.editor.on{display:grid;grid-template-columns:auto 1fr;align-items:start}
.gutter{position:sticky;left:0;padding:10px 12px 24px 16px;text-align:right;color:var(--ce-dim);background:var(--ce-bg);border-right:1px solid var(--ce-border);white-space:pre;user-select:none;font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;line-height:1.761}
.code{font:inherit;text-align:left;outline:none;caret-color:var(--ce-accent);padding:10px 24px 24px 16px;white-space:pre;tab-size:2;min-width:0}
.preview{position:absolute;inset:0;width:100%;height:100%;border:0;background:#fff;display:none}
.preview.on{display:block}
.center{position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;gap:10px;color:var(--ce-dim);text-align:center;padding:24px}
.center.on{display:flex}
.center img{max-width:85%;max-height:70%;object-fit:contain;border-radius:4px}
.drop-hint{border:1.5px dashed var(--ce-border);border-radius:8px;padding:36px 44px;display:flex;flex-direction:column;gap:12px;align-items:center}
.drop-hint b{color:var(--ce-text);font-weight:500;font-size:13px}
.btns{display:flex;gap:8px}
.btns button{border:1px solid var(--ce-accent);color:var(--ce-accent);padding:5px 14px}
.btns button:hover{background:rgba(124,159,221,.12)}
.status{display:flex;gap:14px;padding:4px 12px;border-top:1px solid var(--ce-border);background:var(--ce-panel);color:var(--ce-dim);font-size:11px}
.status .sp{flex:1}
.dropov{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(25,27,31,.85);border:2px dashed var(--ce-accent);border-radius:6px;color:var(--ce-accent);font-size:14px;z-index:9;pointer-events:none}
.dropov.on{display:flex}
.sharep,.npp,.delp{position:absolute;inset:0;display:none;align-items:center;justify-content:center;background:rgba(25,27,31,.72);z-index:10}
.sharep.on,.npp.on,.delp.on{display:flex}
.sharec{background:var(--ce-panel);border:1px solid var(--ce-border);border-radius:8px;padding:14px;width:min(540px,92%);display:flex;flex-direction:column;gap:10px}
.sharec b{font-weight:500;font-size:13px}
.sharec small{color:var(--ce-dim)}
.sharec textarea{height:150px;resize:none;background:var(--ce-bg);color:var(--ce-text);border:1px solid var(--ce-border);border-radius:4px;padding:8px;font:11px/1.5 ui-monospace,Menlo,Consolas,monospace;white-space:pre}
.sbtns{display:flex;gap:8px;justify-content:flex-end}
.sbtns button{border:1px solid var(--ce-accent);color:var(--ce-accent);padding:4px 14px}
.smode{display:flex;gap:2px}
.smode button{padding:3px 10px;color:var(--ce-dim)}
.smode button.act{background:rgba(124,159,221,.16);color:var(--ce-text)}
.tpl{background:var(--ce-bg);color:var(--ce-text);border:1px solid var(--ce-border);border-radius:4px;padding:6px;font:inherit}
.tree-in{margin:2px 8px;padding:3px 6px;background:var(--ce-bg);border:1px solid var(--ce-accent);border-radius:4px;color:var(--ce-text);font:11px ui-monospace,Menlo,Consolas,monospace;outline:none;width:calc(100% - 16px)}
.ctx{position:absolute;z-index:11;background:var(--ce-panel2);border:1px solid var(--ce-border);border-radius:6px;padding:4px;display:none;flex-direction:column;min-width:130px;box-shadow:0 8px 24px rgba(0,0,0,.5)}
.ctx.on{display:flex}
.ctx button{text-align:left;padding:5px 10px;white-space:nowrap}
::-webkit-scrollbar{width:10px;height:10px}
::-webkit-scrollbar-thumb{background:#3a3f47;border-radius:5px;border:2px solid var(--ce-bg)}
::-webkit-scrollbar-corner{background:transparent}`;

class CodeExplorer extends HTMLElement {
  static _font = null;
  static templates = {
    'Blank': { 'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <title>New project</title>\n</head>\n<body>\n\n</body>\n</html>' },
    'Static site': {
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Site</title>\n  <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n  <h1>Hello</h1>\n  <script src="js/app.js"></scr' + 'ipt>\n</body>\n</html>',
      'css/style.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}',
      'js/app.js': "console.log('ready');"
    },
    'Cocoon': {
      'index.html': '<!doctype html>\n<html lang="en">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <title>Cocoon App</title>\n  <link rel="stylesheet" href="src/applications/Main/index.css">\n</head>\n<body>\n  <div id="app"></div>\n  <script type="module" src="src/applications/Main/index.js"></scr' + 'ipt>\n</body>\n</html>',
      'src/applications/Main/index.js': "import '../../components/buttons/FancyButton/index.js';\n\nconst html = await fetch('src/applications/Main/index.html').then(r => r.text());\ndocument.getElementById('app').innerHTML = html;",
      'src/applications/Main/index.css': 'body {\n  font-family: system-ui, sans-serif;\n  margin: 2rem;\n}',
      'src/applications/Main/index.html': '<h1>Main application</h1>\n<fancy-button>Click me</fancy-button>',
      'src/components/buttons/FancyButton/index.js': "const base = 'src/components/buttons/FancyButton/';\nconst [html, css] = await Promise.all([\n  fetch(base + 'index.html').then(r => r.text()),\n  fetch(base + 'index.css').then(r => r.text())\n]);\n\nclass FancyButton extends HTMLElement {\n  connectedCallback() {\n    if (this.shadowRoot) return;\n    const root = this.attachShadow({ mode: 'open' });\n    root.innerHTML = '<style>' + css + '</style>' + html.replace('{{label}}', this.textContent.trim() || 'Button');\n  }\n}\ncustomElements.define('fancy-button', FancyButton);",
      'src/components/buttons/FancyButton/index.css': 'button {\n  padding: 8px 20px;\n  border: 1px solid #7c5cd6;\n  border-radius: 6px;\n  background: none;\n  color: #7c5cd6;\n  font: inherit;\n  cursor: pointer;\n}\nbutton:hover {\n  background: rgba(124, 92, 214, 0.08);\n}',
      'src/components/buttons/FancyButton/index.html': '<button>{{label}}</button>'
    }
  };
  static registerTemplate(name, files) { CodeExplorer.templates[name] = files; }
  static async encodePayload(obj) {
    const u8 = TE.encode(JSON.stringify(obj));
    const st = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    const out = new Uint8Array(await new Response(st).arrayBuffer());
    return b64(out).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  static async decodePayload(s) {
    const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
    const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return JSON.parse(TD.decode(await inflate(u8)));
  }
  constructor() {
    super();
    this.fs = new Map(); this.textCache = new Map();
    this.open = []; this.active = null; this.modes = new Map(); this.collapsed = new Set(); this.dirty = new Set(); this.emptyDirs = new Set();
    const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = `<style>${CSS}</style><div class="root"><aside class="side"><div class="side-head"><span>EXPLORER</span><button class="nf" title="New file" aria-label="New file"><svg viewBox="0 0 16 16"><path d="M12.5 6.5V14h-9V2h5.5z"></path><path d="M9 2v4.5h3.5"></path><path d="M8 8.5v3.5M6.2 10.2h3.6"></path></svg></button><button class="nd" title="New folder" aria-label="New folder"><svg viewBox="0 0 16 16"><path d="M1.5 3.5h4.2L7.5 5h7v8.5h-13z"></path><path d="M8 7.2v3.6M6.2 9h3.6"></path></svg></button><button class="new" title="New project from a template" aria-label="New project"><svg viewBox="0 0 16 16"><rect x="2.5" y="2.5" width="11" height="11" rx="2.5"></rect><path d="M8 5.4v5.2M5.4 8h5.2"></path></svg></button><button class="clear" title="Clear all files" aria-label="Clear all files"><svg viewBox="0 0 16 16"><path d="M2.5 4h11"></path><path d="M5.5 4V2.5h5V4"></path><path d="M4.2 4l.7 9.5h6.2l.7-9.5"></path></svg></button></div><div class="tree" role="tree"></div></aside><div class="divider"></div><main class="main"><div class="tabs"></div><div class="body"><div class="editor"><div class="gutter"></div><pre class="code"></pre></div><iframe class="preview" sandbox="allow-scripts" title="Preview"></iframe><div class="center empty on"><div class="drop-hint"><b>Drop a .zip or a folder here</b><span>Files stay in the page — nothing is uploaded.</span><div class="btns"><button class="pick-zip">Choose .zip</button><button class="pick-dir">Choose folder</button></div></div></div><div class="center imgview"></div><div class="center binview"></div></div><div class="status"></div></main><div class="sharep"><div class="sharec"><b>Embed this share</b><div class="smode"><button data-m="inline" class="act">Inline snippet</button><button data-m="iframe" title="Serves the files from this component's host origin — service-worker previews work on ANY page">Iframe (runs frameworks)</button></div><small class="ssize"></small><textarea readonly spellcheck="false"></textarea><small class="snote">Paste into any page that hosts code-explorer.js + the font side by side.</small><div class="sbtns"><button class="scopy">Copy</button><button class="sclose">Close</button></div></div></div><div class="npp"><div class="sharec"><b>New project</b><small>This trashes the current files and scaffolds from a template.</small><select class="tpl"></select><div class="sbtns"><button class="np-go">Create</button><button class="np-cancel">Cancel</button></div></div></div><div class="delp"><div class="sharec"><b class="del-msg"></b><div class="sbtns"><button class="del-go">Delete</button><button class="del-cancel">Cancel</button></div></div></div><div class="ctx"></div><div class="dropov">Drop to add files</div></div><input type="file" hidden class="in-zip" accept=".zip"><input type="file" hidden class="in-dir" webkitdirectory multiple>`;
    this.$ = s => r.querySelector(s);
    this._wire();
  }
  connectedCallback() {
    if (!CodeExplorer._font) {
      const url = this.getAttribute('font-src') || DEFAULT_FONT;
      const f = new FontFace('FontWithASyntaxHighlighter', `url("${url}")`);
      CodeExplorer._font = f.load().then(() => document.fonts.add(f)).catch(() => {});
    }
    if (this._booted) return; this._booted = true;
    const boot = () => {
      this._openAttr = this.getAttribute('open');
      const sc = this.querySelector('script[type="application/json"]');
      if (sc) { try { this._payload(JSON.parse(sc.textContent)); } catch (err) { console.warn('code-explorer: bad inline JSON payload', err); } }
      const src = this.getAttribute('src');
      if (src) this.loadURL(src);
      const ts = this.getAttribute('templates-src');
      if (ts) fetch(ts).then(r => r.json()).then(o => Object.assign(CodeExplorer.templates, o)).catch(err => console.warn('code-explorer: failed to load templates', ts, err));
    };
    document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot, { once: true }) : boot();
  }
  _wire() {
    const root = this.$('.root');
    this.shadowRoot.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this._save(); } });
    let dragDepth = 0;
    root.addEventListener('dragover', e => { e.preventDefault(); });
    root.addEventListener('dragenter', e => { e.preventDefault(); if (++dragDepth === 1) this.$('.dropov').classList.add('on'); });
    root.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; this.$('.dropov').classList.remove('on'); } });
    root.addEventListener('drop', e => { e.preventDefault(); dragDepth = 0; this.$('.dropov').classList.remove('on'); this._handleDrop(e.dataTransfer); });
    this.$('.clear').onclick = () => this.clear();
    this.$('.new').onclick = () => this._newProjectDialog();
    this.$('.np-cancel').onclick = () => this.$('.npp').classList.remove('on');
    this.$('.np-go').onclick = () => { this.$('.npp').classList.remove('on'); this.newProject(this.$('.tpl').value); };
    this.$('.del-cancel').onclick = () => this.$('.delp').classList.remove('on');
    this.$('.nf').onclick = () => this._newEntry('file');
    this.$('.nd').onclick = () => this._newEntry('folder');
    const ctx = this.$('.ctx');
    this.$('.tree').addEventListener('contextmenu', e => {
      e.preventDefault();
      const row = e.target.closest('.row'), items = [];
      if (row && row.dataset.path) { const p = row.dataset.path; items.push(['Rename', () => this._renameInline(p)], ['Delete', () => this._confirmDelete(p, false)]); }
      else if (row && row.dataset.dir) { const d = row.dataset.dir; items.push(['New file', () => this._newEntry('file', d + '/')], ['New folder', () => this._newEntry('folder', d + '/')], ['Rename', () => this._renameInline(d)], ['Delete', () => this._confirmDelete(d, true)]); }
      else items.push(['New file', () => this._newEntry('file')], ['New folder', () => this._newEntry('folder')]);
      ctx.textContent = '';
      for (const [label, fn] of items) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { ctx.classList.remove('on'); fn(); }; ctx.appendChild(b); }
      const r = this.$('.root').getBoundingClientRect();
      ctx.style.left = Math.max(0, Math.min(e.clientX - r.left, r.width - 150)) + 'px';
      ctx.style.top = Math.max(0, Math.min(e.clientY - r.top, r.height - items.length * 28 - 12)) + 'px';
      ctx.classList.add('on');
    });
    this.shadowRoot.addEventListener('pointerdown', e => { if (!e.composedPath().includes(ctx)) ctx.classList.remove('on'); });
    const code = this.$('.code');
    code.spellcheck = false;
    code.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '\t'); } });
    code.addEventListener('input', () => {
      const p = this.active; if (!p || this._truncated) return;
      const text = code.textContent;
      this.fs.set(p, TE.encode(text)); this.textCache.set(p, text);
      const n = text.split('\n').length;
      if (n !== this._lineCount) { this._lineCount = n; this.$('.gutter').textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n'); }
      if (!this.dirty.has(p)) { this.dirty.add(p); this._renderTabs(); }
      this._renderStatus();
      this.dispatchEvent(new CustomEvent('file-edited', { detail: { path: p } }));
    });
    this._openShare = () => {
      if (!this.fs.size) return;
      const ta = this.$('.sharec textarea'), note = this.$('.snote');
      const fill = async mode => {
        for (const b of this.shadowRoot.querySelectorAll('.smode button')) b.classList.toggle('act', b.dataset.m === mode);
        if (mode === 'inline') { ta.value = this.getEmbedHTML(); note.textContent = 'Paste into any page that hosts code-explorer.js + the font side by side.'; }
        else { ta.value = '…'; ta.value = await this.getIframeEmbedHTML(); note.textContent = 'Works on ANY page as-is — previews are served from this component\u2019s host origin (host embed.html + code-explorer-sw.js there, https).'; }
        this.$('.ssize').textContent = `${this.fs.size} files · ${kb(ta.value.length)} of embed code`;
      };
      for (const b of this.shadowRoot.querySelectorAll('.smode button')) b.onclick = () => fill(b.dataset.m);
      fill('inline');
      this.$('.sharep').classList.add('on');
    };
    this.$('.sclose').onclick = () => this.$('.sharep').classList.remove('on');
    this.$('.scopy').onclick = e => {
      const ta = this.$('.sharec textarea'); ta.select();
      (navigator.clipboard ? navigator.clipboard.writeText(ta.value) : Promise.reject()).catch(() => document.execCommand('copy'));
      e.target.textContent = 'Copied!'; setTimeout(() => e.target.textContent = 'Copy', 1200);
    };
    this.$('.pick-zip').onclick = () => this.$('.in-zip').click();
    this.$('.pick-dir').onclick = () => this.$('.in-dir').click();
    this.$('.in-zip').onchange = async e => { const f = e.target.files[0]; if (f) await this.loadZip(f); e.target.value = ''; };
    this.$('.in-dir').onchange = e => {
      const files = {};
      const jobs = [...e.target.files].map(f => f.arrayBuffer().then(b => { files[(f.webkitRelativePath || f.name).replace(/\\/g, '/')] = new Uint8Array(b); }));
      Promise.all(jobs).then(() => this._merge(files));
      e.target.value = '';
    };
    const div = this.$('.divider');
    div.addEventListener('pointerdown', e => {
      div.setPointerCapture(e.pointerId);
      const x0 = e.clientX, w0 = this.$('.side').getBoundingClientRect().width;
      const mv = ev => root.style.setProperty('--side-w', Math.max(140, Math.min(480, w0 + ev.clientX - x0)) + 'px');
      div.addEventListener('pointermove', mv);
      div.addEventListener('pointerup', () => div.removeEventListener('pointermove', mv), { once: true });
    });
  }
  async _handleDrop(dt) {
    const items = dt.items ? [...dt.items] : [];
    const entries = items.map(i => i.webkitGetAsEntry && i.webkitGetAsEntry()).filter(Boolean);
    const files = {};
    if (entries.length) {
      for (const en of entries) {
        if (en.isFile && /\.zip$/i.test(en.name)) {
          await new Promise(res => en.file(async f => { Object.assign(files, await parseZip(await f.arrayBuffer()).catch(() => ({}))); res(); }, res));
        } else await readEntryTree(en, '', files);
      }
    } else for (const f of dt.files) {
      if (/\.zip$/i.test(f.name)) Object.assign(files, await parseZip(await f.arrayBuffer()).catch(() => ({})));
      else files[f.name] = new Uint8Array(await f.arrayBuffer());
    }
    this._merge(files);
  }
  // ---- public API ----
  setFiles(obj) {
    const files = {};
    for (const [p, v] of Object.entries(obj)) files[p] = typeof v === 'string' ? TE.encode(v) : v instanceof Uint8Array ? v : new Uint8Array(v);
    this._merge(files, true);
  }
  async loadZip(src) {
    const buf = src instanceof ArrayBuffer ? src : await src.arrayBuffer();
    this._merge(await parseZip(buf));
  }
  async loadURL(url) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(r.status);
      const ct = r.headers.get('content-type') || '';
      if (/json/i.test(ct) || /\.json([?#]|$)/i.test(url)) this._payload(await r.json());
      else await this.loadZip(await r.arrayBuffer());
    } catch (err) { console.warn('code-explorer: failed to load', url, err); }
  }
  _payload(obj) {
    const files = {};
    for (const [p, v] of Object.entries(obj)) {
      if (typeof v === 'string') files[p] = TE.encode(v);
      else if (v && typeof v.b64 === 'string') { const bin = atob(v.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); files[p] = u; }
    }
    this._merge(files, true);
  }
  loadPayload(obj) { if (obj && obj.files) { this._payload(obj.files); if (obj.open && this.fs.has(obj.open)) this._openFile(obj.open); } else this._payload(obj); }
  getFiles() { const o = {}; for (const p of this.fs.keys()) o[p] = this._isText(p) ? this._text(p) : { b64: b64(this.fs.get(p)) }; return o; }
  getEmbedHTML() {
    const json = JSON.stringify(this.getFiles()).replace(/<\//g, '<\\/');
    return `<script src="code-explorer.js"><\/script>\n<code-explorer style="display:block;height:480px"${this.active ? ` open="${this.active}"` : ''}>\n<script type="application/json">${json}<\/script>\n</code-explorer>`;
  }
  _save() {
    this.dirty.clear(); this._renderTabs();
    const pv = this.$('.preview');
    if (pv.classList.contains('on') && this.active && /\.html?$/i.test(this.active) && this.modes.get(this.active) === 'preview') this._showPreview(this.active);
    this._flash = '✓ saved'; this._renderStatus();
    clearTimeout(this._flashT); this._flashT = setTimeout(() => { this._flash = null; this._renderStatus(); }, 1500);
    this.dispatchEvent(new CustomEvent('files-saved'));
  }
  // ---- file operations ----
  createFile(path, content = '') {
    path = path.replace(/^\/+|\/+$/g, ''); if (!path) return;
    this.fs.set(path, typeof content === 'string' ? TE.encode(content) : content instanceof Uint8Array ? content : new Uint8Array(content));
    this.textCache.delete(path);
    for (const d of [...this.emptyDirs]) if (path.startsWith(d + '/')) this.emptyDirs.delete(d);
    this._openFile(path);
    this.dispatchEvent(new CustomEvent('files-changed', { detail: { count: this.fs.size } }));
  }
  renamePath(oldP, newP) {
    oldP = oldP.replace(/^\/+|\/+$/g, ''); newP = newP.replace(/^\/+|\/+$/g, '');
    if (!newP || oldP === newP) return;
    const mv = p => p === oldP ? newP : p.startsWith(oldP + '/') ? newP + p.slice(oldP.length) : p;
    this.fs = new Map([...this.fs].map(([p, v]) => [mv(p), v]));
    this.textCache = new Map([...this.textCache].map(([p, v]) => [mv(p), v]));
    this.modes = new Map([...this.modes].map(([p, v]) => [mv(p), v]));
    this.dirty = new Set([...this.dirty].map(mv));
    this.emptyDirs = new Set([...this.emptyDirs].map(mv));
    this.open = this.open.map(mv);
    if (this.active) this.active = mv(this.active);
    this._renderAll();
    this.dispatchEvent(new CustomEvent('files-changed', { detail: { count: this.fs.size } }));
  }
  deletePath(p) {
    p = p.replace(/^\/+|\/+$/g, '');
    const gone = q => q === p || q.startsWith(p + '/');
    for (const q of [...this.fs.keys()]) if (gone(q)) { this.fs.delete(q); this.textCache.delete(q); this.dirty.delete(q); this.modes.delete(q); }
    for (const d of [...this.emptyDirs]) if (gone(d)) this.emptyDirs.delete(d);
    this.open = this.open.filter(q => !gone(q));
    if (this.active && gone(this.active)) this.active = this.open[0] || null;
    this._renderAll();
    this.dispatchEvent(new CustomEvent('files-changed', { detail: { count: this.fs.size } }));
  }
  newProject(name) { const t = CodeExplorer.templates[name]; if (!t) return; this.clear(); this._payload(t); }
  _newProjectDialog() {
    const sel = this.$('.tpl'); sel.textContent = '';
    for (const n of Object.keys(CodeExplorer.templates)) { const o = document.createElement('option'); o.value = o.textContent = n; sel.appendChild(o); }
    this.$('.npp').classList.add('on');
  }
  _treeInput(value, selStart, onCommit) {
    const inp = document.createElement('input');
    inp.className = 'tree-in'; inp.value = value; inp.spellcheck = false;
    this.$('.tree').prepend(inp); inp.focus(); inp.setSelectionRange(selStart, value.length);
    let closed = false;
    const done = c => { if (closed) return; closed = true; const v = inp.value.trim().replace(/^\/+|\/+$/g, ''); inp.remove(); if (c && v) onCommit(v); };
    inp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); };
    inp.onblur = () => done(false);
  }
  _newEntry(kind, prefix = '') {
    this._treeInput(prefix, prefix.length, v => {
      if (kind === 'file') this.createFile(v, '');
      else { this.emptyDirs.add(v); this._renderAll(); }
    });
  }
  _renameInline(p) { this._treeInput(p, p.lastIndexOf('/') + 1, v => v !== p && this.renamePath(p, v)); }
  _confirmDelete(p, isDir) {
    const n = isDir ? [...this.fs.keys()].filter(q => q === p || q.startsWith(p + '/')).length : 1;
    this.$('.del-msg').textContent = `Delete ${p}${isDir && n ? ` (${n} file${n === 1 ? '' : 's'})` : ''}?`;
    this.$('.del-go').onclick = () => { this.$('.delp').classList.remove('on'); this.deletePath(p); };
    this.$('.delp').classList.add('on');
  }
  async getIframeEmbedHTML() {
    const d = await CodeExplorer.encodePayload({ files: this.getFiles(), open: this.active });
    const u = new URL('embed.html', SCRIPT_URL || location.href).href;
    return `<iframe src="${u}#d=${d}" style="display:block;width:100%;height:520px;border:1px solid #2e3238;border-radius:6px" loading="lazy"></iframe>`;
  }
  clear() {
    this.fs.clear(); this.textCache.clear(); this.open = []; this.active = null; this.modes.clear(); this.collapsed.clear(); this.dirty.clear(); this.emptyDirs.clear();
    this._renderAll();
  }
  // ---- state ----
  _merge(files, keepRoot) {
    let paths = Object.keys(files).filter(p => !HIDDEN(p));
    let deps = null; // node_modules: only packages in package.json "dependencies"
    const getDeps = () => {
      if (deps) return deps;
      try {
        const key = Object.keys(files).filter(k => /(^|\/)package\.json$/.test(k) && !k.includes('node_modules')).sort((a, b) => a.split('/').length - b.split('/').length)[0];
        const raw = key ? TD.decode(files[key]) : this.fs.has('package.json') ? this._text('package.json') : null;
        deps = new Set(raw ? Object.keys(JSON.parse(raw).dependencies || {}) : []);
      } catch (e) { deps = new Set(); }
      return deps;
    };
    paths = paths.filter(p => {
      const segs = p.split('/'), i = segs.indexOf('node_modules');
      if (i === -1) return true;
      const pkg = segs[i + 1] && segs[i + 1][0] === '@' ? segs[i + 1] + '/' + segs[i + 2] : segs[i + 1];
      return !!pkg && getDeps().has(pkg);
    });
    if (!paths.length) return;
    if (!keepRoot && !this.fs.size) { // strip a single shared root folder
      const roots = new Set(paths.map(p => p.split('/')[0]));
      if (roots.size === 1 && paths[0].includes('/')) {
        const cut = paths[0].split('/')[0].length + 1;
        const nf = {}; for (const p of paths) nf[p.slice(cut)] = files[p];
        files = nf; paths = Object.keys(nf);
      }
    }
    for (const p of paths) { this.fs.set(p.replace(/^\/+/, ''), files[p]); this.textCache.delete(p); }
    for (const d of [...this.emptyDirs]) for (const p of paths) if (p.startsWith(d + '/')) { this.emptyDirs.delete(d); break; }
    if (this._openAttr && this.fs.has(this._openAttr)) { const p = this._openAttr; this._openAttr = null; this._openFile(p); }
    else if (!this.active) {
      const first = [...this.fs.keys()].find(p => /^(index|readme)\.(html?|md)$/i.test(p.split('/').pop())) || [...this.fs.keys()].find(p => this._isText(p)) || paths[0];
      if (first) this._openFile(first);
    }
    this._renderAll();
    this.dispatchEvent(new CustomEvent('files-changed', { detail: { count: this.fs.size } }));
  }
  _isText(p) { const u8 = this.fs.get(p); if (!u8) return false; if (IMG_EXT[ext(p)]) return false; const n = Math.min(u8.length, 2048); for (let i = 0; i < n; i++) if (u8[i] === 0) return false; return true; }
  _text(p) { if (!this.textCache.has(p)) this.textCache.set(p, TD.decode(this.fs.get(p))); return this.textCache.get(p); }
  _openFile(p) {
    if (!this.open.includes(p)) this.open.push(p);
    this.active = p;
    if (!this.modes.has(p)) this.modes.set(p, 'code');
    this._renderAll();
  }
  _closeTab(p) {
    const i = this.open.indexOf(p); if (i > -1) this.open.splice(i, 1);
    if (this.active === p) this.active = this.open[Math.min(i, this.open.length - 1)] || null;
    this._renderAll();
  }
  // ---- render ----
  _renderAll() { this._renderTree(); this._renderTabs(); this._renderBody(); this._renderStatus(); }
  _renderTree() {
    const tree = this.$('.tree'); tree.textContent = '';
    if (!this.fs.size && !this.emptyDirs.size) { return; }
    const rootN = { dirs: new Map(), files: [] };
    const ensure = parts => { let n = rootN; for (const seg of parts) { if (!n.dirs.has(seg)) n.dirs.set(seg, { dirs: new Map(), files: [] }); n = n.dirs.get(seg); } return n; };
    for (const p of [...this.fs.keys()].sort()) {
      const parts = p.split('/');
      ensure(parts.slice(0, -1)).files.push(p);
    }
    for (const d of [...this.emptyDirs].sort()) ensure(d.split('/'));
    const mk = (n, depth, prefix) => {
      for (const [name, sub] of [...n.dirs].sort((a, b) => a[0].localeCompare(b[0]))) {
        const dp = prefix + name, isOpen = !this.collapsed.has(dp);
        const b = document.createElement('button');
        b.className = 'row' + (isOpen ? ' open' : ''); b.style.paddingLeft = 8 + depth * 13 + 'px'; b.dataset.dir = dp;
        b.innerHTML = `<span class="chev"></span><span></span>`; b.lastChild.textContent = name;
        b.onclick = () => { isOpen ? this.collapsed.add(dp) : this.collapsed.delete(dp); this._renderTree(); };
        tree.appendChild(b);
        if (isOpen) mk(sub, depth + 1, dp + '/');
      }
      for (const p of n.files) {
        const name = p.split('/').pop();
        const b = document.createElement('button');
        b.className = 'row' + (p === this.active ? ' act' : ''); b.style.paddingLeft = 8 + depth * 13 + 'px'; b.dataset.path = p;
        b.innerHTML = `<span class="dot"></span><span></span>`; b.lastChild.textContent = name;
        b.firstChild.style.setProperty('--dot', DOT[ext(p)] || '#5a616b');
        b.onclick = () => this._openFile(p);
        tree.appendChild(b);
      }
    };
    mk(rootN, 0, '');
  }
  _renderTabs() {
    const tabs = this.$('.tabs'); tabs.textContent = '';
    for (const p of this.open) {
      const t = document.createElement('button');
      t.className = 'tab' + (p === this.active ? ' act' : '');
      const nm = document.createElement('span'); nm.textContent = (this.dirty.has(p) ? '● ' : '') + p.split('/').pop();
      const x = document.createElement('span'); x.className = 'x'; x.textContent = '×'; x.title = 'Close';
      x.onclick = e => { e.stopPropagation(); this._closeTab(p); };
      t.append(nm, x); t.onclick = () => this._openFile(p); t.title = p;
      tabs.appendChild(t);
    }
    const m = document.createElement('div'); m.className = 'mode';
    if (this.active && /\.html?$/i.test(this.active)) {
      for (const md of ['code', 'preview']) {
        const b = document.createElement('button');
        b.textContent = md === 'code' ? 'Code' : 'Preview';
        b.className = this.modes.get(this.active) === md ? 'act' : '';
        b.onclick = () => { this.modes.set(this.active, md); this._renderAll(); };
        m.appendChild(b);
      }
    }
    if (this.fs.size) {
      const s = document.createElement('button');
      s.className = 'share'; s.title = 'Copy an embeddable share of these files'; s.setAttribute('aria-label', 'Share');
      s.innerHTML = '<svg viewBox="0 0 16 16"><path d="M8 10V1.8"></path><path d="M5 4.6L8 1.6l3 3"></path><path d="M3 8v6h10V8"></path></svg><span>Share</span>';
      s.onclick = () => this._openShare();
      m.appendChild(s);
    }
    if (m.childElementCount) tabs.appendChild(m);
  }
  _renderBody() {
    const ed = this.$('.editor'), pv = this.$('.preview'), im = this.$('.imgview'), bn = this.$('.binview'), em = this.$('.empty');
    ed.classList.remove('on'); pv.classList.remove('on'); im.classList.remove('on'); bn.classList.remove('on'); em.classList.remove('on');
    im.textContent = ''; bn.textContent = '';
    if (!pv.classList.contains('on')) { pv.removeAttribute('srcdoc'); pv.removeAttribute('src'); }
    if (!this.fs.size) { em.classList.add('on'); return; }
    const p = this.active;
    if (!p) return;
    const e = ext(p);
    if (/\.html?$/i.test(p) && this.modes.get(p) === 'preview') { this._showPreview(p); pv.classList.add('on'); return; }
    if (IMG_EXT[e] || (e === 'svg' && this.modes.get(p) === 'preview')) {
      const img = document.createElement('img');
      img.src = `data:${MIME[e]};base64,${b64(this.fs.get(p))}`;
      const cap = document.createElement('span'); cap.textContent = `${p} · ${kb(this.fs.get(p).length)}`;
      im.append(img, cap); im.classList.add('on'); return;
    }
    if (!this._isText(p)) {
      const s = document.createElement('span'); s.textContent = `${p.split('/').pop()} — binary file, ${kb(this.fs.get(p).length)}`;
      bn.append(s); bn.classList.add('on'); return;
    }
    const text = this._text(p), MAXL = 8000;
    let lines = text.split('\n'), truncated = false;
    if (lines.length > MAXL) { lines = lines.slice(0, MAXL); truncated = true; }
    this.$('.gutter').textContent = lines.map((_, i) => i + 1).join('\n');
    this.$('.code').textContent = lines.join('\n') + (truncated ? '\n… (truncated)' : '');
    this._truncated = truncated; this._lineCount = lines.length;
    const codeEl = this.$('.code');
    try { codeEl.contentEditable = truncated ? 'false' : 'plaintext-only'; } catch (e) { codeEl.contentEditable = truncated ? 'false' : 'true'; }
    ed.classList.add('on');
    ed.scrollTop = 0; ed.scrollLeft = 0;
  }
  _renderStatus() {
    const st = this.$('.status'); st.textContent = '';
    const add = t => { const s = document.createElement('span'); s.textContent = t; st.appendChild(s); };
    add(`${this.fs.size} file${this.fs.size === 1 ? '' : 's'}`);
    const sp = document.createElement('span'); sp.className = 'sp'; st.appendChild(sp);
    if (this.active && this.fs.has(this.active)) {
      add(this.active);
      if (this._isText(this.active)) add(this._text(this.active).split('\n').length + ' lines');
      add(kb(this.fs.get(this.active).length));
      if (/\.html?$/i.test(this.active) && this.modes.get(this.active) === 'preview' && this._pvMode) add('engine: ' + this._pvMode);
    }
    if (this._flash) add(this._flash);
  }
  // ---- preview: virtual engine (in-iframe bootstrap) with service-worker auto-upgrade ----
  _initSW() {
    if (CodeExplorer._sw !== undefined) return CodeExplorer._sw;
    if (!('serviceWorker' in navigator) || !window.isSecureContext || !SCRIPT_URL) return CodeExplorer._sw = Promise.resolve(null);
    const swURL = new URL('code-explorer-sw.js', SCRIPT_URL).href;
    return CodeExplorer._sw = fetch(swURL, { method: 'HEAD' }).then(r => {
      if (!r.ok || !/javascript|ecmascript/i.test(r.headers.get('content-type') || '')) return null;
      return navigator.serviceWorker.register(swURL).catch(() => null);
    }).catch(() => null);
  }
  async _showPreview(p) {
    const token = this._pvToken = (this._pvToken || 0) + 1;
    const pv = this.$('.preview');
    const reg = await this._initSW();
    const stale = () => this._pvToken !== token || this.active !== p || this.modes.get(p) !== 'preview';
    if (stale()) return;
    if (reg) {
      try {
        await new Promise((res, rej) => {
          if (reg.active) return res();
          const w = reg.installing || reg.waiting; if (!w) return rej();
          w.addEventListener('statechange', () => w.state === 'activated' ? res() : (w.state === 'redundant' && rej()));
          setTimeout(rej, 4000);
        });
        const id = CodeExplorer._sid || (CodeExplorer._sid = Math.random().toString(36).slice(2));
        const base = new URL(`__ce/${id}/`, SCRIPT_URL).href;
        const files = {}; for (const k of this.fs.keys()) files[k] = { m: MIME[ext(k)] || 'application/octet-stream', d: this.fs.get(k) };
        await new Promise((res, rej) => {
          const on = e => { if (e.data && e.data.type === 'ce-vfs-ready' && e.data.id === id) { navigator.serviceWorker.removeEventListener('message', on); res(); } };
          navigator.serviceWorker.addEventListener('message', on);
          reg.active.postMessage({ type: 'ce-vfs', id, base, files });
          setTimeout(() => { navigator.serviceWorker.removeEventListener('message', on); rej(); }, 4000);
        });
        if (stale()) return;
        pv.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-modals allow-forms allow-popups');
        pv.removeAttribute('srcdoc'); pv.src = base + p + '?t=' + Date.now();
        this._pvMode = 'service worker'; this._renderStatus();
        return;
      } catch (err) { /* fall through to virtual engine */ }
    }
    if (stale()) return;
    pv.setAttribute('sandbox', 'allow-scripts allow-modals allow-forms allow-popups');
    pv.removeAttribute('src');
    const filesJ = {}; for (const k of this.fs.keys()) filesJ[k] = this._isText(k) ? { t: this._text(k) } : { b: b64(this.fs.get(k)) };
    const json = JSON.stringify({ files: filesJ, entry: p, mime: MIME }).replace(/</g, '\\u003c');
    pv.srcdoc = `<!doctype html><!--${Date.now()}--><html><head><meta charset="utf-8"></head><body><script>(${__ceBoot})(${json})<\/script></body></html>`;
    this._pvMode = 'virtual'; this._renderStatus();
  }
}
customElements.define('code-explorer', CodeExplorer);
})();
