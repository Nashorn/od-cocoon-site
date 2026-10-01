import { renderTile, displayPixels } from './RayTracer.js';

// Shared by the landing-page sample and the original standalone visual proof.
// The session owns compute and pixels; its caller owns controls and lifecycle.
export class RenderSession extends EventTarget {
  constructor(canvas, overlay, { width, height, samples = 96 } = {}) {
    super();
    this.canvas = canvas;
    this.context = canvas.getContext('2d', { alpha: false });
    this.overlay = overlay;
    this.overlayContext = overlay.getContext('2d');
    this.maxThreads = core.lang.ThreadPool.defaultSize();
    this.threads = this.maxThreads;
    this.samples = samples;
    this.camera = [0, 3.05, 8.8];
    this.generation = 0;
    this.running = false;
    this.orbiting = false;
    this.previewPromise = null;
    this.flashes = [];
    this.results = { main: null, threads: null };
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.resize(width, height);
  }

  emit(type, detail = {}) { this.dispatchEvent(new CustomEvent(type, { detail })); }

  resize(width, height) {
    if (this.width === width && this.height === height) return false;
    const previous = document.createElement('canvas');
    previous.width = this.canvas.width;
    previous.height = this.canvas.height;
    previous.getContext('2d').drawImage(this.canvas, 0, 0);
    this.cancel(false);
    this.width = this.canvas.width = this.overlay.width = width;
    this.height = this.canvas.height = this.overlay.height = height;
    this.context.fillStyle = '#070c15';
    this.context.fillRect(0, 0, width, height);
    if (this.hasRendered) this.context.drawImage(previous, 0, 0, width, height);
    this.results = { main: null, threads: null };
    return true;
  }

  cancel(notify = true) {
    ++this.generation;
    this.pool?.terminate();
    this.pool = null;
    this.running = false;
    this.orbiting = false;
    this.previewPromise = null;
    this.flashes = [];
    this.overlayContext.clearRect(0, 0, this.canvas.width, this.canvas.height);
    if (notify) this.emit('cancel');
  }

  tiles(width, height) {
    const tiles = [];
    for (let y = 0; y < height; y += 32) for (let x = 0; x < width; x += 32) {
      tiles.push({ x, y, width: Math.min(32, width - x), height: Math.min(32, height - y), imageWidth: width, imageHeight: height });
    }
    return tiles.sort((a, b) => Math.hypot(a.x - width / 2, a.y - height / 2) - Math.hypot(b.x - width / 2, b.y - height / 2));
  }

  nextFrame() { return new Promise(resolve => requestAnimationFrame(resolve)); }

  setCamera(camera) {
    if (camera.every((value, index) => value === this.camera[index])) return;
    this.camera = [...camera];
    this.results = { main: null, threads: null };
    this.result = null;
  }

  preview(camera) {
    if (!this.orbiting) {
      this.cancel(false);
      this.orbiting = this.running = this.hasRendered = true;
      this.started = this.error = null;
      this.orbitFrames = 0;
      this.previewVersion = 0;
      this.emit('orbit-start');
    }
    this.setCamera(camera);
    ++this.previewVersion;
    if (this.previewPromise) return this.previewPromise;
    const generation = this.generation;
    const render = this.drawOrbitPreview(generation);
    this.previewPromise = render;
    render.finally(() => { if (this.previewPromise === render) this.previewPromise = null; });
    return render;
  }

  async drawOrbitPreview(generation) {
    try {
      // Dragging always uses workers; the selected benchmark mode applies on release.
      // Reuse this pool while dragging, coalescing pointer updates into one latest view.
      const pool = this.pool ||= new core.lang.ThreadPool(renderTile, this.maxThreads);
      const width = Math.min(400, this.width), height = Math.round(width * this.height / this.width);
      const frame = document.createElement('canvas');
      frame.width = width; frame.height = height;
      const context = frame.getContext('2d');
      let renderedVersion = -1;
      while (generation === this.generation && this.orbiting && renderedVersion !== this.previewVersion) {
        renderedVersion = this.previewVersion;
        const start = performance.now(), camera = [...this.camera];
        await this.runTiles(pool, this.tiles(width, height), { camera, samples: 1, depth: 3 }, generation, tile => {
          context.putImageData(new ImageData(displayPixels(new Float32Array(tile.pixels), 1), tile.width, tile.height), tile.x, tile.y);
        });
        if (generation !== this.generation) return;
        // Swap a whole preview frame: tiles from different camera positions never mix.
        this.context.drawImage(frame, 0, 0, this.width, this.height);
        this.orbitPreviewTime = performance.now() - start;
        ++this.orbitFrames;
        this.emit('orbit-preview', { time: this.orbitPreviewTime, width, height });
      }
    } catch (error) {
      if (generation !== this.generation) return;
      this.cancel(false);
      this.error = error.message;
      this.emit('error', { message: error.message });
    }
  }

  async render({ samples = this.samples, threads = this.threads } = {}) {
    this.cancel(false);
    const generation = this.generation;
    const camera = [...this.camera];
    if (samples !== this.samples) this.results = { main: null, threads: null };
    this.samples = samples;
    this.threads = threads;
    this.running = this.hasRendered = true;
    this.error = this.result = this.started = null;
    this.emit('start', { samples, threads });
    let pool;
    try {
      const warmup = performance.now();
      pool = this.pool = threads ? new core.lang.ThreadPool(renderTile, threads) : null;
      if (pool) await Promise.all(Array.from({ length: pool.size }, () => pool.run({ width: 0, height: 0 })));
      if (generation !== this.generation) return;
      const startup = pool ? performance.now() - warmup : 0;
      // Paint status before intentionally blocking the main thread in comparison mode.
      await this.nextFrame();
      if (generation !== this.generation) return;
      const start = this.started = performance.now();
      this.lastFrame = start;
      this.worstFrame = 0;
      this.emit('progress', { phase: 'preview', progress: 0, samples: 0 });
      const previewWidth = Math.min(480, this.width), previewHeight = Math.round(previewWidth * this.height / this.width);
      const preview = document.createElement('canvas');
      preview.width = previewWidth;
      preview.height = previewHeight;
      const previewContext = preview.getContext('2d');
      await this.runTiles(pool, this.tiles(previewWidth, previewHeight), { camera, samples: 2, depth: 4 }, generation, tile => {
        previewContext.putImageData(new ImageData(displayPixels(new Float32Array(tile.pixels), 2), tile.width, tile.height), tile.x, tile.y);
        this.context.drawImage(preview, tile.x, tile.y, tile.width, tile.height, tile.x / previewWidth * this.width, tile.y / previewHeight * this.height, tile.width / previewWidth * this.width, tile.height / previewHeight * this.height);
      });
      if (generation !== this.generation) return;
      const previewTime = performance.now() - start;
      const tiles = this.tiles(this.width, this.height), accumulation = new Map();
      let completed = 0, lastProgress = 0;
      for (let sampleStart = 0; sampleStart < samples; sampleStart += 8) {
        const batch = Math.min(8, samples - sampleStart);
        await this.runTiles(pool, tiles, { camera, samples: batch, sampleStart, depth: 5 }, generation, tile => {
          const key = tile.y * this.width + tile.x, incoming = new Float32Array(tile.pixels);
          let sum = accumulation.get(key);
          if (!sum) { sum = incoming; accumulation.set(key, sum); }
          else for (let i = 0; i < sum.length; i++) sum[i] += incoming[i];
          this.context.putImageData(new ImageData(displayPixels(sum, sampleStart + batch), tile.width, tile.height), tile.x, tile.y);
          completed += batch;
          const now = performance.now();
          if (now - lastProgress > 50) {
            this.emit('progress', { phase: 'refine', progress: completed / (tiles.length * samples), samples: sampleStart + batch });
            lastProgress = now;
          }
          if (pool && !this.reducedMotion) this.flashes.push({ x: tile.x, y: tile.y, width: tile.width, height: tile.height, born: now });
        });
        if (generation !== this.generation) return;
      }
      const time = performance.now() - start;
      // Include the last blocked frame in the heartbeat measurement.
      await this.nextFrame();
      if (generation !== this.generation) return;
      this.running = false;
      this.results[threads ? 'threads' : 'main'] = { time, threads };
      const { main, threads: threaded } = this.results;
      this.result = { time, previewTime, startup, width: this.width, height: this.height, samples, threads, camera, worstFrame: this.worstFrame, speedup: main && threaded ? main.time / threaded.time : null };
      pool?.terminate();
      if (this.pool === pool) this.pool = null;
      this.emit('complete', this.result);
    } catch (error) {
      if (generation !== this.generation) return;
      this.cancel(false);
      this.error = error.message;
      this.emit('error', { message: error.message });
    }
  }

  async runTiles(pool, tiles, settings, generation, paint) {
    if (!pool) {
      for (const tile of tiles) {
        if (generation !== this.generation) return;
        paint(renderTile({ ...tile, ...settings }));
      }
      return;
    }
    let next = 0;
    await Promise.all(Array.from({ length: pool.size }, async () => {
      while (next < tiles.length && generation === this.generation) {
        const result = await pool.run({ ...tiles[next++], ...settings });
        if (generation !== this.generation) return;
        paint(result);
      }
    }));
  }

  frame(timestamp) {
    if (this.running && this.lastFrame) this.worstFrame = Math.max(this.worstFrame, timestamp - this.lastFrame);
    this.lastFrame = timestamp;
  }

  draw() {
    if (!this.flashes.length && !this.hadFlashes) return;
    const ctx = this.overlayContext, now = performance.now();
    ctx.clearRect(0, 0, this.width, this.height);
    this.flashes = this.flashes.filter(tile => now - tile.born < 220);
    for (const tile of this.flashes) {
      ctx.strokeStyle = `rgba(127,211,201,${0.18 * (1 - (now - tile.born) / 220)})`;
      ctx.strokeRect(tile.x + .5, tile.y + .5, tile.width - 1, tile.height - 1);
    }
    this.hadFlashes = this.flashes.length > 0;
  }
}
