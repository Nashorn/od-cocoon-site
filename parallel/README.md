# Parallel Compute

The landing page loads `raytracer.html` (Ray Tracer, the first tab) in one iframe when this section comes within
400px of the viewport, or when its navigation link is clicked, the same way as
Games & Simulation. Nothing here is needed to boot the rest of the landing page.

## Ownership

- `src/lab/ParallelShell`: section copy, benchmark picker, thread modes, iterations,
  metrics strip and source view.
- `src/lab/ParallelApplication`: connects the lab shell to the sample World.
- `src/examples/mandelbrot/MandelbrotWorld`: Cocoon World lifecycle and visibility.
  The loop only drives the heartbeat and tile highlights; it stops off screen, and the
  first render waits until the field is seen.
- `src/examples/mandelbrot/MandelbrotField`: canvas, input, the `core.lang.ThreadPool`,
  render timing and the main-thread heartbeat.
- `src/examples/mandelbrot/Mandelbrot.js`: view maths and `renderTile`.
- `core/ExampleFiles.js`: source manifest and standalone download template.
- `raytracer.html`, `src/lab/RayTracerApplication`, and `src/lab/RayTracerShell`:
  the Ray Tracer document. Its shell extends ParallelShell's picker, thread controls,
  source viewer, and download actions, with ray-specific quality and status controls.
- `src/examples/raytracer`: the scene renderer, shared progressive `RenderSession`,
  canvas field, and visibility-aware World. The original visual proof uses the same
  renderer/session; it is not embedded in the landing page.
- `core/RayTracerFiles.js`: Ray Tracer's source manifest and standalone template,
  using the existing ExampleFiles loader and ZIP packaging.

## How the benchmark measures

- The canvas is split into 64px tiles, nearest the centre first. Each tile is one
  `pool.run()` job; a free worker takes the next one.
- `Mandelbrot.renderTile` is sent to workers as source text, so it must stay
  self-contained. The main-thread mode calls the same function directly.
- Pixels come back with `transfer()`, not a copy.
- Worker startup is timed separately ("pool ready in") and excluded from render time.
- Speedup appears once the same view has been rendered on both the main thread and a
  thread pool. Changing the view or iterations clears it.
- "Worst frame" is the longest gap between World loop frames during the render. The
  heartbeat moves from the loop, not a CSS animation, so it visibly stops when the
  main thread is blocked.
- Fixed thread counts at or above this device's pool size are hidden. "All" uses
  `ThreadPool.defaultSize()` (logical cores − 1).

## UI and source

The shell uses the same `interactive-shell.css` and `interactive-lab.css` as Games &
Simulation. The field's stage colours use the `--arc-stage-*` tokens with fallbacks,
so the downloaded ZIP renders the same without the landing-page stylesheet.

## Adding benchmarks

Mandelbrot and Ray Tracer navigate between `index.html` and `raytracer.html` inside
the same section iframe. The frame bridge reports the new document's height,
readiness, and title. Image Filters remains Coming soon and disabled. New benchmarks
get their own example folder and document; keep lab controls outside exported samples.

Ray Tracer uses 32px tiles and a small two-sample preview, followed by eight-sample
batches at full resolution. Quality selects 24, 96, or 256 samples. The same scene,
sampling seeds, and display transform run in workers and main-thread mode. Its timer
includes preview/refinement and excludes pool startup. Changing quality or resolution
clears the comparison. Main-thread mode intentionally blocks for the whole render;
Preview is the quicker comparison. Workers terminate after completion, on Stop,
when the field leaves view (including Source view), and on document exit. Interrupted
offscreen renders restart on return; manually stopped renders remain stopped.

Drag the Ray Tracer canvas to orbit (horizontal swipes on touch screens leave
vertical page scrolling available). While dragging, a persistent worker pool
renders complete 400px, one-sample preview frames; pointer updates coalesce into
the latest requested camera. Release cancels pending preview work and refines with
the selected quality and thread mode. Preview timings never enter benchmark results.
Camera changes clear comparisons, the pitch stays above the floor, and Reset view
restores the original camera without changing quality or thread mode. Arrow keys
orbit the focused canvas; Home resets it. The full Reset also restores the camera.

## Verification

Run `node tests/parallel.mjs` for lazy loading, threads vs main thread (speedup and
measured main-thread stall), zoom, iterations, reset, read-only source, offscreen stop,
mobile fit and a standalone ZIP boot with external requests blocked.

Run `node tests/raytracer-integration.mjs` for the enabled picker, both iframe
navigation directions, ray quality/thread modes, cancellation, visibility, source,
mobile, and the Ray Tracer ZIP. Set `COCOON_TEST_URL=http://127.0.0.1:8081` to check an
existing development server. `node tests/raytracer-proof.mjs` also verifies the shared
renderer/session and the original proof page.

Run `node tests/raytracer-orbit.mjs` for drag previews, capture/cancellation,
camera bounds, exact view reset, keyboard controls, touch orbit and vertical scrolling.
