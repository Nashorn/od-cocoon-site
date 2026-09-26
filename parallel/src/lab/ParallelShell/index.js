import 'examples.mandelbrot.MandelbrotField';
import { ExampleFiles } from '../../../core/ExampleFiles.js';

namespace `lab` (
  class ParallelShell extends Component {
    styles = ['../showcase/src/lab/shared.css', '../styles/interactive-shell.css', '../styles/interactive-lab.css'];

    static tag = 'arc-parallel';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.subscribe('mandelbrot:ready', event => {
        this.field = event.detail.field;
        this.setupThreadModes();
        this.fire('parallel:ready');
        window.parallelFrame?.ready();
      });
      this.subscribe('mandelbrot:render-start', event => this.onViewRenderStart(event.detail));
      this.subscribe('mandelbrot:rendered', event => this.onViewRendered(event.detail));
      this.on('click', event => {
        const button = event.target.closest('[data-threads]');
        if (button) this.setThreads(button);
      }, false, this.querySelector('.thread-modes'));
      this.on('input', event => {
        this.querySelector('#iterations-value').textContent = event.target.value;
      }, false, this.querySelector('#iterations'));
      // Re-render on release, not on every slider step: each render is real work.
      this.on('change', event => this.field.setIterations(Number(event.target.value)), false, this.querySelector('#iterations'));
      this.on('click', () => this.field.renderView(), false, this.querySelector('#render'));
      this.on('click', () => this.reset(), false, this.querySelector('#reset'));
      this.on('click', () => this.showSource(), false, this.querySelector('#view-source'));
      this.on('click', () => this.closeSource(), false, this.querySelector('#close-source'));
      this.on('click', () => this.download(), false, this.querySelector('#download'));
    }

    // Fixed counts at or above this device's pool size would duplicate "All".
    setupThreadModes() {
      const max = this.field.maxThreads;
      const label = this.querySelector('.thread-count');
      label.value = max;
      label.textContent = max;
      this.root.querySelectorAll('[data-threads]').forEach(button => {
        const count = Number(button.dataset.threads);
        button.hidden = count >= max;
      });
    }

    threadsFor(button) {
      return button.dataset.threads === 'max' ? this.field.maxThreads : Number(button.dataset.threads);
    }

    setThreads(button) {
      this.root.querySelectorAll('[data-threads]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      this.field.setThreads(this.threadsFor(button));
    }

    describe(threads) {
      if (!threads) return 'Main thread';
      return `${threads} thread${threads === 1 ? '' : 's'}`;
    }

    onViewRenderStart({ tiles, threads }) {
      this.querySelector('#live-label').textContent = 'RENDERING';
      this.querySelector('#world-status').textContent = `${this.describe(threads)} · ${tiles} tiles · ${this.field.iterations} iterations · rendering…`;
    }

    onViewRendered({ time, threads, tiles, worstFrame, startup, speedup }) {
      const ms = value => `${Math.round(value)} ms`;
      const parts = [ms(time)];
      if (speedup) parts.push(`threads ${speedup.toFixed(1)}× faster`);
      if (worstFrame) parts.push(`worst frame ${ms(worstFrame)}`);
      const metric = this.querySelector('#render-time');
      metric.textContent = parts.join(' · ');
      // Anything past ~100 ms is a stall a person can feel.
      metric.classList.toggle('is-blocked', worstFrame > 100);
      const pool = startup ? ` · pool ready in ${ms(startup)}` : '';
      this.querySelector('#world-status').textContent = `${this.describe(threads)} · ${tiles} tiles · ${this.field.iterations} iterations${pool}`;
      this.querySelector('#live-label').textContent = 'LIVE';
      this.fire('analytics:track', { name: 'benchmark_run', params: {
        label: this.describe(threads),
        threads,
        render_ms: Math.round(time),
        speedup: speedup ? Math.round(speedup * 10) / 10 : undefined,
      } });
    }

    reset() {
      this.field.reset();
      this.querySelector('#iterations').value = this.field.iterations;
      this.querySelector('#iterations-value').textContent = this.field.iterations;
      this.root.querySelectorAll('[data-threads]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.threads === 'max')));
      this.querySelector('#render-time').textContent = '—';
      this.querySelector('#render-time').classList.remove('is-blocked');
    }

    async loadFiles() {
      if (!this.files) this.files = await ExampleFiles.load();
      return this.files;
    }

    async showSource() {
      const button = this.querySelector('#view-source');
      button.disabled = true;
      this.querySelector('#action-status').textContent = '';
      try {
        await this.loadFiles();
        if (!customElements.get('code-explorer')) await import('/code-explorer.js');
        await customElements.whenDefined('code-explorer');
        const explorer = this.querySelector('#source-explorer');
        if (!this.sourceLoaded) {
          explorer.setFiles(this.files);
          explorer.openFile('src/examples/mandelbrot/MandelbrotField/index.js');
          this.sourceLoaded = true;
        }
        this.querySelector('#live-label').textContent = 'SOURCE';
        this.querySelector('.experience').hidden = true;
        this.querySelector('.control-bar').hidden = true;
        this.querySelector('.source-view').hidden = false;
        this.querySelector('#close-source').focus();
      } catch(error) { this.querySelector('#action-status').textContent = error.message; }
      finally { button.disabled = false; }
    }

    closeSource() {
      this.querySelector('.source-view').hidden = true;
      this.querySelector('.experience').hidden = false;
      this.querySelector('.control-bar').hidden = false;
      this.querySelector('#live-label').textContent = 'LIVE';
      this.querySelector('#view-source').focus();
    }

    async download() {
      const button = this.querySelector('#download');
      button.disabled = true; button.setAttribute('aria-busy','true');
      const status = this.querySelector('#action-status');
      status.textContent = 'Preparing example…';
      try { await ExampleFiles.download(await this.loadFiles()); status.textContent = 'Downloaded. Extract and serve locally to run.'; }
      catch(error) { status.textContent = error.message; }
      finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }
);
