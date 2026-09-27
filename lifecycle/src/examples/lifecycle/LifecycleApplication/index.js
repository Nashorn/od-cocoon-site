import 'examples.lifecycle.LifecycleCard';

namespace `examples.lifecycle` (
  class LifecycleApplication extends Application {
    async onConnected() {
      await super.onConnected();
      this.subscribe('connected', event => {
        console.log('Component connected to the world:', event.target);
      });
    }
  }
);
