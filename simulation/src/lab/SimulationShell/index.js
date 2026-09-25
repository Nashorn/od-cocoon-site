import 'examples.flocking.FlockingField';
import { ExampleFiles } from '../../../core/ExampleFiles.js';

namespace `lab` (
  class SimulationShell extends Component {
    styles = ['../showcase/src/lab/shared.css', '../styles/interactive-shell.css'];

    static tag = 'arc-simulation';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.subscribe('flocking:ready', event => {
        this.field = event.detail.field;
        this.syncPlayback();
        this.fire('simulation:ready');
        window.simulationFrame?.ready();
      });
      this.subscribe('flocking:metrics', event => {
        this.querySelector('#fps').textContent = `${event.detail.fps} FPS`;
      });
      this.root.querySelectorAll('[data-mode]').forEach(button => {
        this.on('click', () => {
          this.field.setMode(button.dataset.mode);
          this.root.querySelectorAll('[data-mode]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
        }, false, button);
      });
      this.on('click', () => {
        this.field.model.obstaclesEnabled = !this.field.model.obstaclesEnabled;
        this.querySelector('#obstacles').setAttribute('aria-pressed', String(this.field.model.obstaclesEnabled));
        this.field.onDraw(1);
      }, false, this.querySelector('#obstacles'));
      this.on('input', event => {
        const count = Number(event.target.value);
        this.field.model.setCount(count);
        this.querySelector('#agent-count').textContent = count;
        this.querySelector('#world-status').textContent = `${count} agents · Autonomous steering`;
        this.field.onDraw(1);
      }, false, this.querySelector('#agents'));
      this.on('input', event => {
        this.field.model.speed = Number(event.target.value);
        this.querySelector('#speed-value').textContent = `${event.target.value}×`;
      }, false, this.querySelector('#speed'));
      this.on('click', () => { this.field.setPaused(!this.field.paused); this.syncPlayback(); }, false, this.querySelector('#pause'));
      this.on('click', () => this.reset(), false, this.querySelector('#reset'));
      this.on('click', () => this.showSource(), false, this.querySelector('#view-source'));
      this.on('click', () => this.closeSource(), false, this.querySelector('#close-source'));
      this.on('click', () => this.download(), false, this.querySelector('#download'));
    }

    syncPlayback() {
      if (!this.field) return;
      const button = this.querySelector('#pause');
      button.textContent = this.field.paused ? '▷ Resume' : 'Ⅱ Pause';
      button.setAttribute('aria-pressed', String(this.field.paused));
      this.querySelector('#live-label').textContent = this.field.paused ? 'PAUSED' : 'LIVE';
      this.querySelector('#fps').textContent = this.field.paused ? 'PAUSED' : '— FPS';
    }

    reset() {
      this.field.model.setCount(400);
      this.field.model.speed = 1;
      this.field.model.obstaclesEnabled = true;
      this.field.model.pointer.active = false;
      this.field.model.reset();
      this.field.setMode('attract');
      this.field.onDraw(1);
      this.querySelector('#agents').value = 400;
      this.querySelector('#agent-count').textContent = '400';
      this.querySelector('#speed').value = 1;
      this.querySelector('#speed-value').textContent = '1×';
      this.querySelector('#world-status').textContent = '400 agents · Autonomous steering';
      this.querySelector('#obstacles').setAttribute('aria-pressed','true');
      this.root.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === 'attract')));
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
          explorer.openFile('src/examples/flocking/FlockingWorld/index.js');
          this.sourceLoaded = true;
        }
        this.querySelector('#live-label').textContent = 'SOURCE';
        this.querySelector('#fps').textContent = 'PAUSED';
        this.field.sourceOpen = true;
        this.field.fire('flocking:playback');
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
      this.field.sourceOpen = false;
      this.syncPlayback();
      this.field.fire('flocking:playback');
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
