import 'examples.team.ProfileCard';

namespace `examples.team` (
  class AdminCard extends examples.team.ProfileCard {
    static tag = 'arc-admin-card';

    constructor() {
      super();
      this.componentKey = 'admin';
      this.person = { name: 'Maya Chen', role: 'Administrator', initials: 'MC' };
    }

    html() {
      return super.html();
    }

    onApproved({ name }) {
      this.setStatus(`${name.split(' ')[0]} added to team`, true);
    }

    onSelected({ name }) {
      this.setStatus(`Reviewing ${name.split(' ')[0]}`, true);
    }
  }
);
