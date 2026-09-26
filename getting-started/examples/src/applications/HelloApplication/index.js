import 'components.HelloWorld'; //see .importmap
import 'components.WelcomePanel';

namespace `applications` (
  class HelloApplication extends Application {
    async onConnected() {
      await super.onConnected(); //required
      this.welcome = this.querySelector('welcome-panel');

      this.on('click', () => this.welcome.open(), false, '#continue');
    }
  }
);
