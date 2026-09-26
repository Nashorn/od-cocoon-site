# Parallel Compute

The landing page loads `index.html` in one iframe when this section comes within
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

Ray Tracer and Image Filters are labeled Coming soon and disabled. Give each its own
example folder and map its picker button to the shared iframe's next document. Keep
lab controls outside exported samples.

## Verification

Run `node tests/parallel.mjs` for lazy loading, threads vs main thread (speedup and
measured main-thread stall), zoom, iterations, reset, read-only source, offscreen stop,
mobile fit and a standalone ZIP boot with external requests blocked.
