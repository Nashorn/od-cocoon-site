import 'examples.HelloWorld';
import { ExampleFiles } from '../../../core/ExampleFiles.js';
import { PHASES, STORIES } from './content.js';

namespace `lab` (
  class LifecycleShell extends Component {
    styles = ['../showcase/src/lab/shared.css', '../styles/interactive-shell.css', '../styles/interactive-lab.css'];
    static tag = 'arc-lifecycle';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.phase = 2;
      this.bootMode = 'auto';
      this.example = 'birth';
      this.querySelector('.phase-rail').innerHTML = PHASES.map((phase,index) => `<li><button data-phase="${index}"><i>${String(index + 1).padStart(2,'0')}</i><span>${phase.label}</span></button></li>`).join('');
      const codeLabels = { tag:'<hello-world>', element:'<hello-world>' };
      this.root.querySelectorAll('[data-code]').forEach(code => {
        if (codeLabels[code.dataset.code]) code.textContent = codeLabels[code.dataset.code];
      });
      this.querySelector('[data-code="root"]').innerHTML = '<span class="tok-punctuation">&lt;</span><span class="tok-element">hello-world</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;<span class="tok-shadow">#shadow-root (open)</span><br><span class="tok-punctuation">&lt;/</span><span class="tok-element">hello-world</span><span class="tok-punctuation">&gt;</span>';
      this.querySelector('[data-code="style"]').innerHTML = '<span class="tok-selector">:host</span> <span class="tok-punctuation">{</span><br>&nbsp;&nbsp;<span class="tok-property">display</span><span class="tok-punctuation">:</span> <span class="tok-value">block</span><span class="tok-punctuation">;</span><br>&nbsp;&nbsp;<span class="tok-property">border-radius</span><span class="tok-punctuation">:</span> <span class="tok-value">10px</span><span class="tok-punctuation">;</span><br><span class="tok-punctuation">}</span>';
      this.querySelector('[data-code="content"]').innerHTML = '<span class="tok-punctuation">&lt;</span><span class="tok-element">hello-world</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;<span class="tok-shadow">#shadow-root (open)</span><br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">dialog</span> <span class="tok-property">open</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">span</span><span class="tok-punctuation">&gt;</span>◇<span class="tok-punctuation">&lt;/</span><span class="tok-element">span</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">div</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">strong</span><span class="tok-punctuation">&gt;</span>Hello World<span class="tok-punctuation">&lt;/</span><span class="tok-element">strong</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">small</span><span class="tok-punctuation">&gt;</span>A Cocoon component in the wild.<span class="tok-punctuation">&lt;/</span><span class="tok-element">small</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;/</span><span class="tok-element">div</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;</span><span class="tok-element">button</span><span class="tok-punctuation">&gt;</span>Pulse<span class="tok-punctuation">&lt;/</span><span class="tok-element">button</span><span class="tok-punctuation">&gt;</span><br>&nbsp;&nbsp;&nbsp;&nbsp;<span class="tok-punctuation">&lt;/</span><span class="tok-element">dialog</span><span class="tok-punctuation">&gt;</span><br><span class="tok-punctuation">&lt;/</span><span class="tok-element">hello-world</span><span class="tok-punctuation">&gt;</span>';
      this.on('click', event => this.selectExample(event), false, '.example-picker');
      this.on('click', event => this.selectBootMode(event), false, '.boot-modes');
      this.on('click', event => this.selectPhase(event), false, '.phase-rail');
      this.on('input', event => this.showPhase(Number(event.target.value)), false, '#phase-progress');
      this.on('click', () => this.togglePlay(), false, '#play');
      this.on('click', () => this.step(), false, '#step');
      this.on('click', () => this.replay(), false, '#replay');
      this.on('click', () => this.showSource(), false, '#view-source');
      this.on('click', () => this.closeSource(), false, '#close-source');
      this.on('click', () => this.download(), false, '#download');
      this.querySelector('.lifecycle-stage').addEventListener('click', event => this.inspectCurrentPhase(event));
      this.querySelector('.component-layers').addEventListener('pointermove', event => this.releaseInspectionAway(event));
      this.querySelector('.component-layers').addEventListener('pointerleave', () => this.releaseLayerInspection());
      this.showPhase(2);
      this.connectorObserver = new ResizeObserver(() => this.syncConnectors());
      this.connectorObserver.observe(this.querySelector('.component-layers'));
      requestAnimationFrame(() => requestAnimationFrame(() => this.syncConnectors()));
      this.fire('lifecycle:ready');
      window.lifecycleFrame?.ready();
    }

    syncConnectors() {
      const frame = this.querySelector('.component-layers');
      const svgs = [...this.root.querySelectorAll('.layer-connectors')];
      if (!frame || !svgs.length) return;
      const frameBox = frame.getBoundingClientRect();
      if (!frameBox.width || !frameBox.height) return;
      svgs.forEach(svg => svg.setAttribute('viewBox', `0 0 ${frameBox.width} ${frameBox.height}`));
      const sources = {
        element:'.stack-annotation',
        root:'.layer-labels [data-reveal="root"]',
        style:'.layer-labels [data-reveal="style"]',
        content:'.layer-labels [data-reveal="content"]',
        rendered:'.layer-labels [data-reveal="rendered"]'
      };
      for (const [name, sourceSelector] of Object.entries(sources)) {
        const source = this.querySelector(sourceSelector);
        const card = name === 'rendered' ? this.querySelector('hello-world') : null;
        const target = name === 'rendered'
          ? card?.shadowRoot?.querySelector('.connector-target')
          : name === 'element' && (this.phase === 1 || this.phase === 7)
            ? this.querySelector(this.phase === 7 ? '.page-world-tag-anchor' : '.page-tag-anchor')
            : this.querySelector(`.layer-${name} .connector-anchor`);
        const connector = this.querySelector(`.layer-connectors [data-reveal="${name}"]`);
        if (!source || !target || !connector) continue;
        const targetBox = target.getBoundingClientRect();
        const targetX = targetBox.left + targetBox.width / 2 - frameBox.left;
        const targetY = targetBox.top + targetBox.height / 2 - frameBox.top;
        const sourceBox = source.getBoundingClientRect();
        const fromBottom = name === 'root' || name === 'content';
        const startX = sourceBox.left + sourceBox.width / 2 - frameBox.left;
        const startY = (fromBottom ? sourceBox.top - 8 : sourceBox.bottom + 8) - frameBox.top;
        const departureY = startY + (fromBottom ? -14 : 14);
        const approachY = targetY + (fromBottom ? 14 : -14);
        connector.querySelector('path').setAttribute('d', `M${startX} ${startY}V${departureY}L${targetX} ${approachY}V${targetY}`);
        connector.querySelector('circle').setAttribute('cx', targetX);
        connector.querySelector('circle').setAttribute('cy', targetY);
      }
    }

    syncConnectorLayers() {
      const back = this.querySelector('.layer-connectors-back');
      const front = this.querySelector('.layer-connectors-front');
      const active = [null,'element','element','root','root','style','content','element','rendered'][this.phase];
      for (const name of ['element','root','style','content','rendered']) {
        const connector = this.querySelector(`.layer-connectors [data-reveal="${name}"]`);
        const belongsInFront = name === active || (this.phase === 7 && ['root','style','content'].includes(name));
        if (connector) (belongsInFront ? front : back).append(connector);
      }
      this.syncConnectors();
    }

    selectExample(event) {
      const button = event.target.closest('[data-example]');
      if (!button) return;
      this.pause();
      this.example = button.dataset.example;
      this.root.querySelectorAll('[data-example]').forEach(item => item.toggleAttribute('aria-current', item === button));
      const story = STORIES[this.example];
      this.querySelector('#story-step').textContent = story.step;
      this.querySelector('#story-title').innerHTML = story.title;
      this.querySelector('#story-copy').textContent = story.copy;
      this.querySelector('#story-instruction').innerHTML = story.instruction;
      if (this.example === 'birth') this.showPhase(0);
      if (this.example === 'lazy') {
        this.showPhase(4);
        this.querySelector('#trace-state').textContent = 'waiting in viewport';
        this.querySelector('#world-status').textContent = 'lazy gate · awaiting intersection';
      }
      if (this.example === 'reconnect') this.showPhase(8);
      this.syncPlayLabel();
    }

    selectBootMode(event) {
      const button = event.target.closest('[data-boot]');
      if (!button) return;
      this.bootMode = button.dataset.boot;
      this.root.querySelectorAll('[data-boot]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      if (this.phase === 1) this.showPhase(1);
      this.replay();
    }

    selectPhase(event) {
      const button = event.target.closest('[data-phase]');
      if (!button) return;
      this.pause();
      this.showPhase(Number(button.dataset.phase));
    }

    showPhase(index) {
      this.releaseLayerInspection();
      const previousPhase = this.phase;
      this.phase = Math.max(0, Math.min(PHASES.length - 1, index));
      const phase = { ...PHASES[this.phase] };
      if (this.phase === 1 && this.bootMode === 'application') {
        phase.method = "import 'examples.HelloWorld'";
        phase.owner = 'Application';
        phase.state = 'importing';
        phase.status = 'application import · component';
        phase.tasks = ['Load controller','Import component','Register module'];
        phase.event = ['Application imports component','code-behind → module registration'];
      }
      const stage = this.querySelector('.lifecycle-stage');
      stage.dataset.phase = this.phase;
      stage.dataset.boot = this.bootMode;
      stage.style.setProperty('--phase-progress', `${this.phase * 11.25}%`);
      this.querySelector('#trace-name').textContent = phase.name;
      this.querySelector('#trace-method').textContent = phase.method;
      this.querySelector('#trace-state').textContent = phase.state;
      this.querySelector('#trace-owner').textContent = phase.owner;
      this.querySelector('#trace-tasks').innerHTML = phase.tasks.map(task => `<li>${task}</li>`).join('');
      this.querySelector('#world-status').textContent = phase.status;
      this.querySelector('#current-phase').textContent = phase.name;
      this.querySelector('#phase-count').textContent = `${this.phase + 1} of ${PHASES.length}`;
      this.querySelector('#phase-progress').value = this.phase;
      const [eventTitle,eventDetail] = phase.event;
      const phaseEvent = this.querySelector('.phase-event');
      this.querySelector('#phase-event-title').textContent = eventTitle;
      this.querySelector('#phase-event-detail').textContent = eventDetail;
      phaseEvent.classList.remove('is-updating');
      void phaseEvent.offsetWidth;
      phaseEvent.classList.add('is-updating');
      this.root.querySelectorAll('[data-phase]').forEach(button => {
        const value = Number(button.dataset.phase);
        button.dataset.state = value < this.phase ? 'complete' : 'pending';
        button.toggleAttribute('aria-current', value === this.phase);
        if (value === this.phase) button.setAttribute('aria-current', 'step');
      });
      this.syncInspectableLayer();
      const worldButton = this.querySelector('.phase-rail [data-phase="8"]');
      worldButton.classList.remove('is-emerging');
      if (this.phase === 8 && previousPhase !== 8) {
        void worldButton.offsetWidth;
        worldButton.classList.add('is-emerging');
      }
      this.syncConnectorLayers();
      this.syncComponent();
      requestAnimationFrame(() => this.syncConnectors());
      this.syncPlayLabel();
    }

    currentLayer() {
      const selector = ['.layer-page','.layer-page','.layer-element','.layer-root','.layer-root','.layer-style','.layer-content','.layer-page','#live-component'][this.phase];
      return selector ? this.querySelector(selector) : null;
    }

    syncInspectableLayer() {
      this.root.querySelectorAll('.layer,.live-component').forEach(layer => layer.classList.remove('is-inspectable'));
      this.currentLayer()?.classList.add('is-inspectable');
    }

    inspectLayer(layer) {
      if (!layer || layer !== this.currentLayer()) return;
      this.releaseLayerInspection();
      layer.classList.add('is-inspected-layer');
      this.querySelector('.layer-assembly').classList.add('is-inspecting');
      this.querySelector('.lifecycle-stage').classList.add('is-layer-inspection');
      this.inspectionReadyAt = performance.now() + 300;
      this.inspectionPointerEntered = false;
    }

    inspectCurrentPhase(event) {
      if (event.target.closest('button,input')) return;
      if (this.querySelector('.layer-assembly').classList.contains('is-inspecting')) return;
      this.inspectLayer(this.currentLayer());
    }

    releaseInspectionAway(event) {
      const layer = this.querySelector('.is-inspected-layer');
      if (!layer || performance.now() < this.inspectionReadyAt) return;
      const box = layer.getBoundingClientRect();
      const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
      if (inside) this.inspectionPointerEntered = true;
      else if (this.inspectionPointerEntered) this.releaseLayerInspection();
    }

    releaseLayerInspection() {
      this.querySelector('.layer-assembly')?.classList.remove('is-inspecting');
      this.querySelector('.lifecycle-stage')?.classList.remove('is-layer-inspection');
      this.root.querySelectorAll('.is-inspected-layer').forEach(layer => layer.classList.remove('is-inspected-layer'));
      this.inspectionPointerEntered = false;
    }

    syncComponent() {
      const mount = this.querySelector('#live-component');
      if (this.phase < 8) {
        mount.replaceChildren();
        return;
      }
      if (!mount.querySelector('hello-world')) mount.append(document.createElement('hello-world'));
      this.syncRenderedConnector();
    }

    syncRenderedConnector(attempt = 0) {
      const card = this.querySelector('hello-world');
      if (card?.shadowRoot?.querySelector('.connector-target')) this.syncConnectors();
      if (attempt < 50) requestAnimationFrame(() => this.syncRenderedConnector(attempt + 1));
    }

    togglePlay() {
      if (this.example === 'reconnect') return this.reconnect();
      if (this.example === 'lazy' && this.phase === 4) {
        this.showPhase(5);
      }
      if (this.timer) this.pause();
      else this.play();
    }

    play() {
      if (this.phase >= PHASES.length - 1) this.showPhase(0);
      this.timer = setInterval(() => {
        if (this.phase >= PHASES.length - 1) return this.pause();
        this.showPhase(this.phase + 1);
      }, 800);
      this.syncPlayLabel();
    }

    pause() {
      clearInterval(this.timer);
      this.timer = null;
      this.syncPlayLabel();
    }

    step() {
      this.pause();
      this.showPhase(this.phase >= PHASES.length - 1 ? 0 : this.phase + 1);
    }

    replay() {
      this.pause();
      this.example = 'birth';
      const birth = this.querySelector('[data-example="birth"]');
      this.root.querySelectorAll('[data-example]').forEach(item => item.toggleAttribute('aria-current', item === birth));
      const story = STORIES.birth;
      this.querySelector('#story-step').textContent = story.step;
      this.querySelector('#story-title').innerHTML = story.title;
      this.querySelector('#story-copy').textContent = story.copy;
      this.querySelector('#story-instruction').innerHTML = story.instruction;
      this.showPhase(0);
      this.play();
    }

    reconnect() {
      const mount = this.querySelector('#live-component');
      const component = mount.querySelector('hello-world');
      if (!component) {
        this.showPhase(8);
        return;
      }
      component.remove();
      this.querySelector('#trace-name').textContent = 'SLEEP';
      this.querySelector('#trace-method').textContent = 'onDisconnected() → onSleep()';
      this.querySelector('#trace-state').textContent = 'disconnected';
      this.querySelector('#trace-owner').textContent = 'Your code';
      this.querySelector('#trace-tasks').innerHTML = '<li>Unsubscribe styles</li><li>Clean up resources</li><li>Pause behavior</li>';
      this.querySelector('#world-status').textContent = 'component activity · disconnected';
      this.querySelector('#current-phase').textContent = 'SLEEP';
      setTimeout(() => {
        mount.append(component);
        this.showPhase(8);
      }, 900);
    }

    syncPlayLabel() {
      const button = this.querySelector('#play');
      if (this.example === 'reconnect') button.innerHTML = '<span aria-hidden="true">↯</span> Detach';
      else if (this.example === 'lazy' && this.phase === 4) button.innerHTML = '<span aria-hidden="true">▷</span> Enter viewport';
      else button.innerHTML = this.timer ? '<span aria-hidden="true">Ⅱ</span> Pause' : '<span aria-hidden="true">▷</span> Play';
    }

    async loadFiles() {
      if (!this.files) this.files = await ExampleFiles.load();
      return this.files;
    }

    async showSource() {
      const button = this.querySelector('#view-source');
      button.disabled = true;
      this.pause();
      this.querySelector('#action-status').textContent = '';
      try {
        await this.loadFiles();
        if (!customElements.get('code-explorer')) await import('/code-explorer.js');
        await customElements.whenDefined('code-explorer');
        const explorer = this.querySelector('#source-explorer');
        if (!this.sourceLoaded) {
          explorer.setFiles(this.files);
          explorer.openFile('src/examples/HelloWorld/index.js');
          this.sourceLoaded = true;
        }
        this.querySelector('#live-label').textContent = 'SOURCE';
        this.querySelector('.experience').hidden = true;
        this.querySelector('.control-bar').hidden = true;
        this.querySelector('.source-view').hidden = false;
        this.querySelector('#close-source').focus();
      } catch (error) { this.querySelector('#action-status').textContent = error.message; }
      finally { button.disabled = false; }
    }

    closeSource() {
      this.querySelector('.source-view').hidden = true;
      this.querySelector('.experience').hidden = false;
      this.querySelector('.control-bar').hidden = false;
      this.querySelector('#live-label').textContent = 'LIVE';
      this.querySelector('#view-source').focus();
    }

    async download() {
      const button = this.querySelector('#download');
      const status = this.querySelector('#action-status');
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Preparing example…';
      try {
        await ExampleFiles.download(await this.loadFiles());
        status.textContent = 'Downloaded. Extract and serve locally to run.';
      } catch (error) { status.textContent = error.message; }
      finally { button.disabled = false; button.removeAttribute('aria-busy'); }
    }
  }
);
