import 'lab.Showcase';
import 'lab.StatsCarousel';

namespace `lab` (
  class ShowcaseApplication extends Application {
    async onConnected() {
      await super.onConnected();
      this.subscribe('showcase:ready', () => window.showcaseFrame.ready());
    }
  }
);
