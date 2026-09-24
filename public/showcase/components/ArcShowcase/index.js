import { DemoComponent } from '../DemoComponent/index.js';
import '../TeamAccess/index.js';
import { SignalSession } from '../../core/SignalSession.js';
import { ConnectionOverlay } from '../../core/ConnectionOverlay.js';
import { PresentationController } from '../../core/PresentationController.js';
import { InheritedSkin } from '../../core/InheritedSkin.js';

const modeCopy = {
  interface: ['01 / ASSEMBLED', 'Modular parts.\nAssembled as a unit.', 'Craft isolated ShadowDOM component-parts that assemble together and communicate over the native W3C event-bus. No virtual dom, no overhead. Just raw HTML you learned in school.', 'Each piece is a real, interactive Cocoon component.'],
  explore: ['02 / EXPLORE THE PARTS', 'Pull it apart.\nLook a little closer.', 'Here, the ProfileCard is an example parent class. Changes made to it ripple down within the family. Child components inherit all traits, behavior and visual appearance from all of its ancestors.', 'Rotation is bounded. Your place in the scene is preserved.'],
  inspect: ['03 / INSPECT & INHERIT', 'React & Vue share css files. \nCocoon shares traits.', 'There are no build tools or css load order to manage. Cocoon rides the prototype-chain. Components inherit its ancestor\'s look-n-feel naturally. Its automatic. Visual traits cascade to children live, in real-time. Built for enterprise-grade applications.', 'HTML for structure. CSS for style. JavaScript for behavior.'],
};

export class ArcShowcase extends DemoComponent {
  static skin = undefined;
  static tag = 'arc-showcase';
  static { this.define(); }
  async mount() {
    this.team = this.$('arc-team-access');
    await this.team.ready;
    if (this.lifetime.signal.aborted) return;
    this.session = new SignalSession();
    this.team.bind(this.session);
    this.skin = new InheritedSkin([this.team.parts.member, this.team.parts.admin]);
    const targets = [() => this.team.endpoint('member', 'received'), () => this.team.endpoint('admin', 'received')];
    this.overlay = new ConnectionOverlay(this.$('.connections'), {
      approve: { name: 'access:approved', source: () => this.team.endpoint('toolbar', 'approve'), targets },
      select: { name: 'member:selected', source: () => this.team.endpoint('toolbar', 'select'), targets },
    });
    this.presentation = new PresentationController(this, this.team, this.overlay);
    this.selected = 'member'; this.tab = 'css'; this.sourceCache = new Map(); this.sourceVersion = 0;
    this.session.subscribe(this, 'flow:requested', event => this.presentation.play(event.detail.flow, event.detail.person));
    this.session.subscribe(this, 'inspect:requested', event => this.inspect(event.detail.component));
    this.listen(this.$('#try-flow'), 'click', () => {
      if (this.presentation.mode === 'inspect') { this.closeInspector(); this.presentation.setMode('interface'); }
      else this.presentation.play('approve', this.team.parts.toolbar.person);
    });
    this.listen(this.$('#explore-link'), 'click', () => { this.closeInspector(); this.presentation.setMode('explore'); });
    this.root.querySelectorAll('[data-mode]').forEach(button => this.listen(button, 'click', () => {
      const mode = button.dataset.mode;
      if (mode === 'inspect') this.inspect(this.selected);
      else { this.closeInspector(); this.presentation.setMode(mode); }
    }));
    this.listen(this.$('#replay'), 'click', () => this.presentation.replay());
    this.listen(this.$('#pause'), 'click', () => this.presentation.togglePause());
    this.listen(this.$('#reset-demo'), 'click', () => this.presentation.reset());
    this.listen(this.$('#reset-view'), 'click', () => this.presentation.resetView());
    this.listen(this.$('#rotation'), 'input', event => {
      this.team.setAttribute('dragging', '');
      this.presentation.rotate(Number(event.target.value));
    });
    this.listen(this.$('#rotation'), 'change', () => this.team.removeAttribute('dragging'));
    this.listen(this.$('#depth'), 'input', event => {
      this.team.setAttribute('dragging', '');
      this.presentation.setDepth(Number(event.target.value));
    });
    this.listen(this.$('#depth'), 'change', () => this.team.removeAttribute('dragging'));
    this.listen(this.$('#component-select'), 'change', event => this.inspect(event.target.value, false));
    this.listen(this.$('#close-inspector'), 'click', () => { this.closeInspector(); this.presentation.setMode('explore'); this.$('[data-mode="explore"]').focus(); });
    this.root.querySelectorAll('[data-tab]').forEach(button => {
      this.listen(button, 'click', () => this.selectTab(button.dataset.tab));
      this.listen(button, 'keydown', event => {
        const tabs = ['html', 'css', 'js'];
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        const index = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (tabs.indexOf(this.tab) + (event.key === 'ArrowRight' ? 1 : 2)) % 3;
        this.selectTab(tabs[index]); this.$(`[data-tab="${tabs[index]}"]`).focus();
      });
    });
    this.listen(this.$('#radius'), 'input', event => {
      this.skin.set('border-radius', `${event.target.value}px`); this.syncEditor(); this.styleResult();
    });
    this.root.querySelectorAll('[data-color]').forEach(button => this.listen(button, 'click', () => {
      this.skin.set('background', button.dataset.color); this.syncEditor(); this.styleResult();
    }));
    this.listen(this.$('#apply-css'), 'click', () => this.applyCss());
    this.listen(this.$('#host-css'), 'keydown', event => {
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); this.applyCss(); }
    });
    this.listen(this.$('#reset-style'), 'click', () => { this.skin.reset(); this.syncEditor(); this.styleResult(); });
    this.listen(this.root, 'keydown', event => {
      if (event.key === 'Escape' && this.presentation.mode === 'inspect') {
        this.closeInspector(); this.presentation.setMode('explore'); this.$('[data-mode="explore"]').focus();
      }
    });
    this.bindRotation();
    this.syncEditor(); this.updateState(this.presentation);
    this.setAttribute('ready', '');
    this.root.querySelectorAll('.modes button').forEach(button => button.disabled = false);
    this.presentation.armIntro(this.$('.viewport'));
  }
  bindRotation() {
    const viewport = this.$('.viewport');
    let drag;
    this.listen(viewport, 'pointerdown', event => {
      if (this.presentation.mode === 'interface' || event.button !== 0 || event.composedPath().some(el => el.matches?.('button, select, input, a'))) return;
      drag = { x: event.clientX, y: event.clientY, yaw: this.presentation.yaw, pitch: this.presentation.pitch };
      viewport.setPointerCapture(event.pointerId); viewport.classList.add('dragging'); this.team.setAttribute('dragging', '');
    });
    this.listen(viewport, 'pointermove', event => {
      if (!drag) return;
      this.presentation.rotate(drag.yaw + (event.clientX - drag.x) * .15, drag.pitch - (event.clientY - drag.y) * .1);
    });
    const end = () => { drag = null; viewport.classList.remove('dragging'); this.team.removeAttribute('dragging'); };
    this.listen(viewport, 'pointerup', end); this.listen(viewport, 'pointercancel', end); this.listen(viewport, 'lostpointercapture', end);
  }
  updateState(controller) {
    const state = controller.state;
    this.$('.demo').dataset.state = state;
    // Tab copy belongs to the selected mode, never to animation phases.
    const story = this.$('.story');
    if (story.dataset.mode !== controller.mode) {
      story.dataset.mode = controller.mode;
      const [label, title, description, note] = modeCopy[controller.mode];
      this.$('#state-label').textContent = label;
      this.$('#state-title').replaceChildren(...title.split('\n').flatMap((line, i) => i ? [document.createElement('br'), document.createTextNode(line)] : [document.createTextNode(line)]));
      this.$('#state-copy').textContent = description;
      this.$('#state-note').textContent = note;
    }
    this.root.querySelectorAll('[data-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.mode === controller.mode)));
    this.root.querySelectorAll('[data-step]').forEach(step => step.classList.toggle('active', step.dataset.step === controller.mode));
    this.$('#try-flow').textContent = controller.mode === 'inspect' ? 'Return to interface ↙' : `Approve ${this.team.parts.toolbar.person.name.split(' ')[0]} ↗`;
    this.$('.rotation-controls').hidden = controller.mode === 'interface';
    this.$('#stage-hint').hidden = controller.mode !== 'interface';
    this.$('#pause').hidden = !['playing', 'delivered'].includes(state);
    this.$('#pause').textContent = controller.paused ? '▶ Resume' : 'Ⅱ Pause';
    const status = this.$('#event-status');
    if (state === 'playing' || state === 'delivered') status.textContent = `${controller.lastFlow.flow === 'approve' ? 'access:approved' : 'member:selected'} → MemberCard + AdminCard${controller.paused ? ' · playback paused' : state === 'delivered' ? ' · delivered' : ' · visualizing delivery'}`;
    else if (state === 'interface') status.textContent = 'Ready when you are. Try “Approve access”.';
    else if (state === 'inspecting') status.textContent = 'Inspecting native HTML, CSS, and JavaScript. Shared styles stay live.';
    else if (state === 'explore') status.textContent = 'Drag to rotate · select a component to inspect · Interface to reassemble';
    else status.textContent = state === 'exploding' ? 'Separating the actual component surfaces…' : 'Returning the components to their parent surface…';
  }
  async inspect(key, transition = true) {
    this.selected = key;
    this.$('.inspector').hidden = false; this.$('.workbench').classList.add('inspecting');
    this.$('#component-select').value = key; this.team.select(key);
    this.selectTab(this.tab);
    if (transition) await this.presentation.setMode('inspect');
  }
  closeInspector() {
    this.$('.inspector').hidden = true; this.$('.workbench').classList.remove('inspecting'); this.team.select(null);
    Object.values(this.team.parts).forEach(part => part.removeAttribute('xray'));
  }
  async selectTab(tab) {
    const version = ++this.sourceVersion;
    this.tab = tab;
    Object.entries(this.team.parts).forEach(([key, part]) => {
      if (key === this.selected) part.setAttribute('xray', tab); else part.removeAttribute('xray');
    });
    const inherited = ['member', 'admin'].includes(this.selected);
    const name = { member: 'MemberCard', admin: 'AdminCard', toolbar: 'AccessToolbar', parent: 'TeamAccess' }[this.selected];
    this.$('#ancestry').textContent = inherited ? 'extends ProfileCard · inherits its skin' : this.selected === 'parent' ? 'composes three child components' : 'extends DemoComponent';
    this.root.querySelectorAll('[data-tab]').forEach(button => { const active = button.dataset.tab === tab; button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; });
    this.$('#source-panel').setAttribute('aria-labelledby', `tab-${tab}`);
    const editable = tab === 'css' && inherited;
    this.$('#css-editor').hidden = !editable; this.$('#source-code').hidden = editable; this.$('#reset-style').hidden = !editable;
    const owner = inherited && tab !== 'js' ? 'ProfileCard' : name;
    this.$('#source-owner').textContent = `${owner}/index.${tab}${inherited && tab !== 'js' ? ' · inherited' : ''}`;
    this.$('#inspector-result').classList.remove('error');
    this.$('#inspector-result').textContent = editable ? 'One base stylesheet. Both subclasses update.' : tab === 'js' ? 'The actual controller used by this running component.' : 'The actual source used to render this component.';
    if (editable) { this.syncEditor(); return; }
    this.$('#source-code code').textContent = 'Loading source…';
    try {
      const path = `../${owner}/index.${tab}`;
      if (!this.sourceCache.has(path)) this.sourceCache.set(path, fetch(new URL(path, import.meta.url)).then(response => { if (!response.ok) throw new Error('Source could not be loaded.'); return response.text(); }));
      const source = await this.sourceCache.get(path);
      if (version === this.sourceVersion && this.isConnected) this.$('#source-code code').textContent = source.trim();
    } catch (error) { if (version === this.sourceVersion) this.$('#source-code code').textContent = error.message; }
  }
  syncEditor() {
    this.$('#host-css').value = this.skin.text;
    const radius = parseFloat(this.skin.rule.style.getPropertyValue('border-radius'));
    this.$('#radius').value = Math.min(36, Number.isFinite(radius) ? radius : 18);
    this.$('#radius-value').textContent = this.skin.rule.style.getPropertyValue('border-radius');
    this.root.querySelectorAll('[data-color]').forEach(button => {
      const style = document.createElement('span').style; style.background = button.dataset.color;
      button.setAttribute('aria-pressed', String(style.background === this.skin.rule.style.background));
    });
  }
  applyCss() {
    try { this.skin.apply(this.$('#host-css').value); this.syncEditor(); this.styleResult(); }
    catch (error) { this.$('#inspector-result').textContent = error.message; this.$('#inspector-result').classList.add('error'); }
  }
  styleResult() { this.$('#inspector-result').classList.remove('error'); this.$('#inspector-result').textContent = 'Updated ProfileCard → MemberCard + AdminCard. Both use the same inherited stylesheet.'; }
  dispose() {
    this.presentation?.dispose(); this.session?.dispose();
    this.skin?.reset(); this.sourceVersion++;
  }
}
