# Component

`Component` and `core.ui.HtmlComponent` expose the same component base. Extend either to define a native custom element with Cocoon template loading, stylesheet inheritance, lifecycle hooks, root-aware queries, and signals.

This reference describes the inspected runtime. Release attribution and the evidence behind edge cases are tracked separately in the discovery documents.

## Declaration and files

```javascript
namespace `ui.cards` (
  class ProfileCard extends Component {
    inShadow() {
      return true;
    }

    async onConnected(data) {
      await super.onConnected(data);
      this.nameOutput = this.querySelector('.name');
    }
  }
);
```

With the project root and source folder set through the kernel script attributes, the conventional files are:

```text
src/ui/cards/ProfileCard/
  index.js
  index.html
  index.css
```

```html
<template>
  <article>
    <span class="name">Guest</span>
    <slot></slot>
  </article>
</template>
```

Register/import the controller before relying on the element's component API. In an explicit application, imports are owned by the application; importing a superclass alone does not import every subclass.

## Tag names

### Generated name

Without an explicit tag, Cocoon derives the tag from the **fully qualified namespace and class name**. It inserts hyphens at uppercase/digit boundaries, replaces namespace dots with hyphens, and lowercases the result.

| Declaration | Generated tag |
| --- | --- |
| namespace `components`, class `HelloWorld` | `<components-hello-world>` |
| namespace `ui.cards`, class `ProfileCard` | `<ui-cards-profile-card>` |
| namespace `examples.team`, class `AdminCard` | `<examples-team-admin-card>` |

The tag is not just the class name. The class remains available as, for example, `ui.cards.ProfileCard`.

### Explicit name: `static tag`

```javascript
namespace `ui.cards` (
  class ProfileCard extends Component {
    static tag = 'profile-card';
  }
);
```

Use `<profile-card>` for this declaration. The asset directory remains `src/ui/cards/ProfileCard/`; changing the tag does not rename the namespace or move its files.

Tag selection checks whether the concrete class **owns** the static declaration. A subclass without its own `static tag` gets its own fully qualified generated tag rather than reusing its parent's explicit tag. This differs from normally inherited flags such as `lazy`, `inline`, and `csstext`.

Use a valid hyphenated custom-element name. If the computed tag already exists in `customElements`, Cocoon returns without replacing that registration. Changing a static tag after registration does not rename existing elements.

For a complete comparison of content ownership, slots, CSS, tokens, queries, and event boundaries, see [light DOM and shadow DOM](light-and-shadow-dom.md).

## `inShadow()`

Controls whether initialization uses a shadow root. It is a method, not a static flag.

```javascript
inShadow() {
  return true;
}  // request shadow DOM
```

```javascript
inShadow() {
  return false;
} // use light DOM for a normal component
```

When no override is provided, the base implementation checks `this.internals?.shadowRoot`, then `this.shadowRoot`, and otherwise returns `false`. It can return a shadow-root object rather than the literal boolean `true`; test truthiness.

### Initialization choices

| Situation | Root selection |
| --- | --- |
| Normal component, no existing shadow root, base behavior | Host element itself. |
| Normal component, `inShadow()` returns true | Attach element internals, reuse an available internal shadow root or attach an open shadow root. |
| Existing declarative shadow root | Reuse it; template rendering then follows the declarative branch. |
| Wrapped element or an inline/customized element | Start from the supplied element or host; attach/reuse a shadow root if requested, except for a supplied body element. |

For a newly created shadow root without a detected declarative template, initialization inserts `<slot></slot>`. This is temporary starter content; an external template render later replaces the root. Include `<slot>` in your own template when you want light-DOM children projected into it.

Choose shadow behavior before construction. Changing what `inShadow()` returns later does not migrate markup, detach a root, or rebuild the stylesheet environment. Because initialization calls the method from the base constructor, do not make it depend on subclass instance fields that have not initialized yet.

### Effects beyond encapsulation

- `root` points to the shadow root for rendering and explicit root operations.
- Root-aware queries first search the shadow root and may fall back to host light DOM; they are not strict shadow-only queries. See [selectors and DOM](selectors-and-dom.md).
- Shadow styles keep `:host` selectors. Light-DOM component styles use class-based host rewriting on the supported paths. See [styling](styling.md).
- Existing declarative roots participate in template selection independently of a class's conventional `index.html`.
- The base constructor captures declarative-template presence at initialization; later insertion of a template tag is not equivalent to parser-created declarative shadow DOM.

## Static options and inheritance

| Option | Default and inheritance | Effect and limits |
| --- | --- | --- |
| `tag` | Absent; own-class declaration only | Overrides the generated tag. Does not change asset paths. |
| `declarative` | `true`; inherited | Existing declarative markup is normally preserved/parsed. Only the literal boolean `false` makes `hasOwnTemplate()` return true. See rendering branch precedence in [templates](templates.md). |
| `lazy` | Unset/falsy; inherited | Delays `onConnected` until an intersection event. Does not defer class evaluation, registration, or construction. |
| `inline` | Unset/falsy on Component; inherited | `render()` skips content replacement and still calls `onRendered`. Does not independently mean “disable shadow DOM.” |
| `skin` | `undefined`; inherited | Default assets, named skin assets, or suppression. See the skin matrix below and [styling](styling.md). |
| `csstext` | `true`; inherited | The concrete class's value enables/disables collection of prototype `css()` methods across the visited ancestry. It does not disable external or additional stylesheets. |
| `extends` | Unset; inherited | Passed as the native registration `extends` option for customized built-ins. Requires a compatible element declaration/browser; it is not component-class inheritance. See [customized built-in elements](customized-built-in-elements.md). |

Set boolean class options with JavaScript booleans. Strings such as `'false'` are truthy and do not turn off truthiness-based options.

### `skin`, `getSkin()`, and `hasOwnSkin()`

`Class.getSkin()` returns `{ name, path }`; the instance `getSkin()` delegates to the concrete class.

| Effective `skin` | `path` | Base `hasOwnSkin()` result |
| --- | --- | --- |
| `undefined` | `''` | `true` |
| `'dark'` | `'skins/dark/'` | `'dark'` (truthy, not a boolean) |
| `null`, `false`, `''`, or `0` | `''` | Falsy |

`static skin = null` is an intentional skinning feature: opt out of the component's own conventional stylesheet while using inherited or explicitly supplied styles. See the [skinning example](styling.md#skinning-without-an-own-default-stylesheet-static-skin--null). It does not itself select the parent template.

A named skin affects the conventional **HTML and CSS** paths. Explicit template providers and explicit `styles` entries have their own resolution rules.

For the concrete class, a falsy `hasOwnSkin()` skips the entire ancestral-style iteration for that class—including its inline `css()`. It does not suppress explicit `styles`, document-sheet adoption, or automatically suppress an eligible parent's stylesheet. An inherited `skin = null` also applies to subclasses unless overridden.

Overriding `hasOwnSkin()` changes this decision, but keep it safe when invoked on an ancestor prototype; do not assume a fully initialized instance in every call.

## Instance data and roots

| Member | Contract |
| --- | --- |
| `root` | Root used by rendering and root-aware utilities. Usually the host, a shadow root, or the wrapped document for an application. |
| `element` | Supplied wrapped element/document, when present. Not automatically a synonym for `root` or `this`. |
| `options` | Supplied truthy options value, otherwise the component instance itself. |
| `data` | Assigned by base `onConnected(data = {})`. An explicit `render(otherData)` does not save `otherData` here. |
| `namespace` | Fully qualified component class name supplied during registration. |
| `styles` | Defaults to `null`. An instance iterable of additional stylesheet inputs, collected at connection. |
| `stylesheets` | Per-instance collection with Cocoon's special `.add()` insertion behavior. |
| `lazy` | Instance field initialized from presence of the `lazy` attribute. Combined with the class flag using OR. |

Normal custom-element attachment does not supply application data to `connectedCallback`; a component needing fetched or calculated template data can pass it to `super.onConnected(data)` from its override.

Do not use `new Component()` as a substitute for registering a concrete custom element. Native custom-element construction requirements still apply. Wrapped-element construction is used by application boot; it can begin connection work during the superclass constructor, before derived fields are initialized.

## Component API by responsibility

- [Lifecycle](lifecycle.md): connection, lazy activation, rendering hooks, disconnection, timing and cleanup.
- [Template syntax](template-syntax.md): complete JavaScript blocks, conditional markup, nested loops, asynchronous helpers, and a full component example.
- [Customized built-in elements](customized-built-in-elements.md): extend native spans/buttons using the HTML `is` attribute.
- [Templates](templates.md): provider precedence, caching, data context, inheritance, declarative branches and rerendering.
- [Styling](styling.md): skins, `css()`, URL resolution, cascade order, runtime insertion and document sharing.
- [Selectors and DOM](selectors-and-dom.md): immediate queries, waits, shadow/iframe traversal, append, attributes and measurements.
- [Events](events.md): delegation, local dispatch, document signals, replay and unsubscription.
- [Watching inputs](watching-inputs.md): event-backed observation and cleanup.

Application-defined base classes are not additional Cocoon APIs. The reference uses `Component` directly so framework behavior is not confused with project-specific extensions.
