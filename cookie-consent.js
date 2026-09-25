import { measurementId } from './analytics-config.js';

class CookieConsent extends HTMLElement {
  static key = 'cocoon.analytics-consent.v1';

  connectedCallback() {
    if (this.root) return;
    this.root = this.attachShadow({ mode: 'open' });
    this.root.innerHTML = `
      <style>
        :host{font-family:'Instrument Sans',system-ui,sans-serif;color:#edf2fc}
        *{box-sizing:border-box}
        [hidden]{display:none!important}
        .banner{
          position: fixed;
          z-index: 10000;
          bottom: max(18px, env(safe-area-inset-bottom));
          right: 20px;
          width: min(380px, calc(100vw - 40px));
          display: grid;
          grid-template-columns: 26px minmax(0, 1fr);
          align-items: start;
          gap: 12px;
          padding: 16px;
          max-height: calc(100dvh - 40px);
          overflow-y: auto;
          border: 1px solid #16181c;
          border-radius: 12px;
          background: #1518207a;
          backdrop-filter: blur(6px);
          box-shadow: 0 8px 35px #0006;
        }
        .shield{width:26px;height:30px;flex-shrink:0;fill:none;stroke:#75a4ff;stroke-width:1.7}
        .copy{flex:1;min-width:0}
        h2{font-size:15px;font-weight:600;margin:0 0 5px}
        p{font-size:13px;line-height:1.5;color:#a8b7cd;margin:0}
        .actions{grid-column:1/-1;display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .note{grid-column:1/-1;text-align:center;font-size:11px;line-height:1.5}
        button{font:inherit;cursor:pointer}
        .actions button{
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 7px;
          min-height: 44px;
          padding: 8px;
          border: 1px solid #536d9440;
          border-radius: 8px;
          background: #121d2ec7;
          color: #edf2fc;
          font-size: 12px;
          font-weight: 500;  
        }
        .actions svg{width:15px;height:15px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
        .actions button:hover{background:#243854}
        a{color:#bed0ed;text-underline-offset:3px}
        a:focus-visible,button:focus-visible{outline:2px solid #a9c8ff;outline-offset:4px}
        .settings-link{font:inherit;color:#bed0ed;background:none;border:0;padding:0;text-decoration:underline;text-underline-offset:3px}
        .cancel{background:none;border:0;padding:4px 0;color:#bed0ed;text-decoration:underline;font-size:13px}
        @media(max-width:480px){.banner{right:12px;width:calc(100vw - 24px);bottom:max(12px,env(safe-area-inset-bottom));padding:16px;gap:12px;max-height:calc(100dvh - 24px)}}
      </style>
      <section class="banner" role="region" aria-labelledby="consent-title" hidden>
        <svg class="shield" viewBox="0 0 28 32" aria-hidden="true"><path d="m14 2 11 4v10c0 6-6 11-11 14C9 27 3 22 3 16V6z"/><path d="m8 15 4 4 8-9"/></svg>
        <div class="copy">
          <h2 id="consent-title">Your privacy, your choice.</h2>
          <p>With your permission, we use analytics cookies to understand how visitors use this site.</p>
          <button class="cancel" hidden>Keep current choice</button>
        </div>
        <div class="actions">
          <button data-choice="denied"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>Reject</button>
          <button data-choice="granted"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>Accept</button>
        </div>
        <p class="note">Change anytime via <button type="button" class="settings-link" data-cookie-settings>Cookie settings</button>. <a href="privacy.html">Privacy &amp; cookies</a></p>
      </section>`;
    this.banner = this.root.querySelector('.banner');
    this.root.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => this.choose(button.dataset.choice)));
    this.root.querySelector('.cancel').addEventListener('click', () => this.close());
    this.root.querySelector('[data-cookie-settings]').addEventListener('click', () => this.open());
    this.choice = this.read();
    if (this.choice === 'granted') this.enableAnalytics();
    if (!this.choice) this.banner.hidden = false;
    this.onStorage = event => {
      if (event.key !== CookieConsent.key && event.key !== null) return;
      const choice = this.read();
      if (this.analyticsLoaded && choice !== 'granted') this.disableAnalytics();
      this.choice = choice;
      if (choice === 'granted') this.enableAnalytics();
      this.banner.hidden = !!choice;
    };
    window.addEventListener('storage', this.onStorage);
  }

  disconnectedCallback() {
    window.removeEventListener('storage', this.onStorage);
  }

  read() {
    try {
      const saved = JSON.parse(localStorage.getItem(CookieConsent.key));
      if (saved?.expires > Date.now() && ['granted', 'denied'].includes(saved.choice)) return saved.choice;
    } catch {}
    return null;
  }

  open() {
    this.returnFocus = document.activeElement;
    this.root.querySelector('.cancel').hidden = !this.choice;
    this.banner.hidden = false;
    this.root.querySelector('[data-choice]').focus();
  }

  close() {
    this.banner.hidden = true;
    this.returnFocus?.focus();
  }

  choose(choice) {
    this.choice = choice;
    try {
      localStorage.setItem(CookieConsent.key, JSON.stringify({ choice, expires: Date.now() + 180 * 86400000 }));
    } catch {} // The choice still applies for this page if storage is unavailable.
    this.close();
    if (choice === 'granted') this.enableAnalytics();
    else this.disableAnalytics();
  }

  enableAnalytics() {
    if (this.analyticsLoaded || !/^G-[A-Z0-9]+$/.test(measurementId)) return;
    this.analyticsLoaded = true;
    window['ga-disable-' + measurementId] = false;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {
      analytics_storage: 'denied', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied',
    });
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    window.gtag('js', new Date());
    window.gtag('config', measurementId, {
      allow_google_signals: false, allow_ad_personalization_signals: false,
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(measurementId);
    document.head.append(script);
  }

  disableAnalytics() {
    window['ga-disable-' + measurementId] = true;
    // Clear GA cookies at host and parent-domain scopes.
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.trim().split('=')[0];
      if (!/^(_ga($|_)|_gid$|_gat($|_))/.test(name)) continue;
      document.cookie = name + '=; Max-Age=0; path=/';
      const labels = location.hostname.split('.');
      for (let i = 0; i < labels.length - 1; i++) {
        document.cookie = name + '=; Max-Age=0; path=/; domain=' + labels.slice(i).join('.');
      }
    }
    // Unload an already-started tag rather than leaving it sending denied-mode pings.
    if (this.analyticsLoaded) location.reload();
  }
}

customElements.define('arc-cookie-consent', CookieConsent);
const consent = document.createElement('arc-cookie-consent');
document.body.append(consent);
document.querySelectorAll('[data-cookie-settings]').forEach(button => {
  button.addEventListener('click', () => consent.open());
});
