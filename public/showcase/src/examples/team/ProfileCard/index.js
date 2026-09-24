import 'lab.Component';

namespace `examples.team` (
  class ProfileCard extends lab.Component {
    async onConnected() {
      await super.onConnected();
      this.paint();
      this.unsubscribe = [
        this.subscribe('access:approved', event => this.onApproved(event.detail)),
        this.subscribe('member:selected', event => this.onSelected(event.detail)),
      ];
      this.setAttribute('ready', '');
    }
    onDisconnected() { this.unsubscribe?.forEach(stop => stop()); }
    paint() {
      this.querySelector('.name').textContent = this.person.name;
      this.querySelector('.role').textContent = this.person.role;
      this.querySelector('.avatar').textContent = this.person.initials;
      this.querySelector('.avatar').dataset.person = this.componentKey;
      this.querySelector('.badge').hidden = this.componentKey !== 'admin';
      this.querySelector('.card-action-label').textContent = this.componentKey === 'admin' ? 'Manage permissions' : 'View profile';
      this.setStatus(this.componentKey === 'admin' ? 'Active' : 'Pending', this.componentKey === 'admin');
    }
    setStatus(text, approved) {
      this.querySelector('.status-label').textContent = text;
      this.querySelector('.status').dataset.active = String(approved);
    }
    reset() { this.paint(); }
  }
);
