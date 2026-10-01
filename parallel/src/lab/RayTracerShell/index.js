import 'lab.ParallelShell';
import 'examples.raytracer.RayTracerField';
import { RayTracerFiles } from '../../../core/RayTracerFiles.js';

namespace `lab` (
  class RayTracerShell extends lab.ParallelShell {
    static tag = 'arc-raytracer';
    get benchmark() { return 'raytracer'; }
    get exampleFiles() { return RayTracerFiles; }
    get sourceEntry() { return 'src/examples/raytracer/RayTracer.js'; }

    bindBenchmarkControls() {
      this.on('change', e => this.field.setSamples(Number(e.target.value)), false, this.querySelector('#samples'));
      this.on('click', () => this.field.stop(), false, this.querySelector('#stop'));
      this.subscribe('raytracer:orbit-start', () => {
        this.querySelector('#live-label').textContent = 'ORBITING';
        this.querySelector('#world-status').textContent = 'Orbit preview · workers · release to refine';
        this.querySelector('#render-time').textContent = '—';
        this.querySelector('#render-time').classList.remove('is-blocked');
        this.querySelector('#stop').disabled = false;
      });
      this.subscribe('raytracer:progress', e => {
        this.querySelector('#world-status').textContent = e.detail.phase === 'preview'
          ? `${this.describe(this.field.threads)} · quick preview`
          : `${this.describe(this.field.threads)} · ${e.detail.samples} / ${this.field.samples} samples · ${Math.round(e.detail.progress * 100)}%`;
      });
      this.subscribe('raytracer:stopped', () => {
        this.querySelector('#live-label').textContent = this.querySelector('.source-view').hidden ? 'PAUSED' : 'SOURCE';
        this.querySelector('#world-status').textContent = 'Render paused · last picture retained';
        this.querySelector('#stop').disabled = true;
      });
      this.subscribe('raytracer:error', e => {
        this.querySelector('#live-label').textContent = 'ERROR';
        this.querySelector('#world-status').textContent = `Render failed: ${e.detail.message}`;
        this.querySelector('#stop').disabled = true;
      });
    }

    onViewRenderStart({ samples, threads }) {
      if (!this.field.session.results.main && !this.field.session.results.threads) {
        this.querySelector('#render-time').textContent = '—';
        this.querySelector('#render-time').classList.remove('is-blocked');
      }
      this.querySelector('#live-label').textContent = 'RENDERING';
      this.querySelector('#world-status').textContent = `${this.describe(threads)} · ${samples} samples · preparing studio…`;
      this.querySelector('#stop').disabled = false;
    }

    onViewRendered(detail) {
      const { time, threads, samples, width, height, speedup, worstFrame } = detail;
      const parts = [`${(time / 1000).toFixed(1)} s`];
      if (speedup) parts.push(`threads ${speedup.toFixed(1)}× faster`);
      parts.push(`worst frame ${Math.round(worstFrame)} ms`);
      const metric = this.querySelector('#render-time');
      metric.textContent = parts.join(' · ');
      metric.classList.toggle('is-blocked', worstFrame > 100);
      this.querySelector('#world-status').textContent = `${this.describe(threads)} · ${samples} samples · ${width} × ${height}`;
      this.querySelector('#live-label').textContent = 'LIVE';
      this.querySelector('#stop').disabled = true;
      this.fire('analytics:track', { name: 'benchmark_run', params: { label: `Ray Tracer: ${this.describe(threads)}`, threads, render_ms: Math.round(time), speedup: speedup ? Math.round(speedup * 10) / 10 : undefined } });
    }

    reset() {
      this.querySelector('#samples').value = '96';
      this.root.querySelectorAll('[data-threads]').forEach(item => item.setAttribute('aria-pressed', String(item.dataset.threads === 'max')));
      this.querySelector('#render-time').textContent = '—';
      this.querySelector('#render-time').classList.remove('is-blocked');
      this.field.reset();
    }
  }
);
