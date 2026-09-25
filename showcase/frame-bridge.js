// Only the landing-page boundary lives here; the scene remains inside the app.
(() => {
  const send = data => { if (parent !== window) parent.postMessage({ type: 'cocoon-showcase', ...data }, location.origin); };
  let scheduled = false;
  const report = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      const scene = document.querySelector('arc-showcase');
      if (scene) send({ height: Math.ceil(document.body.getBoundingClientRect().height) });
    });
  };
  window.showcaseFrame = {
    ready() {
      this.isReady = true;
      document.querySelector('#boot-error').hidden = true;
      const observer = new ResizeObserver(report);
      observer.observe(document.body);
      document.fonts.ready.then(report);
      send({ ready: true }); report();
    }
  };
  addEventListener('message', event => {
    if (event.source !== parent || event.origin !== location.origin || event.data?.type !== 'cocoon-showcase-mode') return;
    const scene = document.querySelector('arc-showcase');
    if (!scene?.presentation) return;
    if (event.data.mode === 'inspect') scene.inspect('member');
    else { scene.closeInspector(); scene.presentation.setMode('explore'); }
  });
  const showError = error => {
    if (window.showcaseFrame.isReady) return;
    const panel = document.querySelector('#boot-error');
    if (!panel) { addEventListener('DOMContentLoaded', () => showError(error), { once: true }); return; }
    document.querySelector('arc-showcase').style.display = 'none';
    panel.hidden = false;
    panel.querySelector('pre').textContent = error?.message || String(error);
    panel.querySelector('button').onclick = () => {
      const url = new URL('/showcase/index.html', location.origin);
      url.searchParams.set('session', new URLSearchParams(location.search).get('session') || 'default');
      url.searchParams.set('edit', '1'); location.replace(url);
    };
    send({ ready: true, height: 450 });
  };
  addEventListener('error', event => showError(event.error || event.message));
  addEventListener('unhandledrejection', event => showError(event.reason));
  setTimeout(() => { if (!window.showcaseFrame.isReady) showError(new Error('The example did not finish loading. Your draft is preserved.')); }, 15000);
})();
