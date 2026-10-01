# Lifecycle

Cocoon separates construction, connection, template rendering, and disconnection. A browser attaching an element does not synchronously complete its asynchronous connection work.

## Construction and initialization

The component constructor calls `initialize(element, options)` without awaiting it. Initialization selects the rendering root and captures whether a declarative shadow root already exists. For a supplied wrapped element/document, it also starts `connectedCallback()` during construction.

This matters for subclasses: methods called during base construction can run before subclass fields or the remainder of the subclass constructor. Keep root-selection overrides such as `inShadow()` independent of fields initialized after `super()`.

For ordinary custom elements, the browser invokes connection when the registered element enters the document. Do not replace the native callbacks to implement ordinary application logic; override the Cocoon hooks below.

## `onConnected(data = {})`

Base connection is an ordered asynchronous pipeline:

| Step | Action | Awaited? |
| --- | --- | --- |
| 1 | Dispatch framework render-activity start with a component token | Synchronous dispatch |
| 2 | Assign `this.data = data` | Synchronous |
| 3 | Build inherited/concrete stylesheet collection | Yes |
| 4 | Load/adopt collected sheets and subscribe to document-sheet announcements | Yes at the method boundary; see stylesheet completion caveats |
| 5 | `render(this.data)` | Yes |
| 6 | Add ancestry classes and namespace attribute | Yes |
| 7 | Add connected custom state where element internals are available | Synchronous |
| 8 | `onAwake()` | No promise await |
| 9 | `fire('connected')` | Synchronous dispatch/history retention |
| 10 | Dispatch framework render-activity end in `finally` | Synchronous, including failure paths |

`onRendered()` runs inside step 5, before step 6 and before `onAwake()`. The `connected` signal is emitted before execution returns from `super.onConnected()` to a subclass.

```javascript
async onConnected(data) {
  // Establish values needed by templates or css() before calling super.
  this.accent = 'rebeccapurple';
  await super.onConnected(data);
  // Root content exists; now cache references or attach listeners.
  this.output = this.querySelector('output');
}
```

Preserve the superclass call to retain the pipeline. Passing explicit data replaces the default empty object for that connection. Browser attachment does not itself pass your application data object.

### Completion and failure

The component activity token encloses the base pipeline, not all later asynchronous work in overriding methods. A base `connected` event does not mean the subclass has finished initialization, all child components have connected, or the page has painted.

If awaited work fails, later base steps are skipped and the activity-end event still fires. Activity end means tracking finished, not necessarily success. The native custom-element system does not turn an asynchronous lifecycle return value into a promise that callers of `appendChild()` can await.

## Lazy connection

```javascript
static lazy = true;
```

Or set the attribute on the instance before its initial construction/upgrade:

```html
<ui-profile-card lazy></ui-profile-card>
```

The instance `lazy` field captures `hasAttribute('lazy')`; therefore `lazy="false"` still enables it. The class flag and instance field are ORed: an instance false value does not disable a true class flag.

When lazy:

- The framework creates an `IntersectionObserver` using default observer options.
- It observes the host and calls `onConnected(data)` on an intersecting entry.
- It awaits that call, then unobserves the host.
- The connection callback itself does not wait for future visibility.

This delays connection/render/style work. It does not defer namespace registration, module imports, the constructor, or root initialization. There is no separate click/focus activation branch in this implementation.

Changing the HTML attribute after the instance field has been initialized does not automatically synchronize that field. On a later connection, a new observer can be created. The base disconnection path does not explicitly disconnect this lazy observer, and unobserve occurs after successful awaited connection; failure/reconnection handling should not be assumed to be a one-time activation guarantee.

## `onRendered()`

Called after the chosen render branch, including inline rendering and preserved declarative markup. It can run on initial connection and on every explicit `render()`.

Use it for operations that must target the newly rendered node identities. Do not assume every call implies content was replaced, or that connection-time classes and state have already been assigned on the first call.

Its return value is not awaited. A synchronous exception interrupts rendering; an asynchronous operation started here runs independently unless your code explicitly tracks it.

## `onAwake()`

Called after base rendering and internal-attribute assignment. Its return value is not awaited.

The component implementation registers an instance in the simulation component list when it has any of `onUpdate`, `onDraw`, or `onFixedUpdate`. Overriding without calling `super.onAwake()` replaces that behavior. `Application` supplies its own empty override, so do not assume all base classes share identical awake behavior.

An ordinary `Component` does not start the simulation loop merely because it defines an update hook. Loop ownership belongs to the application/World path. Reconnection registration and automatic removal from that list are not implemented by these two base hooks; see the discovery audit before relying on repeat attachment for simulation components.

## Connected custom state

After rendering, the base attempts to add `connected` through `ElementInternals.states`, falling back to `--connected` if the first spelling throws. Optional internals mean this state is not guaranteed for every root/construction mode.

The inspected disconnection code does not remove the state. Do not equate `:state(connected)` with the native `isConnected` property or treat it as a universal reversible visibility signal.

## `onDisconnected()` and `onSleep()`

The framework's disconnection callback:

1. Removes its document-stylesheet signal subscription, if present.
2. Awaits `onDisconnected()`.
3. Calls `onSleep()` without awaiting a returned promise.

A rejection from `onDisconnected()` prevents the subsequent `onSleep()` call; it is not in a `finally` block.

```javascript
async onConnected(data) {
  await super.onConnected(data);
  this.stopListening?.();
  this.stopListening = this.subscribe('selection:changed', event => {
    this.querySelector('output').textContent = event.detail.label;
  });
}

async onDisconnected() {
  this.stopListening?.();
  this.stopListening = null;
  this.inputWatch?.unwatch();
  this.pool?.terminate();
  await super.onDisconnected();
}
```

Base `onDisconnected` and `onSleep` are otherwise empty. They do not universally clean up your timers, observers, workers, input watches, subscriptions, or externally installed listeners.

## Reconnection and rerendering

These are different operations:

| Operation | Repeats connection pipeline? | Can replace markup? | Runs disconnection cleanup? |
| --- | --- | --- | --- |
| `render(data)` | No | Depending on render branch | No |
| Remove and reattach the element | Yes, subject to lazy activation | Yes | Disconnection callback runs on removal |
| Change a data field | No automatic work | No automatic work | No |

The template-source cache and stylesheet collection persist on the instance. Reconnection can rebuild/adopt sheets again and add subscriptions or update registrations again. Initialization does not guarantee deduplication of all resources. Make your owned-resource setup repeat-safe, and do not infer that an existing instance is a fresh component after reattachment.
