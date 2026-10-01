# Customized built-in elements

Cocoon supports augmenting native HTML elements as well as declaring autonomous custom-component tags. A customized built-in keeps its native element type and adds Cocoon component behavior.

| Form | Example | Base |
| --- | --- | --- |
| Autonomous custom component | `<profile-card>` | `Component` |
| Customized built-in | `<span is="message-span">` | `HTMLSpanElement.with(IHtmlComponent)` |
| Customized native button | `<button is="action-button">` | `HTMLButtonElement.with(IHtmlComponent)` |

`is` is the **native HTML attribute** used for customized built-ins. It is distinct from the compatibility static class alias omitted from this reference. Use `static tag` for the registration name.

## Span with a Cocoon template

```javascript
namespace `ui.components` (
  class MessageSpan extends HTMLSpanElement.with(IHtmlComponent) {
    static tag = 'message-span';
    static extends = 'span';

    inShadow() {
      return true;
    }

    async onConnected(data) {
      await super.onConnected(data);
      this.on('click', event => this.onClick(event));
    }

    onClick(event) {
      console.log('Message span clicked', event);
    }
  }
);
```

`src/ui/components/MessageSpan/index.html`:

```html
<template>
  <strong>Message:</strong>
  <slot></slot>
</template>
```

`src/ui/components/MessageSpan/index.css`:

```css
:host {
  display: inline-block;
  padding: .5rem;
}
```

After importing its controller, use:

```html
<span is="message-span">Content supplied by the page</span>
```

The result remains an `HTMLSpanElement`. Its shadow template projects the page-supplied text through a slot, while Cocoon supplies lifecycle, templates, queries, and events.

A span remains a span semantically: attaching a click handler does not give it a native button's keyboard, form, or accessibility behavior. Use an actual button base when those behaviors are required.

## How the declaration works

1. `HTMLSpanElement.with(IHtmlComponent)` creates a subclass of the native span and mixes in Cocoon component methods and static registration support.
2. Namespace registration invokes the component definition path.
3. `static tag` supplies the custom-element registration name.
4. `static extends = 'span'` passes the native built-in name to `customElements.define`.
5. The browser associates `<span is="message-span">` with that definition.

The native superclass and `static extends` must describe the same element kind. `static extends` is not a replacement for JavaScript `extends`, and setting it on a regular Component subclass alone does not supply the native built-in prototype chain.

The current native-element mixin constructor calls `initialize()` for you. The older Arc2D CustomButton example also calls it manually; **do not copy that extra initialization into new components using this runtime**. In particular, a second shadow initialization can attempt to attach a second root.

The mixin copies property descriptors/methods and static members; it does not execute the IHtmlComponent constructor or copy every instance field initializer. Features depending on such fields must be checked for this construction path. For example, use the class-level `static lazy` setting rather than assuming the ordinary Component's instance-field initialization from a `lazy` attribute ran.

## Native button with preserved markup

```javascript
namespace `ui.controls` (
  class ActionButton extends HTMLButtonElement.with(IHtmlComponent) {
    static tag = 'action-button';
    static extends = 'button';
    static inline = true;
    static skin = null;

    async onConnected(data) {
      await super.onConnected(data);
      this.on('click', () => this.fire('action:requested', {
        action: this.dataset.action,
      }));
    }
  }
);
```

```html
<button is="action-button" type="button" data-action="save">Save</button>
```

`inline = true` preserves the page's button content without loading a template. `skin = null` opts out of the class's own default stylesheet; application/shared styles can style the light-DOM button.

The element retains native button properties and behavior such as `disabled`. Shadow-root support depends on the underlying native element; do not copy `inShadow() { return true; }` from the span example onto every built-in element. A native button is not an eligible ordinary shadow host. The span example and button example deliberately use different root modes.

## Creating instances in JavaScript

```javascript
const message = document.createElement('span', { is: 'message-span' });
message.textContent = 'Created programmatically';
document.body.appendChild(message);
```

Use the native tag plus the creation-time `is` option. These are not equivalent:

```javascript
document.createElement('message-span'); // autonomous-tag spelling

const ordinarySpan = document.createElement('span');
ordinarySpan.setAttribute('is', 'message-span'); // does not retrofit the native creation option
```

Likewise, `<message-span>` is not the markup for the customized span definition. Use the registered hyphenated lowercase name exactly; `is="CustomThing"` is conceptual shorthand, not a valid example registration name to copy.

## Imports and discovery

Import the controller explicitly through the application's imports/import map. The current fallback ComponentLoader looks for hyphenated local tag names. A customized span's local name is `span`; the loader does not turn its `is` attribute into a discovery request.

A definition may upgrade compatible parsed elements when registered, subject to native browser rules. Do not rely on sandbox discovery to perform that registration for you.

## Styles, lifecycle, and browser coverage

Eligible customized built-ins use Cocoon's existing component stylesheet/template/lifecycle paths, with their actual native root constraints. `shouldAdoptDocumentStyleSheets()` can share published rules into an eligible shadow root just as in the span example. There is no separate automatic conversion of document styles or native semantics.

The examples were exercised against the actual Cocoon runtime in Chrome: parsed and programmatic customized spans, shadow markup, click handling, and an inline native button preserving its disabled state and label.

Customized built-ins are not supported in every browser; Safari does not currently support this native mechanism. Do not promise autonomous-component portability for an `is`-based component or imply Cocoon supplies a polyfill. See [MDN custom elements](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements) and [WebKit's tracked support issue](https://bugs.webkit.org/show_bug.cgi?id=195403). Native shadow-host restrictions are listed in [attachShadow documentation](https://developer.mozilla.org/en-US/docs/Web/API/Element/attachShadow).
