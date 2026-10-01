# Ray Tracer visual proof

Open `/parallel/raytracer-proof/index.html` through the site's local HTTP server.
For example, from the repository root:

```sh
python3 -m http.server 8088 --bind 127.0.0.1
```

Then visit http://127.0.0.1:8088/parallel/raytracer-proof/index.html.

This is the original standalone visual study. Ray Tracer is now also available in
the landing page's Multicore Threading picker, through `../raytracer.html` in the
section's existing iframe. This proof remains available for direct visual checks.

## Ownership

- `renderer.js`: re-exports the authoritative renderer in
  `../src/examples/raytracer/RayTracer.js`. Cocoon serializes `renderTile`
  into its workers; no external image, GPU renderer, or pre-rendered picture is used.
- `src/proof/Studio/index.js`: a Cocoon World that owns the proof's controls and
  heartbeat. It delegates the pool, progressive accumulation, and canvas painting
  to the same `RenderSession` used by the integrated playground.
- `index.html` / `studio.css`: the standalone presentation, using the site's tokens.

## Picture and rendering

Three analytic spheres sit on an infinite checkerboard plane. Three rectangular
softboxes supply sampled direct lighting and reflected highlights. A procedural
studio environment adds broad silver gradients. Shadows use visibility rays;
reflections use Schlick Fresnel and up to five recursive bounces. Glossy rays are
sampled around the ideal reflection. A sampled ambient-occlusion term anchors the
objects. These are pragmatic ray-tracing approximations, not a full unbiased
global-illumination renderer. Exposure, ACES-style tone mapping, and sRGB encoding
produce the displayed image.

A two-sample small preview is followed by full-resolution batches of eight
samples. Preview, Studio, and Fine use 24, 96, and 256 samples per pixel. Linear
radiance is accumulated before tone mapping. Every pixel/sample has a stable seed,
so worker count and tile completion order do not change the image. Render dimensions
are selected at page load and capped at 1440 pixels wide; CSS scales the canvas
on subsequent viewport changes without discarding an in-progress render.

Each 32px tile is a `ThreadPool.run()` job. Only one job per worker is outstanding.
Pixel sums are transferred back as `Float32Array` buffers. Stopping, changing
quality, leaving the page, or hiding the tab terminates the pool. Generation checks
reject obsolete results; completed renders also release workers. Returning to a
hidden tab restarts an interrupted render while retaining its last picture.

The displayed duration includes the preview and progressive rendering, but excludes
worker startup. This proof does not yet offer main-thread comparisons or claim a
measured speedup.

## Verification

From the repository root:

```sh
node tests/raytracer-proof.mjs
node tests/parallel.mjs
```

The proof test uses installed Google Chrome through Playwright. It checks worker
versus direct rendering, deterministic tiling and sampling, responsive frames,
stop/restart without stale painting, quality changes, desktop/mobile fit, and
rendering with all external requests blocked. Screenshots go to
`/tmp/cocoon-raytracer-proof` (override with `RAY_ARTIFACTS`).

The existing parallel suite separately checks Mandelbrot's lazy iframe loading,
thread/main comparisons, zoom, controls, source viewer, visibility, mobile layout,
and standalone ZIP.
