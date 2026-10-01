# Templates and rendering

Cocoon's template language supports multiline JavaScript blocks, conditional sections, loops, nested template literals, component helpers, and awaited results. Start with the [template syntax reference and complete country-picker example](template-syntax.md) for authoring patterns.

This page covers the rendering contract: a component's template provider, the presence of declarative shadow markup, and `static inline` jointly determine what renders. A missing file does not trigger an automatic parent-template fallback.

## Default provider and asset path

At registration, Cocoon installs an **own** `html` property on a class prototype that does not already declare one. It uses that prototype's own `template` declaration when present; otherwise it generates a provider for:

```text
<project-root>/<source-folder>/<qualified/class/path>/<skin-path>index.html
```

The project root and source folder come from the kernel script's `data-rootpath` and `data-src-path` attributes. The qualified class name replaces dots with slashes. A truthy named skin adds `skins/<name>/`.

This generated provider is installed per class. A subclass without an own `html()` normally gets its own conventional file even when a parent has an `html()` method.

## `html()` and explicit inheritance

```javascript
namespace `ui` (
  class MessageCard extends Component {
    html() {
      return `
        <template>
          <p><%= this.message %></p>
        </template>
      `;
    }
  }
);

namespace `ui` (
  class CompactMessageCard extends ui.MessageCard {
    html() {
      return super.html();
    }
  }
);
```

The explicit override retains the parent provider. Without it, Cocoon looks for `src/ui/CompactMessageCard/index.html`. A failed request for that file rejects; Cocoon does not then probe the parent's directory.

An `html()` method may return markup or a URL ending in `.html`, synchronously or through a promise. A prototype `template()` can also supply the provider, but examples use `html()` to make the intended extension point clear.

## Provider selection

`getTemplateToLoad()` selects in this order:

1. A truthy **own instance** `template` value.
2. A truthy `html` value, including the registration-generated provider.
3. `template` as a final fallback.

This is a truthiness chain, not a null-only check: an empty instance template does not override a truthy `html`. The conventional provider itself is generated using an own-property check at class registration.

## `loadTemplate(data = {})`

Loads and caches the template source; it does not insert the rendered result into the DOM.

1. Return the cached source when it is truthy.
2. Select the provider above.
3. If it is a function, set the data object's prototype to the component and await the function with `this` bound to that data object.
4. If the result ends in `.html`, fetch it. A non-successful HTTP status throws an error containing the status and URL.
5. If the result is an element, use its outer HTML; a non-template element is wrapped in `<template>…</template>`.
6. Cache and return the result.

Consequences:

- `html()` is not reevaluated on every `render()` once its truthy result is cached. Put changing values in template expressions, not only JavaScript interpolation inside the initial provider call.
- A URL query string after `.html` does not match the loader's terminal `.html` test. Do not assume arbitrary URL forms are fetched.
- An empty cached string is falsy and does not take the cache shortcut.
- The cache stores source, not a rendered DOM tree. Reusing the source can still produce new markup with new data.
- There is no documented public cache-invalidation method. Do not make guides depend on assigning internal cache fields.

## Template data context

```javascript
async onConnected() {
  await super.onConnected({ message: 'Welcome' });
}

html() {
  return `
    <template>
      <p><%= this.message %></p>
    </template>
  `;
}
```

The default parser evaluates with `this` bound to the data object. For ordinary data objects it sets the prototype to the component so component-defined methods and fields can be found through that chain. This **mutates the supplied object's prototype**. Use a mutable object intended for rendering, rather than a frozen object or an object whose original prototype must be preserved.

Data own properties take precedence over inherited component properties. Native element accessors are not equivalent to ordinary component fields: falling through to a native accessor with a plain data object as receiver can throw an illegal-invocation error. Supply required values explicitly instead of relying on native properties such as `title` being read through the data prototype.

## Default expression syntax

```html
<template>
  <h2><%= this.message %></h2>
  <ul>
    <%
      return this.items
        .map(item => `<li>${item}</li>`)
        .join('');
    %>
  </ul>
</template>
```

- `<%= expression %>` returns an expression's value.
- `<% … %>` executes a function body; return the string to insert. A block without a return can interpolate `undefined`.
- The parser selects its asynchronous evaluation path when the source contains the literal substring `await `; an expression can then await a promise.
- Template source is evaluated as JavaScript, using generated functions. Output is inserted as HTML, not automatically escaped text. Treat templates as trusted application code and explicitly handle untrusted values.
- The parser decodes HTML entities and removes an outer `<template>…</template>` wrapper when it matches its wrapper pattern.
- It builds a fragment through a template element, using `setHTMLUnsafe` when available and `innerHTML` otherwise. Declarative-shadow parsing behavior can depend on that browser capability.

## `render(data = this.data)`

Returns a promise that resolves without a result value after the selected render path. It obtains the template engine first, then uses the following branch order:

| Condition, in evaluation order | Behavior |
| --- | --- |
| Concrete class `inline` is truthy | Call `onRendered()` and return. Do not load or replace template content. |
| Existing declarative template **and** parsing markers are detected | Parse existing root/light content. Do not load the external provider in this branch. |
| No existing declarative template, **or** `hasOwnTemplate()` is true | Load the selected provider, parse it, clear `root`, append its fragment, then process light-DOM content when needed. |
| Existing declarative content, no markers, and no own-template request | Preserve markup and call `onRendered()`. |

`hasOwnTemplate()` means `this.constructor.declarative === false`; its name does not mean “an HTML file was found.”

**Branch interaction:** in the inspected runtime, declarative content containing parsing markers enters the second branch even when `static declarative = false`. Do not describe that flag as an unconditional external-template override. This precedence is covered by a browser probe and remains an implementation issue to reconcile with the intended contract.

### State and timing

```javascript
this.data = { message: 'Updated', items: [] };
await this.render();
```

Or render once with temporary data:

```javascript
await this.render({ message: 'Preview', items: [] });
// this.data still refers to its previous value.
```

- `render()` does not load the connection-time stylesheets or emit the base `connected` signal again.
- It calls `onRendered()` without awaiting a returned promise. A synchronous throw rejects rendering; asynchronous work started by the hook can outlive rendering.
- Replacing root contents replaces element identities and their direct listeners. Rebind through a suitable hook or use delegation on a stable root.
- Awaiting render does not guarantee that every nested custom element has completed its own asynchronous connection, nor that a browser paint has occurred.
- Changes to data do not automatically schedule rendering.

## Declarative content

Parser-created shadow markup can provide a template before the component upgrades:

```html
<ui-message-card>
  <template shadowrootmode="open">
    <p>Already supplied by the page</p>
    <slot></slot>
  </template>
  <span>Projected child</span>
</ui-message-card>
```

The ordinary default preserves static declarative content. Markers such as `<%=` cause parsing of existing content. Detection uses decoded text and checks both the candidate content and the root; the second light-DOM pass can therefore also be triggered by root markers. Rendering has no diff/reconciliation phase.

## Template engine selection

`getTemplateEngine()` reads the registered default engine. If the default is a constructor function, it creates a new engine; otherwise it returns the registered instance. There is no missing-engine fallback in this method. `render()` obtains it even before its inline early return, although inline rendering does not invoke parsing. The current default parser and its data semantics are described above; a custom engine must provide its own compatible parse result with a `fragment`.
