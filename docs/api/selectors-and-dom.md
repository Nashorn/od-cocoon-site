# Selectors and DOM utilities

## `querySelector(selector)` and `querySelectorAll(selector)`

Immediate queries; they do not wait for child component rendering.

For ordinary CSS selectors:

1. If the component uses shadow DOM or wraps another element/document, query `root` first.
2. If the root has no match, query the component host through the native element query method.
3. Return the first element/`null`, or the native query collection.

The all-elements method falls back only when the first result is empty. It does not merge shadow-root and light-DOM results. An ordinary selector does not recursively pierce nested shadow roots.

```javascript
const button = this.querySelector('button.save');
const rows = [...this.querySelectorAll('.row')];
```

## Explicit boundary traversal

| Operator | Traversal |
| --- | --- |
| `>>>` | Enter each matching element's accessible `shadowRoot`. |
| `::document` | Enter each matching iframe's accessible `contentDocument`. |

```javascript
this.querySelector('profile-card >>> button.save');
this.querySelectorAll('iframe.preview ::document profile-card >>> .row');
```

Extended queries start at `root`, follow the explicit boundaries, and skip unavailable roots/documents. They do not bypass cross-origin access restrictions or expose closed shadow roots. They do not use the ordinary host fallback/merge behavior at each boundary.

`querySelectorAll()` returns an **array** for these extended queries; ordinary CSS queries normally return a `NodeList`. Convert with `Array.from()` when code needs a consistent collection shape.

## `find(selector, scan_interval = 300, scan_duration = 3000)`

Returns a promise resolving to a matching element, or `null` on timeout. It checks immediately and observes child-node changes while waiting.

```javascript
const button = await this.find('profile-card >>> button.save', 300, 5000);
if (button) button.focus();
```

The positional `scan_interval` is accepted by the signature but not used as a polling interval by the current resolver. The timeout is `scan_duration` milliseconds.

## `findAll(selector, options = {})`

```javascript
const rows = await this.findAll('.row', {
  expect: 3,
  scan_duration: 5000,
});
```

| Option | Default | Behavior |
| --- | --- | --- |
| `expect` | `2` | Resolve when at least this many matches are observed. A falsy value falls back to 2. |
| `scan_duration` | `3000` | Timeout in milliseconds. |
| `scan_interval` | `300` | Accepted but not used for polling. |

Always resolves to an array. At timeout it returns the last observed matches, even if fewer than `expect`; it does not reject just because the target count was not reached. Use `expect: 1` when one result is sufficient. Use immediate `querySelectorAll()` if waiting for a count is unnecessary.

Unlike `find`, `findAll` takes an options object as its second argument, not positional interval/timeout arguments.

### What wakes a wait

The resolver observes `childList` mutations with `subtree: true` on relevant roots. It also installs load listeners on encountered iframes in extended paths. It disconnects these observers/listeners when it resolves or times out.

Limits to account for:

- It does not observe attribute-only changes. Adding a matching class to an existing node may not wake a pending search until another observed change occurs.
- Attaching a shadow root without a corresponding observed child mutation is not a universal wake-up signal.
- Extended-path observers can resume from the changed branch. Do not assume every wake-up recounts every parallel root globally.
- There is no cancellation argument. Disconnection of your component does not itself cancel all outstanding finds.
- Malformed selectors are errors, not a normal “not found” result. Pass valid selectors and handle promise rejection when the selector is dynamic.

## `append(element, container = this.root)`

Appends using `container.append(element)` on the next animation frame and resolves with the supplied element.

```javascript
const badge = document.createElement('span');
badge.textContent = 'Ready';
await this.append(badge);
```

This Cocoon method has a single element plus optional container signature. It is not the native variadic `Element.append(...nodes)` contract. It does not wait for appended custom elements' asynchronous lifecycle work or subsequent paint. Pass an existing valid container; exceptions inside the scheduled callback are not connected to an explicit reject path in the wrapper promise.

For shadow components, appending to the default root adds shadow content. Use the host's native `appendChild` when you intend to add a light-DOM child for slot projection.

## `setAttribute(name, value)`

For an ordinary component, delegates to the native host implementation. For a wrapped component (`element` supplied), forwards to `root.setAttribute()`.

Do not assume a wrapped application document implements `setAttribute`. To modify page attributes, target `document.documentElement` or `document.body` explicitly. This helper is not a general document-attribute abstraction.

## `getBoundingClientRect(element)`

Uses the supplied element's rectangle, or the component host's native rectangle when omitted. Adds:

```javascript
const rect = this.getBoundingClientRect(this.querySelector('.card'));
console.log(rect.center.x, rect.center.y);
```

`center.x = left + width / 2`; `center.y = top + height / 2`. Coordinates remain viewport-relative. The default is the host, not automatically the wrapped element or shadow root. There is no “wait until laid out” step.
