
namespace `lab` (
  class StatsCarousel extends Component {
    styles = ['./src/lab/shared.css'];

    inShadow() { return true; }

    static tag = 'arc-stats-carousel';

    get tiles() {
      return [
        { value: '2,000', label: 'Lines of source', detail: 'Including comments and blank lines, in the shipped source.', tone: 'blue', icon: 'file',
          note: '1,890 physical lines, including comments and blank lines, in the shipped source.' },
        { value: '14 kB', label: 'Gzipped kernel', detail: 'A compact application kernel.\nDelivered in a single file.', tone: 'violet', icon: 'cube',
          note: '45 kB minified · 69.65 kB source. Gzip level 9; decimal kB. Shipped kernel snapshot.' },
        { value: '0', label: 'Build steps', detail: 'Your source runs directly.\nNo compilation or bundling.', tone: 'amber', icon: 'bolt' },
        { value: '0', label: 'Virtual DOM', detail: 'Update native elements directly.\nNo virtual tree or reconciliation.', tone: 'teal', icon: 'layers' },
      ];
    }

    get icons() {
      return {
        file: '<path d="M14 5h17l11 11v34H14z"/><path d="M31 5v12h11"/>',
        cube: '<path d="m28 5 22 12v25L28 54 6 42V17zM6 17l22 13 22-13M28 30v24"/><path d="m17 11 22 13"/>',
        bolt: '<path d="M32 4 10 33h17l-3 23 23-31H30z"/>',
        layers: '<path d="m28 6 24 13-24 13L4 19zM4 30l24 13 24-13M4 41l24 13 24-13"/>',
      };
    }

    async onConnected() {
      await super.onConnected();
      this.track       = this.querySelector('.track');
      this.previous    = this.querySelector('.previous');
      this.next        = this.querySelector('.next');
      this.indicators  = this.querySelector('.indicators');
      this.navigation  = this.querySelector('.navigation');

      this.renderTiles();
      this.on('click',   e => this.move(-1), false, this.previous);
      this.on('click',   e => this.move(1),  false, this.next);
      this.on('click', e => {
        const button = e.target.closest('button[data-position]');
        if (button) this.scrollToPosition(Number(button.dataset.position));
      }, false, this.indicators);
      this.on('scroll',  e => this.updateNavigation(), true, this.track);
      this.on('keydown', e => this.onKeyDown(e), false, this.track);

      this.resizeObserver = new ResizeObserver(() => this.updateNavigation());
      this.resizeObserver.observe(this.track);
      this.updateNavigation();
    }

    onDisconnected() {
      this.resizeObserver?.disconnect();
    }

    renderTiles(tiles = this.tiles) {
      this.track.replaceChildren(...tiles.map(tile => {
        const card = document.createElement('li');
        card.className = 'tile';
        card.dataset.tone = tile.tone;
        card.innerHTML = '<span class="icon" aria-hidden="true"><svg viewBox="0 0 56 60"></svg></span><div class="copy"><p class="value"></p><p class="label"></p><p class="detail"></p></div>';
        card.querySelector('svg').innerHTML = this.icons[tile.icon] || this.icons.file;
        card.querySelector('.value').textContent = tile.value;
        card.querySelector('.label').textContent = tile.label;
        card.querySelector('.detail').textContent = tile.detail;
        if (tile.note) card.title = tile.note;
        return card;
      }));
      this.updateNavigation();
    }

    move(direction) {
      const cards = [...this.track.children];
      const current = this.track.scrollLeft;
      const positions = cards.map(card => card.offsetLeft - cards[0].offsetLeft);
      const target = direction > 0
        ? positions.find(position => position > current + 2) ?? this.track.scrollWidth
        : positions.findLast(position => position < current - 2) ?? 0;
      this.scrollToPosition(target);
    }

    scrollToPosition(position) {
      this.track.scrollTo({
        left: position,
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
      });
    }

    onKeyDown(event) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      event.preventDefault();
      this.move(event.key === 'ArrowRight' ? 1 : -1);
    }

    updateNavigation() {
      const hideControls = this.track.children.length <= 4;
      this.navigation.hidden = hideControls;
      this.indicators.hidden = hideControls;
      const end = this.track.scrollWidth - this.track.clientWidth;
      this.previous.disabled = this.track.scrollLeft <= 2;
      this.next.disabled = this.track.scrollLeft >= end - 2;

      const cards = [...this.track.children];
      const positions = [...new Set(cards.map(card =>
        Math.round(Math.max(0, Math.min(end, card.offsetLeft - cards[0].offsetLeft)))
      ))];
      const signature = positions.join(',');
      if (this.indicators.dataset.positions !== signature) {
        this.indicators.dataset.positions = signature;
        this.indicators.replaceChildren(...positions.map((position, index) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.dataset.position = position;
          button.setAttribute('aria-label', `Go to stats position ${index + 1} of ${positions.length}`);
          return button;
        }));
      }
      const nearest = positions.reduce((best, position, index) =>
        Math.abs(position - this.track.scrollLeft) < Math.abs(positions[best] - this.track.scrollLeft) ? index : best, 0);
      [...this.indicators.children].forEach((button, index) => {
        button.setAttribute('aria-current', String(index === nearest));
      });
    }
  }
);
