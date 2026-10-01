import { readFile, writeFile } from 'node:fs/promises';
import { Marked } from 'marked';
import { metadata } from './seo.mjs';

// Markdown is the source of truth. The reference index links to the API drafts
// until the dedicated documentation renderer is introduced.
for (const [source, output, title, label] of [
  ['get-started', 'get-started', 'Get started', 'Your first component'],
  ['reference', 'docs', 'Reference', 'Framework reference'],
]) {
  const headings = new Map();
  const markdown = new Marked({ renderer: {
    heading({ tokens, depth }) {
      const text = this.parser.parseInline(tokens);
      const base = text.replace(/<[^>]*>/g, '').toLowerCase()
        .replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
      const count = headings.get(base) || 0;
      headings.set(base, count + 1);
      const id = count ? `${base}-${count}` : base;
      return `<h${depth} id="${id}">${text}</h${depth}>\n`;
    },
  } });
  const body = (await markdown.parse(await readFile(new URL(`../docs/${source}.md`, import.meta.url), 'utf8'))).replace(/href="(?![a-z]+:|\/|#)([^"]+\.md(?:#[^"]*)?)"/gi, 'href="docs/$1"');
  await writeFile(new URL(`../${output}.html`, import.meta.url), `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  ${metadata(`${output}.html`)}
  <link rel="icon" href="favicon.ico">
  <link rel="stylesheet" href="docs.css">
</head>
<body>
  <a class="skip" href="#content">Skip to content</a>
  <nav aria-label="Main navigation"><a class="brand" href="index.html"><span aria-hidden="true"></span>Cocoon</a><div><a href="get-started.html"${source === 'get-started' ? ' aria-current="page"' : ''}>Get started</a><a href="docs.html">Reference drafts</a><a href="https://github.com/Nashorn/od-cocoon/tree/8.6.0">GitHub ↗</a></div></nav>
  <main id="content"><p class="eyebrow">COCOON / ${label.toUpperCase()}</p>
  ${source === 'reference' ? '<p class="intro">Cocoon’s kernel is distributed as <strong>od-cocoon</strong>. <a href="get-started.html">Start with the runnable quickstart →</a></p>' : ''}
  ${body}</main>
  <footer><a href="index.html">← Back to Cocoon</a><span>Native HTML. CSS. JavaScript.</span></footer>
  <script type="module" src="cookie-consent.js"></script>
</body>
</html>\n`);
}
