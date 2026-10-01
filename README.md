# Cocoon website

Marketing website for [Cocoon](https://github.com/Nashorn/od-cocoon/tree/8.6.0), a standards-first framework for native web applications.

## Local preview

```sh
npm start
```

Then open <http://localhost:4173>.

## Documentation

`docs/get-started.md` owns the runnable quickstart. `docs/reference.md` is a
snapshot of `arc-kernel/README.md`, with the public GitHub installation command
and repaired internal anchors. Refresh that snapshot deliberately when the
framework documentation changes.

After editing either Markdown file, regenerate the checked-in static pages:

```sh
npm ci
npm run docs
```

The generated `get-started.html` and `docs.html` need no browser-side
Markdown parser or deployment build. Landing-page clipboard behavior lives in
`site.js`.

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

Render is configured to publish the repository root as a static site, with automatic deployment on commits to `main`. The service configuration lives in `render.yaml`.

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

`scripts/seo.mjs` owns public page URLs and metadata. Run `npm run docs` after
Markdown edits and `npm run seo` after SEO metadata edits; commit the generated
HTML and `sitemap.xml`. No deployment build is required. The sitemap includes
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
