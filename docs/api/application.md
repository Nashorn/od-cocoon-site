# Application

`Application` provides document-level ownership on top of the component API. A controller imported by the bootloader is constructed with `document`; its root is the document, while its internal namespace/classes are assigned to the body.

Configure application startup with **kernel script attributes**. This reference does not use the deprecated object-based configuration interface.

## Explicit application layout

```text
index.html
.importmap
src/
  applications/MyApplication/index.js
  applications/MyApplication/index.css
  components/Greeting/index.js
  components/Greeting/index.html
  components/Greeting/index.css
```

`.importmap`:

```json
{
  "imports": {
    "components.Greeting": "./src/components/Greeting/index.js"
  }
}
```

`src/applications/MyApplication/index.js`:

```javascript
import 'components.Greeting';

namespace `applications` (
  class MyApplication extends Application {
    async onConnected(data) {
      await super.onConnected(data);
      this.greeting = this.querySelector('components-greeting');
    }
  }
);
```

If Greeting declares its own `static tag`, use that tag instead of the generated `<components-greeting>`.

`index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <script src="node_modules/od-cocoon/framework.src.js"
            data-kernel
            data-rootpath="./"
            data-src-path="/src/"
            data-namespace="applications.MyApplication"
            data-controller="index.js"
            data-adopted-stylesheet="index.css"></script>
  </head>
  <body>
    <components-greeting></components-greeting>
  </body>
</html>
```

`src/components/Greeting/index.js`:

```javascript
namespace `components` (
  class Greeting extends Component {
    inShadow() {
      return true;
    }
  }
);
```

`src/components/Greeting/index.html`:

```html
<template>
  <h1>Hello, Cocoon.</h1>
  <p>Your application is connected.</p>
</template>
```

`src/components/Greeting/index.css`:

```css
:host {
  display: block;
  padding: 2rem;
  border: 1px solid #34435b;
  border-radius: 1rem;
}
h1 {
  color: #5fe9bd;
}
```

`src/applications/MyApplication/index.css`:

```css
:root {
  color-scheme: dark;
  font-family: system-ui, sans-serif;
}
body {
  max-width: 48rem;
  margin: 3rem auto;
  padding: 0 1rem;
  background: #070c15;
  color: #eef2fa;
}
```

With Cocoon installed at `node_modules/od-cocoon/framework.src.js`, serve the project over HTTP (`npx http-server . -p 8080 -c-1`) and open `http://localhost:8080`. You should see a bordered greeting panel. The application imports the controller, namespace registration defines `<components-greeting>`, and the component loads its HTML/CSS from its own folder.

The application owns document startup and global styles; the component owns the panel. The import map is the explicit connection between a module name and its file. See [documentation compatibility](../compatibility.md) before selecting a runtime: the draft baseline is not yet attributed to a verified public release.

## Startup attributes used here

| Attribute | Meaning, default, and fallback |
| --- | --- |
| `data-kernel` | Marks the runtime script for lookup. It does not name an application class. |
| `data-rootpath` | Project root relative to the page/base URL. Set `./` explicitly for this layout. The inspected runtime's raw fallback is `../../../`, so omission is not universally equivalent to the page folder. |
| `data-src-path` | Source folder. Defaults to `/src/`; controller URL construction removes its leading slash before resolving under the project root. |
| `data-namespace` | Fully qualified application class, used for controller lookup and registry construction. If omitted, a body `namespace` can supply it. Use one consistent declaration. |
| `data-controller` | Controller filename under the namespace folder. Without an explicit filename the runtime derives a wildcard JS name from the page filename; set `index.js` when using this layout. |
| `data-adopted-stylesheet` | Application sheet to load at document level. No sheet is requested by this attribute path when it is absent/falsy. A bare filename is namespace-relative; `./`, `../`, and `/` prefixes use the page/base URL. |
| `data-sandbox` | Fallback discovery namespaces, default `components`. The literal string `false` disables that fallback loader. It does not unload components explicitly imported by your controller. |

See [script attribute defaults and fallbacks](script-attributes.md) for the detailed resolution rules and [component autodiscovery](component-autodiscovery.md) for sandbox behavior. This table is the application setup subset, not a complete boot-attribute reference. Attributes arrive as strings; do not infer that every `data-…="false"` value is universally coerced to a boolean. Each consumer must be checked before its disable semantics are documented.

## Controller and import ownership

Boot waits for import-map initialization before importing the controller. The controller path combines the project root, source folder, namespace converted to a directory path, and controller filename. Import-map entries resolve the controller's bare component imports; they are not inferred from every component tag in an explicit application.

A nonempty inline `<script type="importmap">` is used when present; otherwise the runtime attempts the project-root `.importmap`. Keep the map available before application imports start.

In the ordinary setup, put `data-namespace` on the kernel script. The current bootloader also recognizes body namespace and an older head-script namespace form, which can affect precedence if mixed. New examples do not mix those declarations.

## Construction and inherited behavior

- Construction stores the instance in `window.application`.
- `static inline = true` is inherited from Application. Its render hook preserves the page's existing content rather than loading/replacing an application HTML template.
- The document is the root for application queries, listeners, and adopted stylesheets in normal boot construction.
- Component-style internal classes and namespace metadata are written to the body.
- The wrapped-document construction path starts connection from base initialization, so code before the first await in an override may run before application subclass fields finish initializing.

Do not equate a retained body element with the application object, or assume the application's native HTMLElement `isConnected` tells you whether the document is ready. Use explicit lifecycle ownership.

## `onConnected(data)`

The Application implementation:

1. For the exact fallback `Application` constructor, await the fallback component loader's `start(document)` when configured.
2. Await the component base connection pipeline.
3. Fire `application:connected` on document.

An explicit subclass does not enter step 1. Its imports own component registration.

```javascript
async onConnected(data) {
  await super.onConnected(data);
  await this.loadInitialData();
  this.fire('my-app:ready');
}
```

Here `application:connected` fires **before** `loadInitialData` finishes. Use an application-specific signal if consumers must wait for your own extra setup. The base signal does not await every nested component or every request started by application code.

## Early boot stylesheet: `data-adopted-stylesheet`

The recommended way to supply the application's default stylesheet is the **singular** script attribute:

```html
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel
        data-rootpath="./"
        data-src-path="/src/"
        data-namespace="applications.MyApplication"
        data-controller="index.js"
        data-adopted-stylesheet="index.css"></script>
```

This selects `src/applications/MyApplication/index.css` under the configured project root. It is one stylesheet location, not a plural attribute or a comma-separated list. Additional application sheets can use the application's `styles` collection.

### Why use the script attribute

The attribute makes the stylesheet location available while the kernel is executing. The bootloader starts this loading path after import-map initialization, independently of constructing and connecting the application. It can therefore apply the document's visual foundation before the application controller finishes loading, rather than waiting for application lifecycle code to request it.

The sequence is:

1. Read the attribute and initialize the import map.
2. Resolve the stylesheet URL and begin importing/loading the CSS.
3. Attach the resulting stylesheet to `document.adoptedStyleSheets` and record its resolved URL.
4. Publish `stylesheet:adopted` through Cocoon's replayable signal mechanism.
5. Opted-in components adopt that same stylesheet object, either immediately when announced or later through replay.

Controller preloading also waits for import-map initialization. Stylesheet loading and application startup can overlap: this mechanism is **early loading, not a guaranteed render-blocking barrier**. It does not promise that the sheet finishes before every component connects or before first paint. The publication/replay mechanism accommodates either component connection order.

### Sharing the application sheet with components

```javascript
shouldAdoptDocumentStyleSheets() {
  return '/applications/MyApplication/index.css';
}
```

A shadow component using this filter can apply shared classes from the application sheet without inserting a stylesheet link into its template. The sheet is placed before its component-owned styles. A URL-specific filter avoids accidentally accepting every unrelated `index.css`; `true` accepts every announced document sheet instead.

Write shared rules that match the component's internal markup. Adoption shares a sheet; it does not rewrite document-only selectors to work inside shadow roots. For a larger design system, the application default sheet can establish document tokens while separately published shared/icon sheets provide reusable component rules.

If the attribute is omitted, this early request path does not automatically infer `index.css`. The application's conventional connection-time stylesheet path is separate. Do not use `"false"` as a stylesheet filename to disable the attribute; omit it instead.

## Stylesheet ownership

The attribute-selected application sheet is adopted at document level and announced for component opt-in sharing. It does not automatically enter all shadow roots.

The application's conventional own stylesheet filename derives from the controller:

| Controller | Conventional CSS filename |
| --- | --- |
| `index.js` | `index.css` |
| `index.src.js` | `index.css` |
| `index.min.js` | `index.css` |
| `dashboard.js` | `dashboard.css` |

When the `data-adopted-stylesheet` value exactly equals that derived filename, the application skips a second own-sheet load through the ancestry path. The comparison is textual, not a canonical-URL equivalence test; `./index.css` and `index.css` do not take the same comparison branch.

Use `:root` and document selectors in application CSS. Child shadow components can selectively adopt announced sheets through `shouldAdoptDocumentStyleSheets()`; see [styling](styling.md).

## Application and simulation

Application defines update/draw forwarding hooks, but ordinary application boot does not itself install/start a simulation loop. `World` extends Application and participates in the loop setup path. The complete World scheduling/lifetime contract belongs in its own reference; defining a component update method alone is not a substitute for that ownership.
