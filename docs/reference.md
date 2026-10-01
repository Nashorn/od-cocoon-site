# Cocoon framework reference

Cocoon supplies application startup, native components, JavaScript templates, inherited styles, signals, and worker-based computation. The reference is being prepared for `/documentation/api`.

Links below open Markdown source while the dedicated documentation pages are being built. The Markdown pages are the authoritative authoring drafts. Their baseline is the intended arc-kernel source contract; [compatibility](compatibility.md) explains which runtime has been exercised and what still needs release verification. They are not a promise that every feature is available in the older installation release.

## Start with a working example

| Goal | Read |
| --- | --- |
| Build an application with a component | [Application](api/application.md) |
| Filter contacts as you type | [Watching inputs](api/watching-inputs.md) |
| Connect a product picker and basket summary | [Events and signals](api/events.md) |
| Write conditional, looping, and asynchronous templates | [Template syntax](api/template-syntax.md) |
| Animate a bouncing ball | [World](api/world.md) |
| Run computation in workers | [Threading](api/threading.md) |

## API by responsibility

| Area | Reference |
| --- | --- |
| Component declaration, generated tags, options | [Component](api/component.md) |
| Root ownership, slots, and boundaries | [Light DOM and shadow DOM](api/light-and-shadow-dom.md) |
| Construction, connection, rendering, cleanup | [Lifecycle](api/lifecycle.md) |
| Template providers, inheritance, caching, explicit rerendering | [Templates and rendering](api/templates.md) |
| Skins, CSS methods, extra sheets, shared application styles | [Styling](api/styling.md) |
| Registration, module imports, import maps | [Namespaces and imports](api/namespaces-and-imports.md) |
| Reusable behavior and composition limits | [Class composition](api/class-composition.md) |
| Native span/button enhancement | [Customized built-in elements](api/customized-built-in-elements.md) |
| Immediate queries, waiting, shadow/iframe traversal | [Selectors and DOM](api/selectors-and-dom.md) |
| Boot arguments, defaults, path resolution | [Script attributes](api/script-attributes.md) |
| Fallback sandbox registration | [Component autodiscovery](api/component-autodiscovery.md) |
| Startup completion notifications | [Page readiness](api/page-readiness.md) |

## Conventions used throughout

Extend `Component` or `core.ui.HtmlComponent`. Configure boot with script attributes. Declare an explicit tag with `static tag`; otherwise the namespace and class generate the tag. Select shadow rendering with `inShadow()` and preserve page-owned markup with `static inline = true` when appropriate.

Data assignment does not schedule a render. `watch()` observes input/change events rather than arbitrary property assignments. Signals currently replay every retained event; their subscribers must tolerate replay. These distinctions are explained with examples in the linked references.

Project-specific base classes and legacy storage APIs are not part of this public surface.
