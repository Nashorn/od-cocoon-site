# Light DOM and shadow DOM

Cocoon lets a component render into its host's light DOM or into a shadow root. This choice affects content ownership, slots, CSS, queries, events, and integration with the surrounding page. It does not change whether the component is a real DOM element or whether its JavaScript can use browser APIs.

## Choose the rendering root

```javascript
inShadow() {
  return true;
}
```

Requests a shadow root during construction. For an ordinary component without an existing root, Cocoon attaches an **open** shadow root and uses it as `this.root`.

```javascript
inShadow() {
  return false;
}
```

Uses the ordinary host as the rendering root for a normal standalone component. This is useful when the component should participate directly in the page's DOM and styling.

Without an override, the base method checks for an existing internal/public shadow root and otherwise returns false. Its result can be a root object, not just a boolean. A parser-created declarative root can therefore select shadow behavior without an unconditional `return true` override.

This is an initialization decision. Changing the method's return value later does not move existing nodes, undo a shadow root, or reinitialize styling. Do not make the method depend on fields initialized after the base constructor has already called it.

## Compare the two modes

| Concern | Light-DOM rendering | Shadow-DOM rendering |
| --- | --- | --- |
| `this` | Host custom element | Host custom element |
| `this.root` | Normally the host | Normally the shadow root |
| Template output | Host's child nodes | Shadow root's child nodes |
| Page `querySelector` | Can find rendered descendants | Cannot directly find shadow descendants |
| Page selector rules | Can match component descendants | Do not directly match shadow descendants |
| Inherited values/tokens | Inherit through normal DOM | Can inherit through the host into shadow content |
| Supplied host children during ordinary template render | Replaced when root is cleared | Retained in light DOM; can be projected through slots |
| `<slot>` | No shadow projection by itself | Native named/default slot projection |
| Local styles | Document-level installation; selector discipline matters | Adopted into the shadow root |
| Events from internals | Normal DOM propagation | Boundary traversal depends on event flags; outer target can be retargeted |
| External integration | Direct descendant DOM access | Open root access or an explicit component API |

The Application boot path is a third root shape: its wrapped root is `document`. Do not assume every `root` has exactly the same methods as a host element or ShadowRoot.

## Matched rendering example

Controller:

```javascript
namespace `components` (
  class ContentCard extends Component {
    static tag = 'content-card';
    inShadow() {
      return true;
    } // Choose false for the light-DOM variant.
  }
);
```

`src/components/ContentCard/index.html`:

```html
<template>
  <article>
    <header><slot name="heading">Default heading</slot></header>
    <div class="body"><slot>Default content</slot></div>
  </article>
</template>
```

Page markup:

```html
<content-card>
  <h2 slot="heading">Account</h2>
  <p>Your account settings</p>
</content-card>
```

### Shadow variant

The template renders inside the root. The original h2 and p remain children of `<content-card>` in light DOM. Native slots display them at the corresponding points in the shadow template without physically moving them there.

```text
content-card
  light children: h2[slot=heading], p
  shadow root
    article
      header -> named slot projects h2
      body   -> default slot projects p
```

### Light variant

The template replaces the host's children, including the original h2 and p. A `<slot>` in this ordinary light-DOM tree does not itself project those removed nodes. Its fallback contents remain; Cocoon's active renderer does not emulate shadow slot distribution for light DOM.

This is a practical reason to select shadow DOM for components with supplied child content, or to select an inline enhancement pattern when preserving page-owned light DOM is the goal.

## Preserve existing light DOM with `inline`

```javascript
namespace `components` (
  class PagePanel extends Component {
    static tag = 'page-panel';
    static inline = true;

    async onConnected(data) {
      await super.onConnected(data);
      this.on('click', event => {
        this.fire('panel:action', { action: event.matchedTarget.dataset.action });
      }, false, '[data-action]');
    }
  }
);
```

```html
<page-panel>
  <h2>Account</h2>
  <button type="button" data-action="save">Save</button>
</page-panel>
```

`inline` makes `render()` preserve the existing markup and still invoke `onRendered()`. It is not another spelling for light DOM: root selection and template-replacement policy are separate decisions. Component connection can still load styles and attach behavior.

Use this pattern when the page already owns the markup and the component enhances it. Use a normal external-template render when the component should own the rendered descendants.

## Slots and supplied content

For a shadow component:

- Direct host children with `slot="name"` participate in that named slot.
- Unnamed eligible children participate in the default slot.
- Slot fallback content displays when that slot has no assigned content.
- The supplied node remains in the light tree; it is not returned as a descendant by querying the shadow root's slot element.
- Use native `slot.assignedNodes()`/`assignedElements()` to inspect assignments, and `slotchange` to observe changes in assignment when appropriate.
- Shadow-internal nodes and slotted page-owned nodes have different styling/query ownership.

```javascript
const slot = this.root.querySelector('slot[name="heading"]');
const headings = slot.assignedElements();
```

Appending through Cocoon's `append(node)` defaults to `root`. In shadow mode that adds an internal node, not a host child for projection. Use the host's native `appendChild(node)` when supplying a light-DOM child to a slot.

## CSS: isolation and intentional sharing

### Light DOM

The page can style rendered descendants directly. Component styles do not create a boundary around them. Use deliberate selectors and namespaces to avoid affecting unrelated page content.

On the current light-root path, Cocoon installs a `<style>` in the document head using the component class namespace. Conventional `:host` rules are rewritten toward the class assigned to the host. This is host-selector rewriting, not a general selector-scoping compiler.

**Current implementation limit:** this path skips a later sheet when a style with the same class namespace is already installed. Browser checks show a conventional index.css can therefore prevent that class's subsequent css() sheet from being installed. Intended multi-sheet behavior is awaiting owner clarification; the shadow-root cascade sequence must not be promised unchanged for light DOM.

### Shadow DOM

Selectors in ordinary document CSS do not directly match nodes inside the root. Shadow-root styles apply there; `:host` addresses the component host, and native shadow styling mechanisms such as `::slotted()` and exposed `part` names can provide deliberate styling surfaces.

Shadow DOM does not block ordinary inherited properties such as color/font or inheriting custom properties from flowing through the host. For example:

```css
/* Application/document stylesheet */
:root {
  --brand-color: rebeccapurple;
}
content-card {
  --card-padding: 1rem;
}
```

```css
/* Component stylesheet */
:host {
  display: block;
}
article {
  color: var(--brand-color);
  padding: var(--card-padding, .75rem);
}
```

This token inheritance does not require adopting the document sheet into every root. A shared `.button` or `.icon` selector, however, needs rules present in the relevant shadow scope to match internal markup.

### Adopt a shared design system

Publish the application's default sheet early through `data-adopted-stylesheet`, or additional design-system/icon sheets through Application `styles`. Components opt in:

```javascript
shouldAdoptDocumentStyleSheets() {
  return ['design-system.css', 'icons.css'];
}
```

The same sheet object can be shared across participating roots. Selective adoption keeps unrelated application rules out and provides a foundation before component-owned styles. It does not turn document-specific selectors into shadow-aware ones or automatically mirror removals/replacements.

See [styling](styling.md) for cascade, filtering, themes and font icons.

## Queries and boundaries

Use `this.root.querySelector()` when you explicitly want only the rendering root. Cocoon's `this.querySelector()` is broader: in shadow mode it searches the root first and can fall back to host light DOM when there is no match. The all-elements variant does not combine both result sets.

```javascript
const internalButton = this.root.querySelector('button');
const suppliedHeading = this.querySelector('[slot="heading"]');
```

A document query can find the host, then an open root can be queried explicitly:

```javascript
const card = document.querySelector('content-card');
const article = card.shadowRoot.querySelector('article');
```

Cocoon also supports deliberate traversal, for example `this.querySelector('content-card >>> article')`. Neither ordinary queries nor extended traversal grant access to closed roots or cross-origin iframe documents. Root-aware query fallbacks, asynchronous find behavior, and operator details are in [selectors and DOM](selectors-and-dom.md).

## Events crossing a shadow boundary

For an event emitted by an internal node, `bubbles` and `composed` serve different purposes:

- `bubbles` controls bubbling through ancestors.
- `composed` determines whether the event can cross the shadow boundary.
- Outside listeners may see the host as `event.target`, rather than the internal originating node.
- For an open root, `event.composedPath()` can include the internal nodes and explain the actual route.

```javascript
this.root.querySelector('button').dispatchEvent(new CustomEvent('card-action', {
  detail: { action: 'save' },
  bubbles: true,
  composed: true,
}));
```

This example uses a native event on an internal node. Cocoon's component `dispatchEvent()` defaults to the host/wrapped destination, and `fire()`/`broadcast()` dispatch directly on document. A document-wide Cocoon signal does not need to bubble out of a shadow root; it starts at document.

Cocoon delegated listeners set `event.matchedTarget` from the composed path. That can be more useful than retargeted `event.target`. An uncomposed internal event will not reach a host-only listener outside the root; choose the listener target deliberately. See [events](events.md) for exact routing.

## Declarative shadow DOM

The page can supply a shadow tree before the class upgrades:

```html
<content-card>
  <template shadowrootmode="open">
    <article><slot></slot></article>
  </template>
  <p>Supplied content</p>
</content-card>
```

Cocoon detects an existing root during initialization. With ordinary defaults, static declarative content can be retained instead of requesting an external template. Content containing template markers takes the parser path described in [templates](templates.md).

Important boundaries:

- Parser-created declarative shadow DOM is not equivalent to inserting a template string through every DOM API; the API used must support declarative shadow parsing.
- The supported examples use an open root. Do not infer complete closed-root support from the internals lookup alone.
- An `inShadow()` override cannot remove an already-created root. Avoid contradictory class policy and page markup.
- The current dynamic-declarative render branch precedes `declarative = false`; consult the documented branch matrix rather than assuming that flag always discards existing declarative markup.

## Rerendering and node ownership

A normal external-template rerender clears `root` and inserts a new fragment.

| Effect | Light root | Shadow root |
| --- | --- | --- |
| Rendered internal nodes | Replaced | Replaced |
| Direct listeners on replaced nodes | Remain on old nodes, not new ones | Same |
| Host's supplied light children | In the replaced root | Retained outside the replaced root |
| Slot elements | Ordinary elements are replaced | New slot elements reassign retained host children |
| Component instance | Retained | Retained |

This is not a virtual-DOM reconciliation operation. Cache references again when necessary, delegate on a stable root where suitable, and keep interaction state outside nodes that a rerender replaces.

## Picking a mode

Use shadow DOM when the component owns an internal view, projects supplied children, or benefits from deliberate style boundaries. Share tokens and selected design-system sheets rather than abandoning the boundary merely to reuse CSS.

Use light DOM when direct page styling, page-level selectors, or a native markup enhancement is the intended integration. Pair it with `inline` when retaining existing children matters.

Use [customized built-in elements](customized-built-in-elements.md) when preserving a particular native element type is the goal. The native tag determines which shadow operations are allowed; the span and button examples therefore use different modes.

These are composable choices, not feature tiers. A small component can expose a stable public API in either mode; the important step is making content, styling, and event ownership explicit.
