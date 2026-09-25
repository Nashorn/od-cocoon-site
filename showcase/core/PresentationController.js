const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** All mode changes interrupt a single owned timeline; the UI is never cloned. */
export class PresentationController {
  constructor(view, team, overlay) {
    this.view = view; this.team = team; this.overlay = overlay;
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.state = 'interface'; this.mode = 'explore'; this.yaw = -17; this.pitch = 19;
    this.paused = false; this.lastFlow = { flow: 'approve', person: team.parts.toolbar.person };
  }
  begin() {
    this.cancelIntro();
    this.job?.abort();
    this.job = new AbortController();
    this.paused = false;
    this.overlay.clear();
    return this.job.signal;
  }
  armIntro(viewport) {
    this.introObserver = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      this.introObserver.disconnect();
      // A brief beat lets the assembled surface register before it opens.
      this.introTimer = setTimeout(() => {
        this.introTimer = null;
        this.setMode('explore');
      }, 100);
    }, { threshold: 0 });
    this.introObserver.observe(viewport);
  }
  cancelIntro() {
    this.introObserver?.disconnect();
    if (this.introTimer != null) clearTimeout(this.introTimer);
    this.introTimer = null;
  }
  setState(state) { this.state = state; this.view.updateState(this); }
  async wait(duration, signal, draw) {
    if (signal.aborted) return false;
    if (this.motion.matches) { draw?.(1); return true; }
    return new Promise(resolve => {
      let elapsed = 0, previous = performance.now(), frame;
      const finish = result => { cancelAnimationFrame(frame); signal.removeEventListener('abort', abort); resolve(result); };
      const abort = () => finish(false);
      signal.addEventListener('abort', abort, { once: true });
      const tick = now => {
        if (!this.paused) elapsed += Math.min(now - previous, 80);
        previous = now;
        draw?.(Math.min(1, elapsed / duration));
        if (elapsed >= duration) finish(true); else frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
  }
  async setMode(mode) {
    if (!['interface', 'explore', 'inspect'].includes(mode)) throw new TypeError('Unknown presentation mode');
    const signal = this.begin();
    this.mode = mode;
    this.team.explode(mode !== 'interface');
    this.setState(mode === 'interface' ? 'assembling' : 'exploding');
    if (!await this.wait(860, signal)) return;
    this.setState(mode === 'interface' ? 'interface' : mode === 'inspect' ? 'inspecting' : 'explore');
  }
  async play(flow, person, emit = true) {
    if (emit) { this.team.parts.toolbar.emit(flow, person); return; }
    const signal = this.begin();
    this.lastFlow = { flow, person };
    this.mode = 'explore';
    this.view.closeInspector();
    // Business state is synchronous and independent of presentation. Interrupting
    // the animation must never drop a requested user action.
    this.team.explode(true);
    this.setState('exploding');
    if (!await this.wait(860, signal)) return;
    this.overlay.show(flow);
    this.setState('playing');
    if (!await this.wait(1500, signal, progress => this.overlay.draw(progress))) return;
    this.setState('delivered');
    if (!await this.wait(1600, signal, () => this.overlay.draw(1))) return;
    this.setMode('interface');
  }
  replay() { this.play(this.lastFlow.flow, this.lastFlow.person); }
  togglePause() { this.paused = !this.paused; this.view.updateState(this); }
  rotate(yaw, pitch = this.pitch) {
    this.yaw = clamp(yaw, -25, 25); this.pitch = clamp(pitch, 6, 28);
    this.team.rotate(this.yaw, this.pitch);
    this.view.$('#rotation').value = this.yaw;
    this.view.$('#rotation-value').textContent = `${Math.round(this.yaw)}°`;
    if (this.state === 'delivered') this.overlay.draw(1);
  }
  setDepth(percent) {
    this.depth = clamp(percent, 0, 200);
    this.team.setDepth(this.depth / 100);
    this.view.$('#depth').value = this.depth;
    this.view.$('#depth-value').textContent = `${Math.round(this.depth)}%`;
    if (this.state === 'delivered') this.overlay.draw(1);
  }
  resetView() { this.rotate(-17, 19); this.setDepth(100); }
  reset() {
    this.begin(); this.view.closeInspector(); this.team.reset(); this.view.skin.reset(); this.view.syncEditor(); this.view.workspace?.syncSkin();
    this.resetView(); this.lastFlow = { flow: 'approve', person: this.team.parts.toolbar.person };
    this.setMode('interface');
  }
  dispose() { this.cancelIntro(); this.job?.abort(); this.overlay.clear(); }
}
