
namespace `components` (
  class HelloWorld extends Component {
    static tag = 'hello-world';

    async onConnected() {
      await super.onConnected(); //required
      
      this.count = 0;
      this.card       = this.querySelector('article');
      this.heading    = this.querySelector('h1');
      this.greetings  = [
        'Hello World', 
        'Hola, mundo', 
        'Bonjour, le monde', 
        'こんにちは世界'
      ];
      
      this.on('click', () => this.onSayHello(), false, '#say-hello');
      this.on('click', () => this.onDismiss(), false, '#dismiss, #close');
    }

    onSayHello() {
      this.count = (this.count + 1) % this.greetings.length;
      this.heading.textContent = this.greetings[this.count];
    }

    async onDismiss() {
      await this.card.animate(
        [{ opacity: 1, transform: 'translateY(0) scale(1)' },
         { opacity: 0, transform: 'translateY(8px) scale(.98)' }],
        { duration: 260, easing: 'ease-out', fill: 'forwards' }
      ).finished;

      this.remove();
    }

    inShadow() { return false; } // not using shadow DOM
  }
);
