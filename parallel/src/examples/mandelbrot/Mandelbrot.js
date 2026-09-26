export class Mandelbrot {
  static home = { x: -0.62, y: 0, span: 3.4 };
  static defaultIterations = 1000;
  static tileSize = 64;
  static zoomFactor = 3;
  static minSpan = 1e-12;
  static maxSpan = 4;

  // Sent to worker threads as source text, so it must stay self-contained: no imports,
  // no outer variables, no other Mandelbrot members. The main thread calls it directly.
  static renderTile = (tile) => {
    const { x, y, width, height, left, top, step, iterations } = tile;
    const palette = [[7, 12, 21], [71, 127, 255], [117, 92, 243], [95, 233, 189], [238, 242, 250]];
    const pixels = new Uint8ClampedArray(width * height * 4);
    let offset = 0;
    for (let row = 0; row < height; row++) {
      const ci = top + (y + row) * step;
      for (let column = 0; column < width; column++, offset += 4) {
        const cr = left + (x + column) * step;
        let zr = 0, zi = 0, zr2 = 0, zi2 = 0, n = 0;
        while (n < iterations && zr2 + zi2 <= 256) {
          zi = 2 * zr * zi + ci;
          zr = zr2 - zi2 + cr;
          zr2 = zr * zr;
          zi2 = zi * zi;
          n++;
        }
        let r = palette[0][0], g = palette[0][1], b = palette[0][2];
        if (n < iterations) {
          // Smooth escape count: removes the hard bands between whole iteration counts.
          const smooth = n + 1 - Math.log2(Math.log2(zr2 + zi2) / 2);
          const position = ((smooth * 0.035) % 1) * palette.length;
          const index = Math.floor(position), mix = position - index;
          const from = palette[index], to = palette[(index + 1) % palette.length];
          // Fade the fast-escaping far field toward the stage colour so the set's edge glows.
          const glow = Math.min(1, smooth / 28);
          r = palette[0][0] + (from[0] + (to[0] - from[0]) * mix - palette[0][0]) * glow;
          g = palette[0][1] + (from[1] + (to[1] - from[1]) * mix - palette[0][1]) * glow;
          b = palette[0][2] + (from[2] + (to[2] - from[2]) * mix - palette[0][2]) * glow;
        }
        pixels[offset] = r;
        pixels[offset + 1] = g;
        pixels[offset + 2] = b;
        pixels[offset + 3] = 255;
      }
    }
    // A worker's global scope survives between jobs, so a random tag names each worker.
    const worker = typeof WorkerGlobalScope === "undefined"
      ? "main"
      : (self.tileWorker ??= Math.random().toString(36).slice(2));
    const result = { x, y, width, height, worker, pixels: pixels.buffer };
    // transfer() exists only inside a Cocoon Thread: hand the pixels back without a copy.
    return typeof transfer === "function" ? transfer(result, [pixels.buffer]) : result;
  };

  static warmup = { x: 0, y: 0, width: 0, height: 0, left: 0, top: 0, step: 0, iterations: 0 };

  // Tiles for a width × height pixel canvas, nearest the centre first so the middle of the
  // picture fills in before the edges.
  static tiles(view, width, height, iterations) {
    const size = this.tileSize;
    const step = view.span / width;
    const left = view.x - (width / 2) * step;
    const top = view.y - (height / 2) * step;
    const tiles = [];
    for (let y = 0; y < height; y += size) {
      for (let x = 0; x < width; x += size) {
        tiles.push({
          x, y,
          width: Math.min(size, width - x),
          height: Math.min(size, height - y),
          left, top, step, iterations,
        });
      }
    }
    const distance = (tile) => Math.hypot(tile.x + size / 2 - width / 2, tile.y + size / 2 - height / 2);
    return tiles.sort((a, b) => distance(a) - distance(b));
  }

  // The complex-plane point under canvas pixel (x, y).
  static pointAt(view, width, height, x, y) {
    const step = view.span / width;
    return { x: view.x + (x - width / 2) * step, y: view.y + (y - height / 2) * step };
  }

  static zoom(view, point, factor) {
    const span = Math.min(this.maxSpan, Math.max(this.minSpan, view.span / factor));
    return { x: point.x, y: point.y, span };
  }

  static pan(view, dx, dy) {
    return { ...view, x: view.x + dx * view.span, y: view.y + dy * view.span };
  }
}
