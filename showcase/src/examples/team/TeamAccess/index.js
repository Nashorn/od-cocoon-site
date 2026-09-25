import 'examples.team.AccessToolbar';
import 'examples.team.MemberCard';
import 'examples.team.AdminCard';

namespace `examples.team` (
  class TeamAccess extends Component {
    styles = ['./src/lab/shared.css'];

    inShadow() { return true; }

    static tag = 'arc-team-access';

    async onConnected() {
      await super.onConnected();
      this.parts = {
        toolbar: this.querySelector('arc-access-toolbar'),
        member: this.querySelector('arc-member-card'),
        admin: this.querySelector('arc-admin-card'),
      };
    }

    explode(value) {
      this.toggleAttribute('exploded', value);
    }

    rotate(yaw, pitch) {
      this.style.setProperty('--yaw', `${yaw}deg`);
      this.style.setProperty('--pitch', `${pitch}deg`);
    }

    setDepth(scale) {
      this.style.setProperty('--depth-scale', scale);
    }

    select(key) {
      Object.entries(this.parts).forEach(([name, part]) => part.toggleAttribute('inspected', key === name));
    }

    endpoint(component, name) {
      return this.parts[component]?.querySelector(`[data-endpoint="${name}"]`);
    }

    reset() {
      this.parts.toolbar.reset();
      this.parts.member.reset();
      this.parts.admin.reset();
    }
  }
);
