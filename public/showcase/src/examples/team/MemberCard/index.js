import 'examples.team.ProfileCard';

namespace `examples.team` (
  class MemberCard extends examples.team.ProfileCard {
    static tag = 'arc-member-card';
    constructor() {
      super();
      this.componentKey = 'member';
      this.person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' };
    }
    // Reuse the ancestor template; its complete skin is inherited by Cocoon.
    html() { return super.html(); }
    onApproved({ name }) { this.setStatus(`${name.split(' ')[0]} approved`, true); }
    onSelected(person) { this.person = person; this.paint(); }
    reset() { this.person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' }; this.paint(); }
  }
);
