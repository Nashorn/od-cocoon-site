import { ExampleFiles } from '../../../core/ExampleFiles.js';

namespace `lab` (
  class GettingStarted extends Component {
    styles = ['../showcase/src/lab/shared.css', '../styles/interactive-shell.css'];

    static tag = 'arc-getting-started';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.root.querySelectorAll('[data-step]').forEach(button => {
        this.on('click', () => this.selectStep(Number(button.dataset.step)), false, button);
      });
      this.on('click', () => this.showSource(), false, this.querySelector('#view-source'));
      this.on('click', () => this.closeSource(), false, this.querySelector('#close-source'));
      for (const button of this.root.querySelectorAll('[data-download]')) this.on('click', () => this.download(), false, button);
      this.on('click', () => this.replay(), false, this.querySelector('#replay'));
      this.on('click', event => {
        const button = event.target.closest('[data-file]');
        if (button) this.showSource(button.dataset.file);
      }, false, this.querySelector('#changed-files'));
      await this.selectStep(0);
      window.gettingStartedFrame?.ready();
    }

    async selectStep(step) {
      if (step === this.step && !this.loading) return;
      this.loading = true;
      const transition = this.files && !this.sourceOpen;
      const started = performance.now();
      this.setPreviewLoading(Boolean(transition));
      const request = this.request = (this.request || 0) + 1;
      this.querySelector('#action-status').textContent = 'Loading example…';
      this.querySelector('.step-changes').setAttribute('aria-busy', 'true');
      this.querySelector('#download').disabled = true;
      this.querySelector('#view-source').disabled = true;
      try {
        const files = await ExampleFiles.load(step);
        if (request !== this.request) return;
        const previous = this.files;
        this.step = step;
        this.files = files;
        this.renderChanges(previous);
        const copy = ExampleFiles.steps[step];
        for (const [id, value] of Object.entries({ 'step-label': copy.label, 'step-title': copy.title, 'step-copy': copy.description, 'step-detail': copy.detail })) this.querySelector('#' + id).textContent = value;
        this.root.querySelectorAll('[data-step]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.step) === step)));
        const painted = this.replay();
        if (this.sourceOpen) this.updateSource();
        if (transition) {
          await Promise.all([painted, new Promise(resolve => setTimeout(resolve, Math.max(0, 650 - (performance.now() - started))))]);
        }
        if (request !== this.request) return;
        this.querySelector('#action-status').textContent = '';
      } catch (error) {
        if (request === this.request) this.querySelector('#action-status').textContent = error.message;
      } finally {
        if (request === this.request) {
          this.loading = false;
          this.setPreviewLoading(false);
          this.querySelector('.step-changes').setAttribute('aria-busy', 'false');
          this.querySelector('#download').disabled = !this.files;
          this.querySelector('#view-source').disabled = !this.files;
        }
      }
    }

    renderChanges(previous) {
      const changes = Object.keys(this.files).flatMap(path => {
        if (!previous) return [{ path, kind: 'Source' }];
        if (!(path in previous)) return [{ path, kind: 'Added' }];
        return previous[path] !== this.files[path] ? [{ path, kind: 'Updated' }] : [];
      });
      for (const path of Object.keys(previous || {})) {
        if (!(path in this.files)) changes.push({ path, kind: 'Removed' });
      }
      const counts = ['Added', 'Updated', 'Removed'].flatMap(kind => {
        const count = changes.filter(change => change.kind === kind).length;
        return count ? [`${count} ${count === 1 ? 'file' : 'files'} ${kind.toLowerCase()}`] : [];
      });
      const summary = this.querySelector('#change-summary');
      const pill = document.createElement('span');
      pill.className = 'step-summary-pill';
      pill.textContent = `Step ${this.step + 1}`;
      const detail = document.createElement('span');
      detail.textContent = previous
        ? counts.join(' · ') || 'Source unchanged'
        : `Starting project · ${changes.length} source files`;
      summary.replaceChildren(pill, detail);
      this.querySelector('#change-explanation').textContent = ExampleFiles.steps[this.step].change + ' Select a file to view its source.';
      const list = this.querySelector('#changed-files');
      const groups = new Map();
      for (const { path, kind } of changes) {
        const parts = path.split('/');
        const label = path.startsWith('src/components/') ? `Component · ${parts[2]}`
          : path.startsWith('src/applications/') ? `Application · ${parts[2]}`
            : kind === 'Added' && !path.includes('/') ? 'New file' : 'Page';
        if (!groups.has(label)) {
          const group = document.createElement('div');
          group.className = 'file-group';
          group.setAttribute('role', 'group');
          group.setAttribute('aria-label', label);
          const heading = document.createElement('span');
          heading.className = 'file-group-label';
          heading.textContent = label;
          group.append(heading);
          groups.set(label, group);
        }
        const item = document.createElement(kind === 'Removed' ? 'span' : 'button');
        item.className = 'file-change';
        item.dataset.kind = kind.toLowerCase();
        if (kind !== 'Removed') {
          item.type = 'button';
          item.dataset.file = path;
          item.setAttribute('aria-label', `${kind}: ${path}. View source`);
        }
        if (kind !== 'Source') {
          const badge = document.createElement('span');
          badge.className = 'file-change-kind';
          badge.textContent = kind;
          item.append(badge);
        }
        const name = document.createElement('span');
        name.textContent = parts.at(-1);
        item.append(name);
        groups.get(label).append(item);
      }
      list.replaceChildren(...groups.values());
      if (previous && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        this.changeAnimation?.cancel();
        this.changeAnimation = this.querySelector('.step-changes').animate(
          [{ backgroundColor: '#788dff20' }, { backgroundColor: 'transparent' }],
          { duration: 650, easing: 'ease-out' }
        );
        this.sourceAnimation?.cancel();
        if (!this.sourceOpen) {
          this.sourceAnimation = this.querySelector('#view-source').animate(
            [{ filter: 'brightness(1)' },
             { filter: 'brightness(1.35)', offset: .3 },
             { filter: 'brightness(1)' }],
            { duration: 650, easing: 'ease-out' }
          );
        }
      }
    }

    setPreviewLoading(loading) {
      this.querySelector('.preview-loading').hidden = !loading;
      this.querySelector('.preview').setAttribute('aria-busy', String(loading));
      this.querySelector('#example').inert = loading;
    }

    replay() {
      if (!this.files) return Promise.resolve();
      const frame = this.querySelector('#example');
      return new Promise(resolve => {
        frame.addEventListener('load', () => {
          // Keep the embedded modal visible when the landing page is scrolled down.
          frame.contentDocument.addEventListener('click', event => {
            if (event.target.closest('#continue')) frame.scrollIntoView({ block: 'center', behavior: 'instant' });
          }, true);
          resolve();
        }, { once: true });
        frame.srcdoc = ExampleFiles.preview(this.files);
      });
    }

    updateSource() {
      const explorer = this.querySelector('#source-explorer');
      explorer.clear();
      explorer.setFiles(this.files);
      explorer.openFile(ExampleFiles.steps[this.step].focus);
    }

    async showSource(path) {
      try {
        if (!customElements.get('code-explorer')) await import('/code-explorer.js');
        await customElements.whenDefined('code-explorer');
        this.sourceOpen = true;
        this.setPreviewLoading(false);
        this.updateSource();
        if (path && path in this.files) this.querySelector('#source-explorer').openFile(path);
        this.querySelector('.experience').hidden = true;
        this.querySelector('.source-view').hidden = false;
        this.querySelector('#close-source').focus();
      } catch (error) { this.querySelector('#action-status').textContent = error.message; }
    }

    closeSource() {
      this.sourceOpen = false;
      this.setPreviewLoading(this.loading);
      this.querySelector('.experience').hidden = false;
      this.querySelector('.source-view').hidden = true;
      this.querySelector('#view-source').focus();
    }

    async download() {
      const buttons = this.root.querySelectorAll('[data-download]');
      buttons.forEach(button => button.disabled = true);
      try {
        await ExampleFiles.download(this.files, this.step);
        this.querySelector('#action-status').textContent = 'Downloaded. Extract the ZIP and serve it locally.';
      } catch (error) { this.querySelector('#action-status').textContent = error.message; }
      finally { buttons.forEach(button => button.disabled = false); }
    }
  }
);
