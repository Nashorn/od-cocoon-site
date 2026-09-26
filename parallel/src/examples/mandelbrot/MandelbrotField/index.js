import { Mandelbrot } from '../Mandelbrot.js';

namespace `examples.mandelbrot` (
  class MandelbrotField extends Component {
    static tag = 'arc-mandelbrot-field';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.canvas = this.querySelector('.fractal');
      this.overlay = this.querySelector('.overlay');
      this.pulse = this.querySelector('.heartbeat-dot');
      this.context = this.canvas.getContext('2d', { alpha: false });
      this.overlayContext = this.overlay.getContext('2d');
      this.view = { ...Mandelbrot.home };
      this.iterations = Mandelbrot.defaultIterations;
      this.maxThreads = core.lang.ThreadPool.defaultSize();
      this.threads = this.maxThreads;
      this.pool = null;
      this.poolReady = null;
      this.generation = 0;
      this.rendering = false;
      this.hasRendered = false;
      this.lastFrame = 0;
      this.worstFrame = 0;
      this.flashes = [];
      this.workerHues = new Map();
      this.results = { main: null, threads: null };
      this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

      this.on('click', (e) => this.onClick(e), false, this.canvas);
      this.on('contextmenu', (e) => this.onContextMenu(e), false, this.canvas);
      this.on('keydown', (e) => this.onKeyDown(e), false, this.canvas);
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(this);
      this.resize();
      this.fire('mandelbrot:ready', { field: this });
    }

    resize() {
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.pixelRatio = Math.min(devicePixelRatio || 1, 2);
      const width = Math.round(rect.width * this.pixelRatio);
      const height = Math.round(rect.height * this.pixelRatio);
      // Read the track once here, not every frame, to keep layout off the hot path.
      this.track = this.pulse.parentElement.clientWidth - this.pulse.offsetWidth;
      if (width === this.canvas.width && height === this.canvas.height) return;
      // Resizing wipes a canvas: keep the last picture, stretched, until the re-render lands.
      const previous = this.hasRendered ? this.snapshot() : null;
      this.canvas.width = this.overlay.width = width;
      this.canvas.height = this.overlay.height = height;
      this.context.fillStyle = '#070c15';
      this.context.fillRect(0, 0, width, height);
      if (!this.hasRendered) return;
      this.context.drawImage(previous, 0, 0, width, height);
      clearTimeout(this.resizeTimer);
      this.resizeTimer = setTimeout(() => this.renderView(), 250);
    }

    snapshot() {
      const copy = document.createElement('canvas');
      copy.width = this.canvas.width;
      copy.height = this.canvas.height;
      copy.getContext('2d').drawImage(this.canvas, 0, 0);
      return copy;
    }

    // ===== INPUT =====

    onClick(event) {
      const point = this.pointFromEvent(event);
      this.setView(Mandelbrot.zoom(this.view, point, event.shiftKey ? 1 / Mandelbrot.zoomFactor : Mandelbrot.zoomFactor));
    }

    onContextMenu(event) {
      event.preventDefault();
      this.setView(Mandelbrot.zoom(this.view, this.pointFromEvent(event), 1 / Mandelbrot.zoomFactor));
    }

    onKeyDown(event) {
      const centre = { x: this.view.x, y: this.view.y };
      const moves = {
        ArrowLeft: () => Mandelbrot.pan(this.view, -0.2, 0),
        ArrowRight: () => Mandelbrot.pan(this.view, 0.2, 0),
        ArrowUp: () => Mandelbrot.pan(this.view, 0, -0.2),
        ArrowDown: () => Mandelbrot.pan(this.view, 0, 0.2),
        Equal: () => Mandelbrot.zoom(this.view, centre, Mandelbrot.zoomFactor),
        NumpadAdd: () => Mandelbrot.zoom(this.view, centre, Mandelbrot.zoomFactor),
        Minus: () => Mandelbrot.zoom(this.view, centre, 1 / Mandelbrot.zoomFactor),
        NumpadSubtract: () => Mandelbrot.zoom(this.view, centre, 1 / Mandelbrot.zoomFactor),
        Digit0: () => ({ ...Mandelbrot.home }),
      };
      if (!moves[event.code]) return;
      event.preventDefault();
      this.setView(moves[event.code]());
    }

    pointFromEvent(event) {
      const rect = this.canvas.getBoundingClientRect();
      const x = (event.clientX - rect.left) * this.pixelRatio;
      const y = (event.clientY - rect.top) * this.pixelRatio;
      return Mandelbrot.pointAt(this.view, this.canvas.width, this.canvas.height, x, y);
    }

    // ===== SETTINGS =====

    setView(view) {
      this.view = view;
      this.results = { main: null, threads: null };
      return this.renderView();
    }

    setIterations(iterations) {
      this.iterations = iterations;
      this.results = { main: null, threads: null };
      return this.renderView();
    }

    setThreads(threads) {
      this.threads = threads;
      this.stopPool();
      return this.renderView();
    }

    reset() {
      this.view = { ...Mandelbrot.home };
      this.iterations = Mandelbrot.defaultIterations;
      this.results = { main: null, threads: null };
      return this.setThreads(this.maxThreads);
    }

    // ===== THREAD POOL =====

    // Spawning is timed apart from rendering, so render times show compute, not startup.
    startPool() {
      if (this.poolReady) return this.poolReady;
      const start = performance.now();
      const pool = new core.lang.ThreadPool(Mandelbrot.renderTile, this.threads);
      this.pool = pool;
      this.poolReady = Promise.all(
        Array.from({ length: pool.size }, () => pool.run(Mandelbrot.warmup)),
      ).then(() => {
        this.poolStartup = performance.now() - start;
        return pool;
      });
      return this.poolReady;
    }

    stopPool() {
      this.pool?.terminate();
      this.pool = null;
      this.poolReady = null;
    }

    // ===== RENDER =====

    async renderView() {
      if (!this.canvas.width) return;
      const generation = ++this.generation;
      // A newer render replaces this one: drop the old queue instead of finishing it.
      if (this.rendering && this.threads) this.stopPool();
      this.rendering = true;
      this.hasRendered = true;
      const tiles = Mandelbrot.tiles(this.view, this.canvas.width, this.canvas.height, this.iterations);
      this.fire('mandelbrot:render-start', { tiles: tiles.length, threads: this.threads });

      try {
        const pool = this.threads ? await this.startPool() : null;
        // Let the status paint first: a main-thread render blocks everything after this.
        await this.nextFrame();
        if (generation !== this.generation) return;
        // lastFrame stays: the gap from the frame before start is exactly the stall.
        this.worstFrame = 0;
        const start = performance.now();
        if (pool) {
          await Promise.all(tiles.map((tile) => pool.run(tile).then((result) => this.paint(result, generation))));
        } else {
          for (const tile of tiles) this.paint(Mandelbrot.renderTile(tile), generation);
        }
        const time = performance.now() - start;
        // One more frame lets the heartbeat record the stall a blocking render caused.
        await this.nextFrame();
        if (generation !== this.generation) return;
        this.rendering = false;
        this.results[this.threads ? 'threads' : 'main'] = { time, threads: this.threads };
        this.fire('mandelbrot:rendered', {
          time,
          threads: this.threads,
          tiles: tiles.length,
          worstFrame: this.worstFrame || null,
          startup: pool ? this.poolStartup : null,
          speedup: this.speedup(),
        });
      } catch (error) {
        // A newer render terminated this pool on purpose; anything else is real.
        if (generation !== this.generation) return;
        this.rendering = false;
        throw error;
      }
    }

    speedup() {
      const { main, threads } = this.results;
      return main && threads ? main.time / threads.time : null;
    }

    paint(tile, generation) {
      if (generation !== this.generation) return;
      const pixels = new Uint8ClampedArray(tile.pixels);
      this.context.putImageData(new ImageData(pixels, tile.width, tile.height), tile.x, tile.y);
      if (tile.worker === 'main' || this.reducedMotion) return;
      this.flashes.push({ ...tile, hue: this.hueFor(tile.worker), born: performance.now() });
    }

    // Golden-angle hues keep neighbouring workers visibly different at any pool size.
    hueFor(worker) {
      if (!this.workerHues.has(worker)) this.workerHues.set(worker, (215 + this.workerHues.size * 137.5) % 360);
      return this.workerHues.get(worker);
    }

    nextFrame() {
      return new Promise((resolve) => requestAnimationFrame(resolve));
    }

    // ===== WORLD LOOP =====

    onFrame(timestamp) {
      if (this.rendering && this.lastFrame) {
        this.worstFrame = Math.max(this.worstFrame, timestamp - this.lastFrame);
      }
      this.lastFrame = timestamp;
      if (this.track > 0) this.pulse.style.transform = `translateX(${(timestamp / 5) % this.track}px)`;
    }

    onDraw() {
      if (!this.flashes.length && !this.flashesDrawn) return;
      const ctx = this.overlayContext, now = performance.now();
      ctx.clearRect(0, 0, this.overlay.width, this.overlay.height);
      this.flashes = this.flashes.filter((flash) => now - flash.born < 700);
      for (const flash of this.flashes) {
        const fade = 1 - (now - flash.born) / 700;
        ctx.fillStyle = `hsl(${flash.hue} 90% 66% / ${0.16 * fade})`;
        ctx.fillRect(flash.x, flash.y, flash.width, flash.height);
        ctx.strokeStyle = `hsl(${flash.hue} 90% 66% / ${0.7 * fade})`;
        ctx.lineWidth = this.pixelRatio;
        ctx.strokeRect(flash.x + 0.5, flash.y + 0.5, flash.width - 1, flash.height - 1);
      }
      this.flashesDrawn = this.flashes.length > 0;
    }

    onDisconnected() {
      this.generation++;
      clearTimeout(this.resizeTimer);
      this.resizeObserver?.disconnect();
      this.stopPool();
    }
  }
);
