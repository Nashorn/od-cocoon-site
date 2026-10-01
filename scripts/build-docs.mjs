// Content compiler only. Website layout and deployment belong to a future renderer.
import { readFile, writeFile, mkdir, rename, unlink, realpath } from 'node:fs/promises';
import { resolve, dirname, relative, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { Marked } from 'marked';

const repository = fileURLToPath(new URL('../', import.meta.url));
const hash = value => createHash('sha256').update(value).digest('hex');
const fail = message => { throw new Error(message); };
const requireThat = (condition, message) => { if (!condition) fail(message); };
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const decode = value => value.replace(/&(#x[\da-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (whole, entity) => {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
  return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
});
function plain(token) {
  if (Array.isArray(token)) return token.map(plain).join(' ');
  if (token.type === 'table') return plain([...token.header, ...token.rows.flat()]);
  if (token.items) return plain(token.items);
  if (token.tokens) return token.tokens.map(plain).join('');
  if (token.type === 'html') return decode(token.text.replace(/<[^>]*>/g, ''));
  return decode(token.text || '');
}
const clean = value => value.replace(/\s+/g, ' ').trim();
const slug = title => title.toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-') || 'section';
const routePattern = /^\/documentation(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;

function validateManifest(manifest) {
  requireThat(manifest?.schemaVersion === 1, 'manifest: schemaVersion must be 1');
  requireThat(Array.isArray(manifest.documents) && manifest.documents.length, 'manifest: documents must be a nonempty array');
  requireThat(Array.isArray(manifest.navigation) && manifest.navigation.length, 'manifest: navigation must be a nonempty array');
  const ids = new Set(), sources = new Set(), routes = new Set();
  for (const doc of manifest.documents) {
    requireThat(typeof doc.id === 'string' && /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(doc.id), 'manifest: invalid document ID');
    requireThat(!ids.has(doc.id), `manifest: duplicate ID ${doc.id}`); ids.add(doc.id);
    requireThat(typeof doc.source === 'string' && doc.source.endsWith('.md') && !doc.source.includes('\\') && !doc.source.startsWith('/') && doc.source === posix.normalize(doc.source) && !doc.source.startsWith('../'), `${doc.id}: source must be a normalized Markdown path inside docs`);
    requireThat(!sources.has(doc.source), `manifest: duplicate source ${doc.source}`); sources.add(doc.source);
    requireThat(typeof doc.route === 'string' && routePattern.test(doc.route), `${doc.id}: invalid documentation route`);
    requireThat(!routes.has(doc.route), `manifest: duplicate route ${doc.route}`); routes.add(doc.route);
    requireThat(typeof doc.title === 'string' && doc.title.trim(), `${doc.id}: title is required`);
    requireThat(Array.isArray(doc.related), `${doc.id}: related must be an array`);
  }
  requireThat(routes.has('/documentation'), 'manifest: /documentation landing route is required');
  for (const doc of manifest.documents) {
    const seen = new Set();
    for (const id of doc.related) {
      requireThat(ids.has(id), `${doc.id}: unknown related document ${id}`);
      requireThat(id !== doc.id && !seen.has(id), `${doc.id}: self or duplicate related document ${id}`); seen.add(id);
    }
  }
  const placed = new Set(), groups = new Set();
  for (const group of manifest.navigation) {
    requireThat(typeof group.id === 'string' && group.id && !groups.has(group.id), 'manifest: missing or duplicate navigation group ID'); groups.add(group.id);
    requireThat(typeof group.label === 'string' && group.label.trim(), `${group.id}: navigation label is required`);
    requireThat(Array.isArray(group.documents) && group.documents.length, `${group.id}: navigation documents must be a nonempty array`);
    for (const id of group.documents) {
      requireThat(ids.has(id), `${group.id}: unknown navigation document ${id}`);
      requireThat(!placed.has(id), `manifest: duplicate navigation placement ${id}`); placed.add(id);
    }
  }
  for (const id of ids) requireThat(placed.has(id), `${id}: missing navigation placement`);
}

/** Compile every allowlisted source in memory; validation completes before any output write. */
export async function compileDocumentation({ docsDir = resolve(repository, 'docs') } = {}) {
  const root = await realpath(docsDir);
  const manifestText = await readFile(resolve(root, 'manifest.json'), 'utf8');
  const manifest = JSON.parse(manifestText);
  validateManifest(manifest);
  const engine = new Marked();
  const records = [];
  for (const entry of manifest.documents) {
    const file = await realpath(resolve(root, entry.source)).catch(error => fail(`${entry.id}: cannot read ${entry.source}: ${error.code}`));
    const rel = relative(root, file);
    requireThat(rel && rel !== '..' && !rel.startsWith('..' + sep) && !rel.startsWith(sep), `${entry.id}: source escapes docs directory`);
    const markdown = await readFile(file, 'utf8');
    const tokens = engine.lexer(markdown);
    const headings = [], used = new Set();
    engine.walkTokens(tokens, token => {
      if (token.type === 'heading') {
        const title = clean(plain(token));
        const base = slug(title); let id = base, suffix = 1;
        while (used.has(id)) id = `${base}-${suffix++}`;
        used.add(id); token.docAnchor = id;
        headings.push({ id, title, depth: token.depth });
      }
      // Raw navigation bypasses the Markdown resolver. Keep links in Markdown syntax.
      if (token.type === 'html') requireThat(!/<(?:a|img|iframe|script)\b|\b(?:id|name)\s*=/i.test(token.text), `${entry.source}: use Markdown links/headings; raw navigation, embeds, and custom anchors are unsupported`);
    });
    requireThat(headings.filter(h => h.depth === 1).length === 1 && tokens.find(t => t.type !== 'space')?.type === 'heading' && tokens.find(t => t.type !== 'space')?.depth === 1, `${entry.source}: start with exactly one H1`);
    records.push({ ...entry, markdown, tokens, headings, sourceHash: hash(markdown), links: [] });
  }
  const bySource = new Map(records.map(d => [d.source, d]));
  const byId = new Map(records.map(d => [d.id, d]));
  const byRoute = new Map(records.map(d => [d.route, d]));
  function resolveLink(doc, href) {
    requireThat(typeof href === 'string' && href.trim(), `${doc.source}: empty link`);
    if (/^(?:https?:|mailto:|tel:|\/\/)/i.test(href)) return href;
    requireThat(!/^[a-z][a-z\d+.-]*:/i.test(href), `${doc.source}: unsupported link scheme ${href}`);
    const match = href.match(/^([^?#]*)(\?[^#]*)?(?:#(.*))?$/);
    requireThat(match, `${doc.source}: invalid link ${href}`);
    const [, path, query = '', fragment] = match;
    let decodedPath, anchor;
    try { decodedPath = decodeURIComponent(path); anchor = fragment === undefined ? undefined : decodeURIComponent(fragment); }
    catch { fail(`${doc.source}: invalid URL encoding in ${href}`); }
    let target;
    if (!path) target = doc;
    else if (decodedPath.startsWith('/')) {
      if (!/^\/documentation(?:\/|$)/.test(decodedPath)) return href; // Existing site routes remain site-owned.
      target = byRoute.get(decodedPath);
    } else target = bySource.get(posix.normalize(posix.join(posix.dirname(doc.source), decodedPath)));
    requireThat(target, `${doc.source}: link target is not in manifest: ${href}`);
    if (anchor) requireThat(target.headings.some(h => h.id === anchor), `${doc.source}: missing heading #${anchor} in ${target.source}`);
    const url = target.route + query + (anchor ? '#' + encodeURIComponent(anchor) : '');
    doc.links.push({ id: target.id, anchor: anchor || null, url });
    return url;
  }
  const documents = {}, search = [];
  const linkSummary = doc => ({ id: doc.id, title: doc.title, route: doc.route });
  const order = manifest.navigation.flatMap(g => g.documents);
  const landing = byRoute.get('/documentation');
  for (const doc of records) {
    engine.walkTokens(doc.tokens, token => {
      if (token.type === 'link') token.href = resolveLink(doc, token.href);
      if (token.type === 'image') requireThat(/^https?:\/\//.test(token.href) || token.href.startsWith('/') && !token.href.startsWith('//'), `${doc.source}: images must use an absolute site asset path or HTTPS URL`);
    });
    const renderer = new Marked({ renderer: {
      heading(token) { return `<h${token.depth} id="${escape(token.docAnchor)}">${this.parser.parseInline(token.tokens)}</h${token.depth}>\n`; },
    } });
    const bodyHtml = renderer.parser(doc.tokens);
    const group = manifest.navigation.find(g => g.documents.includes(doc.id));
    const position = order.indexOf(doc.id);
    const uniqueLinks = [...new Map(doc.links.map(link => [JSON.stringify(link), link])).values()];
    documents[doc.id] = {
      ...linkSummary(doc), source: doc.source, sourceHash: doc.sourceHash,
      heading: doc.headings[0].title, bodyHtml,
      toc: doc.headings.filter(h => h.depth > 1).map(h => ({ ...h, url: doc.route + '#' + encodeURIComponent(h.id) })),
      breadcrumbs: doc.id === landing.id ? [linkSummary(doc)] : [linkSummary(landing), { id: group.id, title: group.label }, linkSummary(doc)],
      previous: position ? linkSummary(byId.get(order[position - 1])) : null,
      next: position + 1 < order.length ? linkSummary(byId.get(order[position + 1])) : null,
      related: doc.related.map(id => linkSummary(byId.get(id))), links: uniqueLinks,
    };
    let section;
    for (const token of doc.tokens) {
      if (token.type === 'heading') {
        section = { documentId: doc.id, title: doc.title, heading: clean(plain(token)), url: doc.route + (token.depth === 1 ? '' : '#' + encodeURIComponent(token.docAnchor)), text: '' };
        search.push(section);
      } else if (section) section.text = clean(section.text + ' ' + plain(token));
    }
  }
  const generatorHash = hash(await readFile(fileURLToPath(import.meta.url)));
  const markedVersion = JSON.parse(await readFile(new URL('../node_modules/marked/package.json', import.meta.url), 'utf8')).version;
  const inputHashes = Object.fromEntries(records.map(d => [d.source, d.sourceHash]));
  const inputs = { manifestHash: hash(manifestText), generatorHash, markedVersion, sources: inputHashes };
  const dependencies = Object.fromEntries(records.map(doc => [doc.source, {
    id: doc.id, route: doc.route, sourceHash: doc.sourceHash,
    linksTo: [...new Set(doc.links.map(link => link.id))],
    linkedFrom: records.filter(other => other.id !== doc.id && other.links.some(link => link.id === doc.id)).map(other => other.id),
    related: doc.related,
    relatedFrom: records.filter(other => other.related.includes(doc.id)).map(other => other.id),
    navigationGroup: manifest.navigation.find(g => g.documents.includes(doc.id)).id,
    outputKeys: [`documents.${doc.id}`, `search[documentId=${doc.id}]`, 'navigation', 'routes', 'dependencies'],
  }]));
  return {
    schemaVersion: 1,
    generatedBy: 'scripts/build-docs.mjs — generated data; edit docs/manifest.json and canonical Markdown, not this bundle',
    buildHash: hash(JSON.stringify(inputs)), inputs,
    routes: Object.fromEntries(records.map(d => [d.route, d.id])),
    navigation: manifest.navigation.map(group => ({ id: group.id, label: group.label, documents: group.documents.map(id => linkSummary(byId.get(id))) })),
    documents, search, dependencies,
  };
}

export async function buildDocumentation({ docsDir, outputFile = resolve(repository, '.generated/documentation/bundle.json'), check = false } = {}) {
  const bundle = await compileDocumentation({ docsDir });
  const content = JSON.stringify(bundle, null, 2) + '\n';
  if (check) return { bundle, written: false };
  const previous = await readFile(outputFile, 'utf8').catch(error => { if (error.code !== 'ENOENT') throw error; return null; });
  if (content === previous) return { bundle, written: false };
  await mkdir(dirname(outputFile), { recursive: true });
  const temporary = `${outputFile}.${randomUUID()}.tmp`;
  try { await writeFile(temporary, content, { flag: 'wx' }); await rename(temporary, outputFile); }
  finally { await unlink(temporary).catch(error => { if (error.code !== 'ENOENT') throw error; }); }
  return { bundle, written: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    requireThat(args.every(arg => arg === '--check') && args.length <= 1, 'Usage: node scripts/build-docs.mjs [--check]');
    const { bundle, written } = await buildDocumentation({ check: args.includes('--check') });
    console.log(`Documentation: ${Object.keys(bundle.documents).length} documents, ${bundle.search.length} search sections; ${args.includes('--check') ? 'validated without writing' : written ? 'data bundle generated' : 'data bundle unchanged'}. No website pages generated.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
