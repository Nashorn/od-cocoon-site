import 'examples.flocking.FlockingField';
export default 

namespace `examples.flocking` (
  class FlockingWorld extends World {
    async onConnected() {
      await super.onConnected();
      this.subscribe('flocking:ready', event => {
        this.field = event.detail.field;
        this.observer?.disconnect();
        this.observer = new IntersectionObserver(entries => {
          this.visible = entries[0].isIntersecting;
          this.updateRunning();
        });
        this.observer.observe(this.field);
      });
      this.subscribe('flocking:playback', () => this.updateRunning());
      this.subscribe('flocking:fps-limit', event => {
        const fps = event.detail.fps;
        if (fps !== Infinity && (!Number.isFinite(fps) || fps < 15 || fps > 120)) return;
        MainLoop.setMaxAllowedFPS(fps);
        if (this.field) { this.field.frames = 0; this.field.lastMeter = 0; }
      });
      this.visibilityChanged = () => this.updateRunning();
      document.addEventListener('visibilitychange', this.visibilityChanged);
    }

    // Cocoon passes these callbacks directly to its World loop.
    onUpdate = (timestamp, delta) => this.field?.onUpdate(timestamp, delta);
    onFixedUpdate = milliseconds => this.field?.onFixedUpdate(milliseconds);
    onDraw = interpolation => this.field?.onDraw(interpolation);

    getSimulationTimestep() { return 1000 / 60; }

    updateRunning() {
      if (this.visible && !document.hidden && this.field?.running) {
        if (!MainLoop.isRunning()) { this.field.frames = 0; this.field.lastMeter = 0; }
        MainLoop.start();
      }
      else MainLoop.stop();
    }

    onDisconnected() {
      MainLoop.stop();
      this.observer?.disconnect();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
    }
  }
);
