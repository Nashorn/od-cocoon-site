import 'lab.Component';

namespace `examples.team` (
  class AccessToolbar extends lab.Component {
    static tag = 'arc-access-toolbar';

    async onConnected() {
      await super.onConnected();
      this.selectMember   = this.querySelector('select#choose-member');
      this.approveButton  = this.querySelector('button#approve');

      this.on("click",    e => this.emit('approve'), false, this.approveButton);
      this.on("change",   e => this.emit('select'),  false, this.selectMember);
    }

    get person() {
      const members = {
        alex: {
          id: 'alex',
          name: 'Jason Smith',
          role: 'Designer',
          initials: 'AL',
        },
        jordan: {
          id: 'jordan',
          name: 'Jordan Park',
          role: 'Developer',
          initials: 'JP',
        },
      };

      const selectedMember = this.selectMember.value;
      return members[selectedMember];
    }

    emit(flow, person = this.person) {
      this.fire(flow === 'approve' ? 'access:approved' : 'member:selected', person);
    }

    reset() { 
      this.selectMember.value = 'alex'; 
    }
  }
);
