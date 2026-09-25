// A spatial grid keeps neighbour searches local as the flock grows.
export class Steering {
  constructor(count = 400) {
    this.width = 1000;
    this.height = 600;
    this.speed = 1;
    this.obstaclesEnabled = true;
    this.pointer = { x: 0, y: 0, active: false, repel: false };
    this.birds = [];
    this.grid = new Map();
    this.setCount(count);
  }

  get obstacles() {
    return [
      { x: this.width * .28, y: this.height * .65, radius: Math.min(this.width, this.height) * .115 },
      { x: this.width * .79, y: this.height * .3, radius: Math.min(this.width, this.height) * .075 },
    ];
  }

  setCount(count) {
    this.birds.length = Math.min(this.birds.length, count);
    while (this.birds.length < count) {
      const angle = Math.random() * Math.PI * 2;
      const cluster = this.birds.length % 3;
      const radius = 60 + Math.random() * Math.min(this.width, this.height) * .28;
      const x = this.width * (.25 + cluster * .23) + Math.cos(angle) * radius;
      const y = this.height * .5 + Math.sin(angle) * radius * .7;
      this.birds.push({ x, y, px: x, py: y, vx: -Math.sin(angle) * 80, vy: Math.cos(angle) * 80, tone: this.birds.length % 3 });
    }
  }

  resize(width, height) {
    for (const bird of this.birds) {
      bird.x *= width / this.width;
      bird.y *= height / this.height;
      bird.px = bird.x; bird.py = bird.y;
    }
    this.width = width; this.height = height;
  }

  reset() {
    const count = this.birds.length;
    this.birds.length = 0;
    this.setCount(count);
  }

  step(seconds) {
    const dt = Math.min(seconds, .04) * this.speed;
    const cell = 65;
    const columns = Math.ceil(this.width / cell) + 2;
    const grid = this.grid;
    grid.clear();
    for (const bird of this.birds) {
      bird.px = bird.x; bird.py = bird.y;
      bird.pvx = bird.vx; bird.pvy = bird.vy;
      const key = Math.floor(bird.y / cell) * columns + Math.floor(bird.x / cell);
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(bird);
    }
    const obstacles = this.obstaclesEnabled ? this.obstacles : [];
    for (const bird of this.birds) {
      let vx = 0, vy = 0, cx = 0, cy = 0, sx = 0, sy = 0, neighbours = 0;
      const gx = Math.floor(bird.x / cell), gy = Math.floor(bird.y / cell);
      for (let y = gy - 1; y <= gy + 1; y++) {
        for (let x = gx - 1; x <= gx + 1; x++) {
          const nearby = grid.get(y * columns + x);
          if (!nearby) continue;
          for (const other of nearby) {
            if (bird === other) continue;
            const dx = other.px - bird.px, dy = other.py - bird.py;
            const distance2 = dx * dx + dy * dy;
            if (distance2 > cell * cell) continue;
            neighbours++; vx += other.pvx; vy += other.pvy; cx += other.px; cy += other.py;
            if (distance2 < 22 * 22) {
              const distance = Math.max(1, Math.sqrt(distance2));
              sx -= dx / distance * (22 - distance); sy -= dy / distance * (22 - distance);
            }
          }
        }
      }
      let ax = 0, ay = 0;
      if (neighbours) {
        ax = (vx / neighbours - bird.vx) * 1.2 + (cx / neighbours - bird.px) * .65 + sx * 2.4;
        ay = (vy / neighbours - bird.vy) * 1.2 + (cy / neighbours - bird.py) * .65 + sy * 2.4;
      }
      // Smoothly turn back into the world rather than teleporting at its edges.
      const margin = Math.min(75, this.width * .12, this.height * .12);
      if (bird.x < margin) ax += (margin - bird.x) * 4;
      if (bird.x > this.width - margin) ax -= (bird.x - this.width + margin) * 4;
      if (bird.y < margin) ay += (margin - bird.y) * 4;
      if (bird.y > this.height - margin) ay -= (bird.y - this.height + margin) * 4;
      for (const obstacle of obstacles) {
        const dx = bird.x - obstacle.x, dy = bird.y - obstacle.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const reach = obstacle.radius + 55;
        if (distance < reach) {
          const force = (reach - distance) * 12;
          ax += dx / distance * force; ay += dy / distance * force;
        }
      }
      if (this.pointer.active) {
        const dx = this.pointer.x - bird.x, dy = this.pointer.y - bird.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const reach = this.pointer.repel ? 190 : 360;
        if (distance < reach) {
          const force = (this.pointer.repel ? -700 : 170) * (1 - distance / reach);
          ax += dx / distance * force; ay += dy / distance * force;
        }
      }
      bird.vx += ax * dt; bird.vy += ay * dt;
      const magnitude = Math.max(.001, Math.hypot(bird.vx, bird.vy));
      const target = Math.max(55, Math.min(125, magnitude));
      bird.vx = bird.vx / magnitude * target; bird.vy = bird.vy / magnitude * target;
      bird.x = Math.max(0, Math.min(this.width, bird.x + bird.vx * dt));
      bird.y = Math.max(0, Math.min(this.height, bird.y + bird.vy * dt));
    }
  }
}
