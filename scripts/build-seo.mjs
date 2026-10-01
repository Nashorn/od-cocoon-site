import { readFile, writeFile } from 'node:fs/promises';
import { pages, origin, metadata } from './seo.mjs';
for (const [file] of pages) {
  const path = new URL('../' + file, import.meta.url);
  let html = await readFile(path, 'utf8');
  html = html.replace(/<!-- SEO metadata:[\s\S]*?<!-- \/SEO metadata -->\s*/g, '')
    .replace(/<meta charset="utf-8">\s*/g, '')
    .replace(/<title>[\s\S]*?<\/title>\s*/g, '')
    .replace(/<meta name="description"\s+content="[^"]*">\s*/g, '');
  // Metadata belongs ahead of the homepage's inline splash CSS.
  html = html.replace(/<head>/, '<head>\n  <meta charset="utf-8">\n  ' + metadata(file));
  await writeFile(path, html);
}
await writeFile(new URL('../sitemap.xml', import.meta.url), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${pages.map(([,path]) => `  <url><loc>${origin}${path}</loc></url>`).join('\n')}\n</urlset>\n`);
