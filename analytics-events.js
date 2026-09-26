// Interaction events for Google Analytics. Loaded on the landing page and inside the demo
// iframes. cookie-consent.js owns gtag and only defines it after the visitor accepts, so
// nothing is sent without consent. Iframes forward to the landing page instead of loading
// their own tag.
//
// Mark up:  data-track="event_name" [data-track-label="…"]   → sent on click
//           data-track-view="section_name"                   → demo_view, once, when seen
// Code:     dispatch a composed, bubbling "analytics:track" event with { name, params }.
class AnalyticsEvents {
  static channel = "cocoon-analytics";
  static eventName = /^[a-z][a-z0-9_]{0,39}$/;

  constructor() {
    this.isFrame = window.parent !== window;
    // Capture phase on document sees clicks inside open shadow roots via composedPath().
    document.addEventListener("click", (event) => this.onClick(event), true);
    document.addEventListener("analytics:track", (event) => this.onTrack(event));
    if (this.isFrame) return;
    addEventListener("message", (event) => this.onMessage(event));
    this.observeViews();
  }

  onClick(event) {
    const element = event.composedPath().find(
      (node) => node instanceof Element && node.hasAttribute("data-track"),
    );
    if (!element) return;
    const label = element.dataset.trackLabel || element.textContent.replace(/\s+/g, " ").trim();
    this.send(element.dataset.track, { label: label.slice(0, 100) });
  }

  onTrack(event) {
    const { name, params } = event.detail || {};
    this.send(name, params);
  }

  // Only accept well-formed events from our own frames.
  onMessage(event) {
    if (event.origin !== location.origin || event.data?.type !== AnalyticsEvents.channel) return;
    this.send(event.data.name, event.data.params);
  }

  send(name, params = {}) {
    if (!AnalyticsEvents.eventName.test(name || "")) return;
    if (this.isFrame) {
      parent.postMessage({ type: AnalyticsEvents.channel, name, params }, location.origin);
      return;
    }
    if (typeof window.gtag !== "function") return;
    window.gtag("event", name, params);
  }

  observeViews() {
    const sections = document.querySelectorAll("[data-track-view]");
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        this.send("demo_view", { label: entry.target.dataset.trackView });
      }
    }, { threshold: 0.35 });
    sections.forEach((section) => observer.observe(section));
  }
}

new AnalyticsEvents();
