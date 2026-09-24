import { DemoComponent } from '../DemoComponent/index.js';
import '../AccessToolbar/index.js';
import '../MemberCard/index.js';
import '../AdminCard/index.js';

/** The composed product UI. It knows nothing about playback timelines. */
export class TeamAccess extends DemoComponent {
  static skin = undefined;
  static tag = 'arc-team-access';
  static { this.define(); }
  async mount() {
    this.parts = {
      toolbar: this.$('arc-access-toolbar'),
      member: this.$('arc-member-card'),
      admin: this.$('arc-admin-card'),
    };
    await Promise.all(Object.values(this.parts).map(part => part.ready));
  }
  bind(session) { Object.values(this.parts).forEach(part => part.bind(session)); }
  explode(value) { this.toggleAttribute('exploded', value); }
  rotate(yaw, pitch) {
    this.style.setProperty('--yaw', `${yaw}deg`);
    this.style.setProperty('--pitch', `${pitch}deg`);
  }
  setDepth(scale) { this.style.setProperty('--depth-scale', scale); }
  select(key) {
    Object.entries(this.parts).forEach(([name, part]) => part.toggleAttribute('inspected', key === name));
  }
  endpoint(component, name) { return this.parts[component]?.$(`[data-endpoint="${name}"]`); }
  reset() { this.parts.toolbar.reset(); this.parts.member.reset(); this.parts.admin.reset(); }
}
