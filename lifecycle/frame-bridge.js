(() => {
  const send = data => {
    if (parent !== window) parent.postMessage({ type: 'cocoon-lifecycle', ...data }, location.origin);
  };
  let scheduled = false;
  const report = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      send({ height: Math.ceil(document.body.getBoundingClientRect().height) });
    });
  };
  window.lifecycleFrame = {
    ready() {
      if (this.isReady) return;
      this.isReady = true;
      new ResizeObserver(report).observe(document.body);
      document.fonts.ready.then(report);
      send({ ready: true });
      report();
    }
  };
  const fail = () => {
    if (window.lifecycleFrame.isReady) return;
    const error = document.querySelector('#boot-error');
    if (error) error.hidden = false;
    send({ error: true });
  };
  addEventListener('error', fail);
  addEventListener('unhandledrejection', fail);
})();
