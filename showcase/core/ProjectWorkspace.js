const PREFIX = 'src/examples/team/';
const MIME = { js: 'text/javascript', html: 'text/html', css: 'text/css', json: 'application/json' };

/** Owns the editable example files. The shell and kernel are never editable. */
export class ProjectWorkspace {
  constructor(view) {
    this.view = view;
    this.editor = view.$('#example-editor');
    this.session = new URLSearchParams(location.search).get('session') || 'standalone';
    this.key = `cocoon-lab:${this.session}`;
    this.editing = false;
    view.listen(view.$('#edit-example'), 'click', () => this.open());
    view.listen(view.$('#close-editor'), 'click', () => this.close());
    view.listen(view.$('#run-example'), 'click', () => this.run());
    view.listen(view.$('#reset-example'), 'click', () => this.reset());
    view.listen(this.editor, 'file-edited', () => this.saveDraft());
    view.listen(this.editor, 'files-changed', () => { if (this.loaded) this.saveDraft(); });
    view.listen(this.editor, 'files-saved', () => this.run());
  }
  async restore() {
    try { this.saved = JSON.parse(sessionStorage.getItem(this.key)) || {}; } catch { this.saved = {}; }
    if (this.saved.view) {
      const { mode, yaw, pitch, depth, selected } = this.saved.view;
      this.view.presentation.rotate(yaw, pitch);
      this.view.presentation.setDepth(depth);
      this.view.selected = selected || 'member';
      if (mode === 'inspect') await this.view.inspect(this.view.selected);
      else await this.view.presentation.setMode(mode || 'explore');
      this.restored = true;
    }
    if (new URLSearchParams(location.search).has('edit')) await this.open();
  }
  async loadFiles() {
    if (this.files) return;
    if (!this.loading) this.loading = (async () => {
    const manifest = await (await fetch('/showcase/project.json')).json();
    this.paths = manifest.files;
    this.files = Object.fromEntries(await Promise.all(this.paths.map(async path => {
      const response = await fetch(new URL(path, document.baseURI));
      if (!response.ok) throw new Error(`Could not load ${path}`);
      return [path, await response.text()];
    })));
      if (this.pendingSkin) { this.pendingSkin = false; this.syncSkin(); }
    })().catch(error => { this.loading = null; throw error; });
    await this.loading;
  }
  async read(path) { await this.loadFiles(); return this.files[path] ?? ''; }
  saveDraft() {
    try {
      this.saved = { ...this.saved, files: this.editor.getFiles(), active: this.editor.active };
      sessionStorage.setItem(this.key, JSON.stringify(this.saved));
    } catch (error) { this.status(`Could not save this draft: ${error.message}`); }
  }
  status(message) { this.view.$('#editor-status').textContent = message; }
  async open() {
    const button = this.view.$('#edit-example');
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try { await this.loadFiles(); }
    catch (error) { this.view.$('#event-status').textContent = `Could not open the editor: ${error.message}`; return; }
    finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    this.view.presentation.begin();
    const mode = this.view.presentation.mode;
    this.view.presentation.setState(mode === 'interface' ? 'interface' : mode === 'inspect' ? 'inspecting' : 'explore');
    if (!this.loaded) {
      this.editor.setFiles(this.saved.files || this.files);
      this.loaded = true;
      const owner = { profile: 'BaseProfileCard', member: 'MemberCard', admin: 'AdminCard', toolbar: 'AccessToolbar', parent: 'TeamAccess' }[this.view.selected];
      this.editor.openFile(this.saved.active || `${PREFIX}${owner}/index.js`);
    }
    this.editing = true;
    this.view.$('.workbench').hidden = true;
    this.view.$('.editor-workspace').hidden = false;
    this.view.root.querySelectorAll('.modes button').forEach(button => button.setAttribute('aria-pressed', String(button.id === 'edit-example')));
    this.view.$('.rotation-controls').hidden = true;
    this.view.$('.playback-controls').hidden = true;
    this.status('Edit the component family. Run applies your changes; Back keeps your draft.');
  }
  close() {
    this.editing = false;
    this.saveDraft();
    this.view.$('.workbench').hidden = false;
    this.view.$('.editor-workspace').hidden = true;
    this.view.$('#edit-example').setAttribute('aria-pressed', 'false');
    this.view.$('.playback-controls').hidden = false;
    this.view.updateState(this.view.presentation);
  }
  syncSkin() {
    if (!this.files) { this.pendingSkin = true; return; }
    const path = `${PREFIX}BaseProfileCard/index.css`;
    const host = `:host {\n  ${this.view.skin.rule.style.cssText}\n}`;
    this.files[path] = this.files[path].replace(/:host\s*\{[^}]*\}/, host);
    if (this.loaded) {
      const draft = this.editor.getFiles()[path];
      if (typeof draft === 'string') this.editor.setFiles({ [path]: draft.replace(/:host\s*\{[^}]*\}/, host) });
    } else if (this.saved?.files?.[path]) {
      this.saved.files[path] = this.saved.files[path].replace(/:host\s*\{[^}]*\}/, host);
    }
  }
  async run() {
    const button = this.view.$('#run-example');
    if (button.disabled) return;
    button.disabled = true;
    try {
      const files = this.editor.getFiles();
      for (const path of this.paths) if (!(path in files)) throw new Error(`Restore the required file: ${path}`);
      for (const [path, source] of Object.entries(files)) {
        if (!path.startsWith(PREFIX) || path.split('/').some(p => p === '..' || p === '.') || typeof source !== 'string') throw new Error('Keep editable files inside src/examples/team.');
      }
      this.status('Preparing your updated component family…');
      const registration = await navigator.serviceWorker.register('/showcase/project-worker.js', { scope: '/showcase/' });
      if (!registration.active) await new Promise((resolve, reject) => {
        const worker = registration.installing || registration.waiting;
        const timer = setTimeout(() => reject(new Error('The example loader did not start. Try Run again.')), 10000);
        worker.addEventListener('statechange', () => {
          if (worker.state === 'activated') { clearTimeout(timer); resolve(); }
          if (worker.state === 'redundant') { clearTimeout(timer); reject(new Error('The example loader could not activate.')); }
        });
      });
      // Include namespace mappings for new components added to the example.
      const entry = await (await fetch('/showcase/index.html')).text();
      const map = await (await fetch('/showcase/.importmap')).json();
      for (const path of Object.keys(files)) {
        if (!path.endsWith('.js')) continue;
        const name = path.replace(/^src\//, '').replace(/\/index\.js$/, '').replace(/\.js$/, '').replaceAll('/', '.');
        map.imports[name] = './' + path;
      }

      const id = crypto.randomUUID();
      const base = new URL(`/showcase/runs/${id}/`, location.origin);
      const cache = await caches.open('cocoon-showcase-runs-v1');
      await Promise.all(Object.entries(files).map(([path, source]) => cache.put(new URL(path, base), new Response(source, { headers: { 'Content-Type': MIME[path.split('.').pop()] || 'text/plain' } }))));
      await cache.put(new URL('index.html', base), new Response(entry, { headers: { 'Content-Type': 'text/html' } }));
      await cache.put(new URL('.importmap', base), new Response(JSON.stringify(map), { headers: { 'Content-Type': 'application/json' } }));
      const p = this.view.presentation;
      this.saved = { files, active: this.editor.active, view: { mode: p.mode, yaw: p.yaw, pitch: p.pitch, depth: p.depth ?? 100, selected: this.view.selected }, run: id };
      sessionStorage.setItem(this.key, JSON.stringify(this.saved));
      const url = new URL('index.html', base); url.searchParams.set('session', this.session);
      location.replace(url);
    } catch (error) { this.status(error.message); button.disabled = false; }
  }
  reset() {
    sessionStorage.removeItem(this.key);
    const url = new URL('/showcase/index.html', location.origin);
    url.searchParams.set('session', this.session);
    location.replace(url);
  }
}
