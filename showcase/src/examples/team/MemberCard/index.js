import BaseProfileCard from 'examples.team.BaseProfileCard';

export default namespace `examples.team` (
  class MemberCard extends BaseProfileCard {
    static tag = 'arc-member-card';

    constructor() {
      super();
      this.componentKey = 'member';
      this.person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' };
    }

    // No .html, instead, inherit ancestor (BaseProfileCard) template
    html() {
      return super.html();
    }

    onApproved({ name }) {
      this.setStatus(`${name.split(' ')[0]} approved`, true);
    }

    onSelected(person) {
      this.person = person;
      this.paint();
    }

    reset() {
      this.person = { name: 'Alex Lee', role: 'Designer', initials: 'AL' };
      this.paint();
    }
  }
);
