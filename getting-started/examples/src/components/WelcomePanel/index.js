namespace `components` (
  class WelcomePanel extends Component {
    static tag = 'welcome-panel';

    async onConnected() {
      await super.onConnected();
      this.dialog = this.querySelector('dialog');
    }

    open() {
      this.dialog.showModal();
    }

    inShadow() { return true; } // using shadow DOM
  }
);
