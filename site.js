(() => {
  document.querySelectorAll('[data-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const status = document.getElementById(button.getAttribute('aria-describedby'));
      try {
        await navigator.clipboard.writeText(button.dataset.copy);
        if (status) status.textContent = 'Copied installation command.';
      } catch {
        const code = button.querySelector('code');
        if (code) {
          const range = document.createRange();
          range.selectNodeContents(code);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
        }
        if (status) status.textContent = 'Select and copy the command, or follow Get started.';
      }
    });
  });
})();

(() => {
  const links = [...document.querySelectorAll('.navlinks a[href^="#"]')];
  const sections = [...new Set(links.map(link => document.querySelector(link.hash)).filter(Boolean))];
  if (!links.length || !sections.length) return;

  let activeLink = null;

  function activate(link) {
    if (!link || link === activeLink) return;
    for (const item of links) item.removeAttribute('aria-current');
    link.setAttribute('aria-current', 'location');
    activeLink = link;
  }

  function activateSection(section) {
    const matching = links.filter(link => link.hash === `#${section.id}`);
    if (matching.includes(activeLink)) return;
    activate(matching[0]);
  }

  for (const link of links) {
    link.addEventListener('click', () => activate(link));
  }

  const observer = new IntersectionObserver(entries => {
    const visible = entries
      .filter(entry => entry.isIntersecting)
      .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) activateSection(visible.target);
  }, {
    rootMargin: '-18% 0px -62% 0px',
    threshold: [0, .01, .25],
  });

  sections.forEach(section => observer.observe(section));
  const initial = links.find(link => link.hash === location.hash);
  if (initial) activate(initial);
})();
