namespace `examples` (
  class HelloWorld extends Component {
    static tag = 'hello-world';

    inShadow() { return true; }

    async onConnected() {
      await super.onConnected();
      this.on('click', () => this.onPulse(), false, 'button');
    }

    onRendered() {
      this.dispatchEvent('lifecycle:hook', { phase: 'render', hook: 'onRendered()' });
    }

    onAwake() {
      this.dispatchEvent('lifecycle:hook', { phase: 'awake', hook: 'onAwake()' });
    }

    onDisconnected() {
      this.dispatchEvent('lifecycle:hook', { phase: 'sleep', hook: 'onDisconnected()' });
    }

    onSleep() {
      this.dispatchEvent('lifecycle:hook', { phase: 'sleep', hook: 'onSleep()' });
    }

    onPulse() {
      this.querySelector('dialog').animate(
        [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }],
        { duration: 420, easing: 'ease-out' }
      );
    }
  }
);
