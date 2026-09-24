import './components/ArcShowcase/index.js';

const showcase = document.querySelector('arc-showcase');
showcase.ready.then(() => {
  document.querySelector('[data-showcase-loading]')?.remove();
  document.querySelectorAll('[data-showcase-mode]').forEach(link => link.addEventListener('click', () => {
    if (link.dataset.showcaseMode === 'inspect') showcase.inspect('member');
    else { showcase.closeInspector(); showcase.presentation.setMode('explore'); }
  }));
});
