import { DemoComponent } from '../DemoComponent/index.js';

export const members = {
  alex: { id: 'alex', name: 'Alex Lee', role: 'Designer', initials: 'AL' },
  jordan: { id: 'jordan', name: 'Jordan Park', role: 'Developer', initials: 'JP' },
};
export class AccessToolbar extends DemoComponent {
  static skin = undefined;
  static tag = 'arc-access-toolbar';
  static { this.define(); }
  mount() {
    this.listen(this.$('button'), 'click', () => this.session?.publish(this, 'flow:requested', { flow: 'approve', person: this.person }));
    this.listen(this.$('select'), 'change', () => this.session?.publish(this, 'flow:requested', { flow: 'select', person: this.person }));
  }
  get person() { return members[this.$('select').value]; }
  bind(session) { this.session = session; }
  emit(flow, person) { this.session.publish(this, flow === 'approve' ? 'access:approved' : 'member:selected', person); }
  reset() { this.$('select').value = 'alex'; }
}
