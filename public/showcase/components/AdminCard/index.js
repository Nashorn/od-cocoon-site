import { ProfileCard } from '../ProfileCard/index.js';

export class AdminCard extends ProfileCard {
  static skin = null;
  static tag = 'arc-admin-card';
  static { this.define(); }
  componentKey = 'admin';
  person = { name: 'Maya Chen', role: 'Administrator', initials: 'MC' };
  html() { return super.html(); }
  onApproved({ name }) { this.setStatus(`${name.split(' ')[0]} added to team`, true); }
  onSelected({ name }) { this.setStatus(`Reviewing ${name.split(' ')[0]}`, true); }
}
