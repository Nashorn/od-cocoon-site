let sequence = 0;

/** Uses Cocoon fire/subscribe, with instance-local topics and bounded replay. */
export class SignalSession {
  constructor() {
    this.prefix = `arc-showcase-${++sequence}`;
    this.topics = new Set();
    this.subscriptions = new Set();
  }
  topic(name) {
    const topic = `${this.prefix}:${name}`;
    this.topics.add(topic);
    return topic;
  }
  publish(component, name, payload) {
    const topic = this.topic(name);
    // The pinned 8.6.0 kernel retains a Set of fired events. This demo owns
    // these topics and retains only their latest event, never another app's.
    globalThis._eventObjects.get(topic)?.clear();
    return component.fire(topic, { ...payload });
  }
  subscribe(component, name, listener) {
    const unsubscribe = component.subscribe(this.topic(name), listener);
    this.subscriptions.add(unsubscribe);
    return () => { unsubscribe(); this.subscriptions.delete(unsubscribe); };
  }
  dispose() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.topics.forEach(topic => globalThis._eventObjects.delete(topic));
    this.subscriptions.clear();
    this.topics.clear();
  }
}
