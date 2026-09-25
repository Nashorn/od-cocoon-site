
namespace `examples.team` (
  class BaseProfileCard extends Component {
    styles = ['./src/lab/shared.css'];

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.nameLabel    = this.querySelector('.name');
      this.roleLabel    = this.querySelector('.role');
      this.avatar       = this.querySelector('.avatar');
      this.badge        = this.querySelector('.badge');
      this.actionLabel  = this.querySelector('.card-action-label');
      this.statusLabel  = this.querySelector('.status-label');
      this.status       = this.querySelector('.status');

      this.paint();

      this.unsubscribe = [
        this.subscribe('access:approved', e => this.onApproved(e.detail)),
        this.subscribe('member:selected', e => this.onSelected(e.detail)),
      ];
    }

    onDisconnected() {
      this.unsubscribe?.forEach(stop => stop());
    }

    paint() {
      this.nameLabel.textContent = this.person.name;
      this.roleLabel.textContent = this.person.role;
      this.avatar.textContent = this.person.initials;
      this.avatar.dataset.person = this.componentKey;
      this.badge.hidden = this.componentKey !== 'admin';
      this.actionLabel.textContent = this.componentKey === 'admin' ? 'Manage permissions' : 'View profile';
      this.setStatus(this.componentKey === 'admin' ? 'Active' : 'Pending', this.componentKey === 'admin');
    }

    setStatus(text, approved) {
      this.statusLabel.textContent = text;
      this.status.dataset.active = String(approved);
    }

    reset() {
      this.paint();
    }
  }
);
