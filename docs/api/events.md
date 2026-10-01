# Events and signals

Local DOM listeners and document-wide replayable signals have different targets, lifetimes, and return contracts. Choose the mechanism based on who owns the interaction.

## Example: choose a product and update a basket summary

Put these two controllers in `src/components/ProductPicker/index.js` and `src/components/BasketSummary/index.js`. Import both through your Application's import map, as shown in [application setup](application.md), then place `<product-picker></product-picker>` and `<basket-summary></basket-summary>` in the page. Their templates are included in JavaScript; neither needs an HTML or CSS file.

`ProductPicker/index.js`:

```javascript
namespace `components` (
  class ProductPicker extends Component {
    static tag = 'product-picker';
    static skin = null;
    inShadow() {
      return true;
    }

    html() {
      return `
        <template>
          <button type="button">Choose coffee — $12</button>
        </template>
      `;
    }

    onRendered() {
      this.clicks?.abort();
      this.clicks = new AbortController();
      this.root.querySelector('button').addEventListener('click', () => {
        this.fire('shop:selection', { name: 'Coffee', price: 12 });
      }, { signal: this.clicks.signal });
    }

    async onDisconnected() {
      this.clicks?.abort();
      await super.onDisconnected();
    }
  }
);
```

`BasketSummary/index.js`:

```javascript
namespace `components` (
  class BasketSummary extends Component {
    static tag = 'basket-summary';
    static skin = null;
    inShadow() {
      return true;
    }

    html() {
      return `
        <template>
          <p role="status">Choose a product.</p>
        </template>
      `;
    }

    onRendered() {
      this.stopSelection?.();
      const output = this.root.querySelector('p');
      this.stopSelection = this.subscribe('shop:selection', event => {
        const { name, price } = event.detail;
        output.textContent = `${name}: $${price.toFixed(2)}`;
      });
    }

    async onDisconnected() {
      this.stopSelection?.();
      this.stopSelection = null;
      await super.onDisconnected();
    }
  }
);
```

Clicking the button displays **Coffee: $12.00** in the other component. A summary added afterward receives retained selections too. Each callback replaces displayed state; it does not add to a total or repeat a purchase. This matters because the current runtime replays every retained event, not only the latest one.

The native button listener handles a local interaction. `fire()` and `subscribe()` connect components in the same document without either querying the other's DOM. `onRendered()` rebinds resources after markup replacement; cleanup prevents duplicate listeners on reconnection. These examples deliberately use native listener cancellation where Cocoon's delegated `on()` has no cleanup handle.

| Need | Use |
| --- | --- |
| Handle a click within your component | `on()` or a native listener |
| Notify ancestors through DOM propagation | `dispatchEvent()` |
| Share a replayable notification within the document | `fire()` and `subscribe()` |
| Send a one-time command that must never replay | A normal DOM event or an explicitly owned method call |

## `on(eventName, handler, capture = false, selector)`

Convenience wrapper for Cocoon's `addEventListener(eventName, handler, capture, selector)`. Both return `undefined`; neither returns a cleanup handle.

### Listener routing

| Fourth argument | Where/how the listener is attached |
| --- | --- |
| Omitted/falsy | On `root` when it is a Document, otherwise on the component host through the native superclass method. |
| A Node | On `root`; match that exact node in the event's composed path. |
| Ordinary CSS selector string | On `root`; select the first matching node in the composed path. |
| Extended selector using `>>>` or `::document` | Call `find()` once, then attach directly to the first resolved element. |

```javascript
this.on('click', event => {
  const button = event.matchedTarget;
  this.selectedId = button.dataset.id;
}, false, 'button[data-id]');
```

Delegation stores the matched node on `event.matchedTarget`. `event.target` is still the event's native target and can differ. The composed-path search is not explicitly bounded to descendants after a particular root index, so select narrowly.

An extended selector is a delayed direct binding, **not** permanently delegated traversal. If it times out with no match, no listener is added. If rendering later replaces that matched node, the old direct listener does not follow its replacement.

### Cleanup

The delegated branches wrap your callback. Passing the original callback to native `removeEventListener` is not a general way to remove those wrappers. There is no matching Cocoon removal helper in this implementation.

For a listener needing explicit lifetime control, use a known native target with an `AbortController` or a retained native handler:

```javascript
this.listeners = new AbortController();
this.querySelector('button.save').addEventListener('click', () => {
  this.dispatchEvent('profile:save-requested', { name: this.data.name });
}, {
  signal: this.listeners.signal,
});
// During disconnection:
this.listeners.abort();
```

This fragment assumes a rendered save button and a `this.data.name` value. The native target must be known to exist.

## `dispatchEvent(type, data = {}, element)`

Cocoon's override accepts a type string or an existing Event object. It returns the dispatched **event object**, rather than the native method's boolean success result.

Destination precedence:

1. Explicit truthy `element` argument.
2. Wrapped `this.element`, if present.
3. `root`, if it is a Document.
4. The native component host.

This method does not put the event in replay history. It can still bubble to document listeners according to its flags and route.

### Data and event options

For a normal payload:

```javascript
const event = this.dispatchEvent('selection:changed', { id: 42 });
console.log(event.detail.id);
```

For explicit event flags, keep payload under `detail`:

```javascript
this.dispatchEvent('selection:changed', {
  detail: { id: 42 },
  bubbles: false,
  cancelable: true,
  composed: false,
});
```

Default flags are `bubbles: true`, `cancelable: true`, and `composed: true`. The implementation selects `data.detail || data || {}` as the payload, removes reserved option fields from that payload, then assigns remaining outer data fields to the event options.

Consequences:

- A flat `{ bubbles: false, id: 42 }` payload does **not** reliably set that flag: `bubbles` is removed from the shared payload object before outer options are copied. Use the nested shape above.
- The outer `detail` property and reserved fields on the payload are deleted during normalization. Pass a fresh mutable object; do not assume dispatch preserves the input object's shape.
- A falsy `detail` value takes the fallback path instead of being preserved as-is.
- Cocoon populates `event.data` when it is absent/falsy; new examples should read the standard `event.detail`.
- Passing an existing Event bypasses new-event construction, but still runs the input normalization and optional `event.data` assignment. It does not rebuild that Event's immutable flags.

To check cancellation, inspect the returned event's `defaultPrevented` where appropriate; do not treat the return value as a boolean.

## `fire(type, data = {})`

Dispatches on `document`, adds the dispatched event object to per-type replay history, and returns it.

```javascript
this.fire('selection:changed', { id: 42 });
```

This is a document-wide signal rather than a host-local event. Its target is the document; include an explicit source identifier in the payload if subscribers need to distinguish publishers. There is no implicit prefix using the component namespace.

The current signature has no custom-destination argument. Use `dispatchEvent` when a different target is required.

## `broadcast(type, data = {})`

Delegates to `fire`, including its target, mutation behavior, return value, and history retention.

## `subscribe(eventType, listener, capture)`

Synchronously calls the listener for each retained event of that type, then adds it as a document event listener. Returns a function that removes that registration with the same capture value.

```javascript
const unsubscribe = this.subscribe('selection:changed', event => {
  this.selectedId = event.detail.id;
});
```

### Replay contract

Replaying every retained event is intentional. A subscription is not a latest-value-only store.

- History is a Set of **event objects**, not a latest-value slot and not a cloned payload log.
- Distinct events fired under the same type all replay in insertion order.
- The original event/payload references are retained; later mutations can be visible during replay.
- Unsubscribing removes the listener, not retained history.
- A later subscription replays again, including after component reconnection.
- Replay runs before `subscribe` returns. Do not assume the variable receiving the cleanup function is initialized inside a replay callback.
- A synchronous exception in the replay callback interrupts subscription before the document listener is attached.

`fire` dispatches first and stores history afterward. A listener subscribing another listener during that dispatch cannot assume the event currently being dispatched is already present in history. Do not use reentrant subscription order as an application synchronization protocol.

A matching document event emitted through ordinary DOM APIs reaches current subscribers, but is not automatically retained by this history mechanism.

### Choosing a signal

Use signals for meaningful cross-component state transitions that can tolerate replay. Avoid assuming that high-frequency events are automatically coalesced or history is bounded: there is no public history eviction operation in these methods.

Use ordinary DOM events for local user interactions where bubbling/delegation and native event lifetime are sufficient. Store and release signal subscriptions during the component's lifecycle.
