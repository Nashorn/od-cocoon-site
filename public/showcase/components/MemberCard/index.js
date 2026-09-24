import { ProfileCard } from '../ProfileCard/index.js';

export class MemberCard extends ProfileCard {
  static skin = null;
  static tag = 'arc-member-card';
  static { this.define(); }
  componentKey = 'member';
  person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' };
  // Explicit template inheritance; Cocoon adopts ProfileCard's stylesheet.
  html() { return super.html(); }
  onApproved({ name }) { this.setStatus(`${name.split(' ')[0]} approved`, true); }
  onSelected(person) { this.person = person; this.paint(); }
  reset() { this.person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' }; this.paint(); }
}
