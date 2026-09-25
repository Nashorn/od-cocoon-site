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
