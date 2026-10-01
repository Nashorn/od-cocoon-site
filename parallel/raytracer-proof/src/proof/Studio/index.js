import { RenderSession } from '../../../../src/examples/raytracer/RenderSession.js';

namespace `proof` (
  class Studio extends World {
    async onConnected() {
      await super.onConnected();
      this.canvas = document.querySelector('#scene');
      const width = Math.min(1440, Math.max(640, Math.round(this.canvas.clientWidth * Math.min(devicePixelRatio, 1.5))));
      this.session = new RenderSession(this.canvas, document.querySelector('#tiles'), { width, height: Math.round(width * 9 / 16) });
      this.status = document.querySelector('#status');
      this.stageState = document.querySelector('#stage-state');
      this.timing = document.querySelector('#timing');
      this.progress = document.querySelector('#progress-fill');
      this.pulse = document.querySelector('#pulse');
      this.quality = document.querySelector('#quality');
      this.renderButton = document.querySelector('#render');
      this.stopButton = document.querySelector('#stop');
      document.querySelector('#workers').textContent = `${this.session.maxThreads} Cocoon workers`;
      this.session.addEventListener('start', () => {
        this.stopButton.disabled = false; this.renderButton.disabled = true;
        this.progress.style.width = '0%'; this.timing.textContent = '';
        this.status.textContent = 'Preparing Cocoon’s thread pool…';
        this.stageState.textContent = 'Preparing studio…';
      });
      this.session.addEventListener('progress', e => {
        this.progress.style.width = `${e.detail.progress * 100}%`;
        this.stageState.textContent = e.detail.phase === 'preview' ? 'Quick preview' : `Refining · ${e.detail.samples} samples / pixel`;
        this.status.textContent = e.detail.phase === 'preview' ? 'Finding the light · quick preview' : `Refining reflections · ${e.detail.samples} / ${this.session.samples} samples`;
      });
      this.session.addEventListener('complete', e => {
        const { samples, width, height, time } = e.detail;
        this.status.textContent = `Complete · ${samples} samples / pixel · ${width} × ${height}`;
        this.stageState.textContent = 'Studio / soft light';
        this.timing.textContent = `${(time / 1000).toFixed(1)} s render`;
        this.progress.style.width = '100%';
        this.stopButton.disabled = true; this.renderButton.disabled = false;
      });
      this.session.addEventListener('cancel', () => {
        this.stopButton.disabled = true; this.renderButton.disabled = false;
        this.status.textContent = 'Stopped · the last picture is retained.';
        this.stageState.textContent = 'Render paused';
      });
      this.session.addEventListener('error', e => {
        this.status.textContent = `Render failed: ${e.detail.message}`;
        this.stageState.textContent = 'Render failed';
        this.stopButton.disabled = true; this.renderButton.disabled = false;
      });
      this.on('click', () => this.renderScene(), false, this.renderButton);
      this.on('click', () => this.session.cancel(), false, this.stopButton);
      this.on('change', () => this.renderScene(), false, this.quality);
      this.visibilityChanged = () => {
        if (document.hidden) { this.resumeOnVisible = this.running; this.session.cancel(); this.onStop(); }
        else { this.onStart(); if (this.resumeOnVisible) { this.resumeOnVisible = false; this.renderScene(); } }
      };
      document.addEventListener('visibilitychange', this.visibilityChanged);
      this.unload = () => this.session.cancel();
      addEventListener('pagehide', this.unload);
      window.rayStudio = this;
      this.onStart();
      this.renderScene();
    }
    get running() { return this.session?.running; }
    get started() { return this.session?.started; }
    get result() { return this.session?.result; }
    get error() { return this.session?.error; }
    get pool() { return this.session?.pool; }
    renderScene() { return this.session.render({ samples: Number(this.quality.value) }); }
    onUpdate(timestamp) {
      if (!this.session) return;
      this.session.frame(timestamp);
      if (!this.session.reducedMotion) this.pulse.style.transform = `translateX(${(timestamp / 20) % (this.pulse.parentElement.clientWidth - 6)}px)`;
      if (this.running && this.started) this.timing.textContent = `${((performance.now() - this.started) / 1000).toFixed(1)} s`;
    }
    onDraw() { this.session?.draw(); }
    onDisconnected() {
      this.session?.cancel(); this.onStop();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
      removeEventListener('pagehide', this.unload);
      if (window.rayStudio === this) delete window.rayStudio;
    }
  }
);
