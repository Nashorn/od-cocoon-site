import 'lab.Component';

const members = {
  alex: { id: 'alex', name: 'Alex Lee', role: 'Designer', initials: 'AL' },
  jordan: { id: 'jordan', name: 'Jordan Park', role: 'Developer', initials: 'JP' },
};
namespace `examples.team` (
  class AccessToolbar extends lab.Component {
    static tag = 'arc-access-toolbar';
    async onConnected() {
      await super.onConnected();
      this.querySelector('button').addEventListener('click', () => this.emit('approve'));
      this.querySelector('select').addEventListener('change', () => this.emit('select'));
      this.setAttribute('ready', '');
    }
    get person() { return members[this.querySelector('select').value]; }
    emit(flow, person = this.person) {
      this.fire(flow === 'approve' ? 'access:approved' : 'member:selected', person);
    }
    reset() { this.querySelector('select').value = 'alex'; }
  }
);
