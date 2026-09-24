import { DemoComponent } from '../DemoComponent/index.js';

export class ProfileCard extends DemoComponent {
  static skin = undefined;
  static tag = 'arc-profile-card';
  static { this.define(); }
  async importCSS(url, ancestor, options) {
    const module = await super.importCSS(url, ancestor, options);
    // Keep the ancestral sheet reference: v8.6.0 reuses its constructor
    // metadata while walking ancestors, so metadata is not a stable key.
    if (ancestor === ProfileCard) this.profileStyleSheet = module.default;
    return module;
  }
  mount() {
    this.paint();
    this.enableSurfaceSelection(this.componentKey);
    this.listen(this.$('.card-action'), 'click', () => this.session?.publish(this, 'inspect:requested', { component: this.componentKey }));
  }
  bind(session) {
    this.session = session;
    session.subscribe(this, 'access:approved', event => this.onApproved(event.detail));
    session.subscribe(this, 'member:selected', event => this.onSelected(event.detail));
    session.subscribe(this, 'access:reset', () => this.reset());
  }
  paint() {
    this.$('.name').textContent = this.person.name;
    this.$('.role').textContent = this.person.role;
    this.$('.avatar').textContent = this.person.initials;
    this.$('.avatar').dataset.person = this.componentKey;
    this.$('.badge').hidden = this.componentKey !== 'admin';
    this.$('.card-action-label').textContent = this.componentKey === 'admin' ? 'Manage permissions' : 'View profile';
    this.setStatus(this.componentKey === 'admin' ? 'Active' : 'Pending', this.componentKey === 'admin');
  }
  setStatus(text, approved) {
    this.$('.status-label').textContent = text;
    this.$('.status').dataset.active = String(approved);
  }
  reset() { this.paint(); }
}
