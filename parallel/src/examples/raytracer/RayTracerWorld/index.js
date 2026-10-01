import 'examples.raytracer.RayTracerField';
export default

namespace `examples.raytracer` (
  class RayTracerWorld extends World {
    async onConnected() {
      await super.onConnected();
      this.unsubscribeReady = this.subscribe('raytracer:ready', event => {
        this.field = event.detail.field;
        this.observer?.disconnect();
        this.observer = new IntersectionObserver(entries => {
          this.visible = entries[0].isIntersecting;
          this.updateVisibility();
        });
        this.observer.observe(this.field);
      });
      this.visibilityChanged = () => this.updateVisibility();
      this.unload = () => { this.field?.stop(); this.onStop(); };
      document.addEventListener('visibilitychange', this.visibilityChanged);
      window.addEventListener('pagehide', this.unload);
    }

    updateVisibility() {
      const active = Boolean(this.visible && !document.hidden && this.field);
      if (active) this.onStart(); else this.onStop();
      this.field?.setVisible(active);
    }
    onUpdate(timestamp) { this.field?.onFrame(timestamp); }
    onDraw() { this.field?.onDraw(); }
    getSimulationTimestep() { return 1000 / 60; }

    onDisconnected() {
      this.unload();
      this.observer?.disconnect();
      this.unsubscribeReady?.();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
      window.removeEventListener('pagehide', this.unload);
    }
  }
);
