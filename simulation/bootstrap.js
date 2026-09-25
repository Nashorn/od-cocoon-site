const section = document.querySelector('#simulation');
const frame = document.querySelector('#simulation-frame');
const loading = section.querySelector('[data-simulation-loading]');
let started = false;
let timeout;
const load = () => {
  if (started) return;
  started = true;
  frame.src = './simulation/index.html';
  timeout = setTimeout(showError, 20000);
};
function showError() {
  loading.hidden = false;
  loading.querySelector('p').textContent = 'The world could not load. Try opening it directly.';
  loading.querySelector('a').hidden = false;
}
addEventListener('message', event => {
  if (event.source !== frame.contentWindow || event.origin !== location.origin || event.data?.type !== 'cocoon-simulation') return;
  if (Number.isFinite(event.data.height) && event.data.height > 0) frame.style.height = `${event.data.height}px`;
  if (event.data.ready) { clearTimeout(timeout); loading.hidden = true; frame.classList.add('ready'); }
  if (event.data.error) { clearTimeout(timeout); showError(); }
});
const observer = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) { load(); observer.disconnect(); }
}, {rootMargin:'400px 0px'});
observer.observe(section);
document.querySelectorAll('a[href="#simulation"]').forEach(link => link.addEventListener('click', load));
