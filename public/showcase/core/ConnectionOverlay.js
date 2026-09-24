const svgNS = 'http://www.w3.org/2000/svg';
const node = (name, attributes) => {
  const element = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};

/** Named live endpoints; no coordinates are coupled to the product layout. */
export class ConnectionOverlay {
  constructor(svg, registry) { this.svg = svg; this.registry = registry; }
  show(flow) {
    this.clear();
    this.connection = this.registry[flow];
    this.lines = this.connection.targets.map(() => {
      const path = node('path', { fill: 'none', stroke: '#55efc6', 'stroke-width': '1.5', opacity: '.65' });
      const dot = node('circle', { r: '4', fill: '#b9ffe9', class: 'signal-dot' });
      this.svg.append(path, dot);
      return { path, dot };
    });
    this.label = node('text', { fill: '#8dffdb', 'font-size': '11', 'font-family': 'monospace', 'text-anchor': 'middle', 'paint-order': 'stroke', stroke: '#070d17', 'stroke-width': '7', 'stroke-linejoin': 'round' });
    this.label.textContent = this.connection.name;
    this.svg.append(this.label);
    this.svg.classList.add('active');
    this.draw(0);
  }
  point(element) {
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    const origin = this.svg.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - origin.left, y: rect.top + rect.height / 2 - origin.top };
  }
  draw(progress) {
    if (!this.connection) return;
    const start = this.point(this.connection.source());
    if (!start) return;
    this.connection.targets.forEach((getTarget, i) => {
      const end = this.point(getTarget());
      if (!end) return;
      const bend = Math.max(30, Math.abs(end.y - start.y) * .5);
      const line = this.lines[i];
      line.path.setAttribute('d', `M ${start.x} ${start.y} C ${start.x} ${start.y + bend}, ${end.x} ${end.y - bend}, ${end.x} ${end.y}`);
      const point = line.path.getPointAtLength(line.path.getTotalLength() * Math.min(1, progress));
      line.dot.setAttribute('cx', point.x);
      line.dot.setAttribute('cy', point.y);
    });
    this.label.setAttribute('x', start.x - 65);
    this.label.setAttribute('y', start.y + 32);
  }
  clear() { this.svg.replaceChildren(); this.svg.classList.remove('active'); this.connection = null; }
}
