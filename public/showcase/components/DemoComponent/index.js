const common = `
  :host { font-family: 'Instrument Sans', system-ui, sans-serif; color: #eef2fa; }
  *, *::before, *::after { box-sizing: border-box; -webkit-user-select: none; user-select: none; }
  input, textarea, [contenteditable="true"] { -webkit-user-select: text; user-select: text; }
  button, select, input, textarea { font: inherit; }
  button, select { cursor: pointer; }
  button { color: inherit; }
  button:disabled { cursor: default; opacity: .5; }
  :host(:focus-visible), :focus-visible { outline: 2px solid #a9c8ff; outline-offset: 4px; }
  [hidden] { display: none !important; }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { transition-duration: 0s !important; animation: none !important; } }
`;

/** Lifecycle shared by the real Cocoon components; all listeners have an owner. */
export class DemoComponent extends WebComponent {
  static skin = null;
  static tag = 'arc-demo-component';
  static { this.define(); }
  constructor() {
    super();
    this.ready = new Promise(resolve => { this.resolveReady = resolve; });
  }
  inShadow() { return true; }
  html() { return '<slot></slot>'; }
  css() { return common; }
  async onConnected() {
    if (this.mounted) return;
    this.mounted = true;
    const lifetime = this.lifetime = new AbortController();
    this._stylesheets = [];
    this._stylesheetsLoaded = false;
    this.root.adoptedStyleSheets = [];
    await super.onConnected();
    if (lifetime.signal.aborted) return;
    await this.mount();
    if (!lifetime.signal.aborted) this.resolveReady(this);
  }
  mount() {}
  onDisconnected() {
    this.mounted = false;
    this.lifetime?.abort();
    this.dispose?.();
    this.ready = new Promise(resolve => { this.resolveReady = resolve; });
  }
  listen(target, event, listener, options = {}) {
    target.addEventListener(event, listener, { ...options, signal: this.lifetime.signal });
  }
  enableSurfaceSelection(component) {
    this.tabIndex = 0;
    this.setAttribute('role', 'group');
    this.setAttribute('aria-label', `Inspect ${this.constructor.name}`);
    this.style.cursor = 'pointer';
    const select = () => this.session?.publish(this, 'inspect:requested', { component });
    this.listen(this, 'click', event => {
      if (event.composedPath().some(el => el !== this && el.matches?.('button, select, input, textarea, a, label'))) return;
      select();
    });
    this.listen(this, 'keydown', event => {
      if (event.composedPath()[0] !== this || !['Enter', ' '].includes(event.key)) return;
      event.preventDefault(); select();
    });
  }
  $(selector) { return this.root.querySelector(selector); }
}
