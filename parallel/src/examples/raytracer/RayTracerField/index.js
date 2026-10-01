import { RenderSession } from '../RenderSession.js';
import { homeView, orbitView, cameraPosition } from '../OrbitCamera.js';

namespace `examples.raytracer` (
  class RayTracerField extends Component {
    static tag = 'arc-raytracer-field';
    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.canvas = this.querySelector('.scene');
      this.pulse = this.querySelector('.heartbeat-dot');
      this.hint = this.querySelector('#field-hint');
      this.progress = this.querySelector('.progress-fill');
      this.session = new RenderSession(this.canvas, this.querySelector('.overlay'), this.dimensions());
      this.view = { ...homeView };
      for (const [type, event] of Object.entries({ start: 'render-start', progress: 'progress', complete: 'rendered', cancel: 'stopped', error: 'error' })) {
        this.session.addEventListener(type, e => {
          if (type === 'start') { this.hint.textContent = 'Preparing studio…'; this.progress.style.width = '0%'; }
          if (type === 'progress') {
            this.hint.textContent = e.detail.phase === 'preview' ? 'Quick preview' : `Refining · ${e.detail.samples} samples / pixel`;
            this.progress.style.width = `${e.detail.progress * 100}%`;
          }
          if (type === 'complete') { this.hint.textContent = 'Drag to orbit · release to refine'; this.progress.style.width = '100%'; }
          if (type === 'cancel') this.hint.textContent = 'Render paused';
          if (type === 'error') this.hint.textContent = 'Render failed';
          this.fire(`raytracer:${event}`, e.detail);
        });
      }
      this.session.addEventListener('orbit-start', () => {
        this.hint.textContent = 'Orbit preview · release to refine';
        this.progress.style.width = '0%';
        this.fire('raytracer:orbit-start');
      });
      this.on('pointerdown', e => this.beginDrag(e), false, this.canvas);
      this.on('pointermove', e => this.moveDrag(e), false, this.canvas);
      for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
        this.on(type, e => { if (this.drag?.id === e.pointerId) this.endDrag(true); }, false, this.canvas);
      }
      this.on('keydown', e => this.onOrbitKey(e), false, this.canvas);
      this.on('click', () => this.resetView(), false, this.querySelector('#reset-view'));
      this.resizeObserver = new ResizeObserver(() => {
        clearTimeout(this.resizeTimer);
        this.resizeTimer = setTimeout(() => {
          if (!this.canvas.clientWidth) return;
          const { width, height } = this.dimensions();
          if (width !== this.session.width || height !== this.session.height) this.endDrag(false);
          if (this.session.resize(width, height)) {
            if (this.visible) this.renderView();
            else this.resumeOnVisible ||= this.session.hasRendered;
          }
        }, 200);
      });
      this.resizeObserver.observe(this);
      this.fire('raytracer:ready', { field: this });
    }

    dimensions() {
      const width = Math.min(1440, Math.max(640, Math.round(this.canvas.clientWidth * Math.min(devicePixelRatio || 1, 1.5))));
      return { width, height: Math.round(width * 9 / 16) };
    }

    get maxThreads() { return this.session.maxThreads; }
    get threads() { return this.session.threads; }
    get samples() { return this.session.samples; }
    get rendering() { return this.session.running; }
    renderView() { this.endDrag(false); this.resumeOnVisible = false; return this.session.render(); }
    setThreads(threads) { this.endDrag(false); return this.session.render({ threads }); }
    setSamples(samples) { this.endDrag(false); return this.session.render({ samples }); }
    reset() {
      this.endDrag(false); this.view = { ...homeView }; this.session.setCamera(cameraPosition(this.view));
      return this.session.render({ samples: 96, threads: this.maxThreads });
    }
    resetView() {
      this.endDrag(false); this.view = { ...homeView }; this.session.setCamera(cameraPosition(this.view));
      return this.renderView();
    }
    stop() { this.endDrag(false); this.resumeOnVisible = false; this.session.cancel(); }

    beginDrag(event) {
      if (!event.isPrimary || event.button !== 0 || this.drag) return;
      clearTimeout(this.orbitKeyTimer);
      this.drag = { id: event.pointerId, type: event.pointerType, x: event.clientX, y: event.clientY, view: { ...this.view }, active: this.session.orbiting };
      this.canvas.setPointerCapture(event.pointerId);
    }

    moveDrag(event) {
      if (this.drag?.id !== event.pointerId) return;
      const dx = event.clientX - this.drag.x, dy = event.clientY - this.drag.y;
      if (!this.drag.active && this.drag.type === 'touch' && Math.abs(dy) > Math.abs(dx)) return;
      if (!this.drag.active && Math.hypot(dx, dy) < 4) return;
      this.drag.active = true;
      this.canvas.classList.add('is-dragging');
      this.view = orbitView(this.drag.view, dx, dy);
      this.session.preview(cameraPosition(this.view));
    }

    endDrag(refine) {
      clearTimeout(this.orbitKeyTimer);
      const drag = this.drag;
      this.drag = null;
      this.canvas.classList.remove('is-dragging');
      if (drag && this.canvas.hasPointerCapture(drag.id)) this.canvas.releasePointerCapture(drag.id);
      if (refine && drag?.active) {
        if (this.visible) this.renderView();
        else { this.resumeOnVisible = true; this.session.cancel(); }
      }
    }

    onOrbitKey(event) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === 'Home') { event.preventDefault(); this.resetView(); return; }
      const delta = { ArrowLeft: [-20, 0], ArrowRight: [20, 0], ArrowUp: [0, -14], ArrowDown: [0, 14] }[event.key];
      if (!delta) return;
      event.preventDefault();
      this.endDrag(false);
      this.view = orbitView(this.view, ...delta);
      this.session.preview(cameraPosition(this.view));
      this.orbitKeyTimer = setTimeout(() => { if (this.visible) this.renderView(); }, 180);
    }

    setVisible(visible) {
      this.visible = visible;
      if (!visible) {
        this.resumeOnVisible ||= this.rendering;
        this.endDrag(false);
        if (this.rendering) this.session.cancel();
      } else if (!this.session.hasRendered || this.resumeOnVisible) this.renderView();
    }

    onFrame(timestamp) {
      this.session.frame(timestamp);
      if (!this.session.reducedMotion) {
        const track = this.pulse.parentElement.clientWidth - 6;
        if (track > 0) this.pulse.style.transform = `translateX(${(timestamp / 20) % track}px)`;
      }
    }
    onDraw() { this.session.draw(); }

    onDisconnected() {
      this.endDrag(false);
      clearTimeout(this.resizeTimer);
      this.resizeObserver?.disconnect();
      this.session?.cancel(false);
    }
  }
);
