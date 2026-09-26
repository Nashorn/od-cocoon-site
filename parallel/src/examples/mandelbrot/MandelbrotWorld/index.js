import 'examples.mandelbrot.MandelbrotField';
export default

namespace `examples.mandelbrot` (
  class MandelbrotWorld extends World {
    async onConnected() {
      await super.onConnected();
      this.unsubscribeReady = this.subscribe('mandelbrot:ready', e => this.onFieldReady(e));
      this.visibilityChanged = e => this.onVisibilityChange(e);
      document.addEventListener('visibilitychange', this.visibilityChanged);
    }

    onFieldReady(event) {
      this.field = event.detail.field;
      this.observer?.disconnect();
      this.observer = new IntersectionObserver(e => this.onIntersection(e));
      this.observer.observe(this.field);
    }

    // The loop only drives the heartbeat and tile highlights, so it runs only on screen.
    // The first render waits for the field to be seen: it is the heaviest thing on the page.
    onIntersection(entries) {
      this.visible = entries[0].isIntersecting;
      this.onUpdateRunning();
      if (this.visible && !this.field.hasRendered) this.field.renderView();
    }

    onVisibilityChange() { this.onUpdateRunning(); }

    onUpdate(timestamp) {
      this.field?.onFrame(timestamp);
    }

    onDraw() {
      this.field?.onDraw();
    }

    getSimulationTimestep() {
      return 1000 / 60;
    }

    onUpdateRunning() {
      if (this.visible && !document.hidden && this.field) this.onStart();
      else this.onStop();
    }

    onDisconnected() {
      this.onStop();
      this.observer?.disconnect();
      this.unsubscribeReady?.();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
    }
  }
);
