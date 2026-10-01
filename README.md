# Cocoon website

Marketing website for [Cocoon](https://github.com/Nashorn/od-cocoon/tree/8.6.0), a standards-first framework for native web applications.

## Local preview

```sh
npm start
```

Then open <http://localhost:4173>.

## Documentation

`docs/manifest.json` binds canonical Markdown to stable IDs, future public routes,
navigation and related reading. Generate the presentation-independent content bundle:

```sh
npm ci
npm run docs
npm run docs:check
npm run test:docs:generator
```

Output is `.generated/documentation/bundle.json` (ignored by Git). It contains
content fragments, section anchors, resolved links, navigation, search records and
a source dependency map. No website pages or presentation UI are generated.
See [the generation contract](docs/generator.md) and [authoring notes](docs/README.md).

The existing `get-started.html` and `docs.html` can still be regenerated explicitly
with `npm run docs:legacy`. The future documentation renderer will consume the
new bundle after a visual mockup is approved. Landing-page clipboard behavior
lives in `site.js`.

The displayed v8.6.0 size is rounded from the public release's `framework.min.js`:
42,777 bytes minified and 12,929 bytes gzipped (gzip level 9, September 23, 2026).
It describes the kernel file, not total application weight.

## Interactive component lab

The landing-page middle is a real Cocoon application with an exploded 3D view,
signal playback, an inherited-style inspector, and an Edit/Run workspace.
It runs in its own automatically sized iframe as a namespaced Cocoon application.
Run reloads only that iframe; the editor itself never hosts the scene. See
[the component ownership and extension guide](docs/showcase-architecture.md).

Run the browser checks with `npm run test:showcase` (requires installed Chrome).
The kernel is vendored with its MIT license; Render still serves a static site.

## Deployment

Render is configured to run `npm ci --include=dev && npm run build:site` and publish only `dist/`, with the existing automatic deployment trigger unchanged. `scripts/build-site.mjs` copies the repository by default, excluding the paths/names listed in `scripts/deploy-excludes.json`. New website files are included automatically, regardless of their extension. Browser JavaScript, demo import maps, worker files, assets and public Markdown are retained. Node tooling, internal discovery notes, tests, mock screenshots, environment files and repository metadata are excluded. Documentation content is regenerated from the canonical manifest during packaging. No Node server runs in production.

Run `npm run build:site` to inspect the deployment locally. `dist/` is generated and ignored by Git; the build only replaces a directory bearing its own build marker. The exclusions file uses repository-relative paths (including their descendants), exact basenames at any depth, and basename prefixes. Add new internal tooling there; public website files need no registration. Apply/sync `render.yaml` in Render; if the service is managed manually, set the same build command and publish directory in its settings. Repository changes alone do not verify the remote service configuration.

## Analytics consent

The landing page's bottom banner is managed by `cookie-consent.js`. Set the GA4
measurement ID in `analytics-config.js` when ready; leave it blank to keep
Analytics inactive. Do not add a second Google tag or Tag Manager loader.

The tag loads only after acceptance. Accept/reject choices are remembered locally
for 180 days. The footer's Cookie settings button reopens the banner. Withdrawing
consent disables Analytics, clears matching first-party GA cookies and reloads the
page to unload the tag. Demo/editor storage remains independent of this choice.

Run `node tests/cookie-consent.mjs` to check the consent flow with a mocked tag.

## Search discovery

`scripts/seo.mjs` owns public page URLs and metadata. Run `npm run docs:legacy` when updating
the existing two documentation HTML pages and `npm run seo` after SEO metadata
edits; commit that generated HTML and `sitemap.xml`. `npm run docs` produces only
the future documentation data bundle and does not change public SEO outputs. The static deployment build stages the approved public files in `dist/`. The sitemap includes
existing standalone labs so crawlers can discover them independently of the
homepage's lazy-loaded iframes. Each lab uses its own canonical URL, including
when the editor adds a session query parameter. The homepage canonical combines
`/index.html` and `/` signals without changing iframe loading or the splash.

`robots.txt` allows crawling, including runtime assets, and advertises the sitemap.
The hash-driven code-share shell is `noindex`; it is not a stable content page.
The obsolete `__old_index.html` is retired and has a Render redirect to `/`.
Render serves existing files before redirect rules, so do not restore that file
at its former public path. Apply/sync the `render.yaml` route when deploying and
verify its production 301 response; a local static server cannot validate it.

After deployment, verify ownership of `cocoonframework.com` in Google Search
Console and Bing Webmaster Tools using the account-provided verification record
or file. Submit `https://cocoonframework.com/sitemap.xml` to both. Inspect the
homepage and each lab URL in Google's URL Inspection rendered HTML and Bing's
inspection tools. Confirm that the existing left-rail text is present. Local
Chrome rendering verifies application behavior, not search-engine indexing or
AI citation. Track indexed URLs, search impressions/clicks and Bing AI citation
reporting where available. These account steps require access to the owner's
accounts; repository metadata does not register or verify a site automatically.
