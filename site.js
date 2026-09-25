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
