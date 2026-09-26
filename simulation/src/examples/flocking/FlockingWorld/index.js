import 'examples.flocking.FlockingField';
export default 

namespace `examples.flocking` (
  class FlockingWorld extends World {
    async onConnected() {
      await super.onConnected();
      this.unsubscribeReady    = this.subscribe('flocking:ready',     e => this.onFlockingReady(e));
      this.unsubscribePlayback = this.subscribe('flocking:playback',  e => this.onPlaybackChange(e));
      this.unsubscribeFpsLimit = this.subscribe('flocking:fps-limit', e => this.onFpsLimit(e));
      
      this.visibilityChanged   = e => this.onVisibilityChange(e);
      document.addEventListener('visibilitychange', this.visibilityChanged);
    }

    onFlockingReady(event) {
      this.field = event.detail.field;
      this.observer?.disconnect();
      this.observer = new IntersectionObserver(e => this.onIntersection(e));
      this.observer.observe(this.field);
    }

    // Only run simulation if the canvas is visible in the viewport
    onIntersection(entries) {
      this.visible = entries[0].isIntersecting;
      this.onUpdateRunning();
    }

    onPlaybackChange() { 
      this.onUpdateRunning(); 
    }

    onFpsLimit(event) {
      const fps = event.detail.fps;
      if (fps !== Infinity && (!Number.isFinite(fps) || fps < 15 || fps > 120)) return;
      this.setMaxAllowedFPS(fps);
      if (this.field) { this.field.frames = 0; this.field.lastMeter = 0; }
    }

    onVisibilityChange() { this.onUpdateRunning(); }

    onUpdate(timestamp, delta) {
      this.field?.onUpdate(timestamp, delta);
    }

    onFixedUpdate(milliseconds) {
      this.field?.onFixedUpdate(milliseconds);
    }

    onDraw(interpolation) {
      this.field?.onDraw(interpolation);
    }

    getSimulationTimestep() { 
      return 1000 / 60; // 60 FPS fixed timestep
    }

    onUpdateRunning() {
      if (this.visible && !document.hidden && this.field?.running) {
        if (!this.isRunning()) { this.field.frames = 0; this.field.lastMeter = 0; }
        this.onStart();
      }
      else this.onStop();
    }

    onDisconnected() {
      this.onStop();
      this.observer?.disconnect();
      this.unsubscribeReady?.();
      this.unsubscribePlayback?.();
      this.unsubscribeFpsLimit?.();
      document.removeEventListener('visibilitychange', this.visibilityChanged);
    }
  }
);
