# Cocoon website

Marketing website for [Cocoon](https://github.com/Nashorn/od-cocoon/tree/8.6.0), a standards-first framework for native web applications.

## Local preview

```sh
python3 -m http.server 4173 --directory public
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

The generated `public/get-started.html` and `public/docs.html` need no browser-side
Markdown parser or deployment build. Landing-page clipboard behavior lives in
`public/site.js`.

The displayed v8.6.0 size is rounded from the public release's `framework.min.js`:
42,777 bytes minified and 12,929 bytes gzipped (gzip level 9, September 23, 2026).
It describes the kernel file, not total application weight.

## Interactive component lab

The landing-page middle is a real Cocoon application with an exploded 3D view,
signal playback, and an inherited-style inspector. See
[the component ownership and extension guide](docs/showcase-architecture.md).

Run the browser checks with `npm run test:showcase` (requires installed Chrome).
The kernel is vendored with its MIT license; Render still serves a static site.

## Deployment

Render deploys the contents of `public/` as a static site whenever a commit is pushed to `main`. The service configuration lives in `render.yaml`.
