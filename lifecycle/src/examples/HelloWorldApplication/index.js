import 'examples.HelloWorld';

namespace `examples` (
  class HelloWorldApplication extends Application {
    async onConnected() {
      await super.onConnected();
      this.subscribe('connected', event => {
        console.log('Component connected to the world:', event.target);
      });
    }
  }
);
