const frame = document.querySelector('#showcase-frame');
frame.src = `/showcase/index.html?session=${crypto.randomUUID()}`;
let pendingMode;
let ready = false;
addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'cocoon-showcase') return;
  if (Number.isFinite(event.data.height) && event.data.height > 0) frame.style.height = `${event.data.height}px`;
  if (event.data.ready) {
    ready = true;
    document.querySelector('[data-showcase-loading]')?.remove();
    if (pendingMode) { frame.contentWindow.postMessage({ type: 'cocoon-showcase-mode', mode: pendingMode }, location.origin); pendingMode = null; }
  }
});
document.querySelectorAll('[data-showcase-mode]').forEach(link => link.addEventListener('click', () => {
  if (!ready) pendingMode = link.dataset.showcaseMode;
  else frame.contentWindow.postMessage({ type: 'cocoon-showcase-mode', mode: link.dataset.showcaseMode }, location.origin);
}));
