# Component autodiscovery

Cocoon's fallback Application can discover undefined custom-element tags and import their controllers through `ComponentLoader`. This is useful for small standalone examples and sandbox pages without an explicit application controller.

It is separate from the explicit application's import-map-driven component imports.

## Minimal discovery example

```html
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel data-rootpath="./"></script>
<hello-world></hello-world>
```

The default discovery namespace is `components`. Provide `src/components/HelloWorld/index.js`:

```javascript
namespace `components` (
  class HelloWorld extends Component {
    static tag = 'hello-world';
  }
);
```

And conventional `index.html`/`index.css` alongside it. Serve the project over HTTP; the server must support the loader's HEAD probes. Normal import-map initialization also runs during boot, so provide a valid `.importmap` or inline import map for the example environment.

The explicit tag here is important: ordinary registration without `static tag` generates `<components-hello-world>`. Discovery converts the entire encountered tag to a candidate class-folder name; it does not reverse-decode an arbitrary fully qualified tag into a namespace/class pair.

## When discovery starts

Application creates its shared loader from the initial `data-sandbox` value. Its `onConnected()` starts discovery **only when the instance constructor is exactly Application**.

| Boot scenario | Autodiscovery |
| --- | --- |
| No resolved application namespace; sandbox omitted | Fallback Application scans `components`. |
| No resolved application namespace; sandbox lists names | Fallback Application searches those names in order. |
| No resolved application namespace; `data-sandbox="false"` | No loader starts. |
| Explicit Application subclass selected | No automatic fallback scan; the controller owns its imports. |
| Explicit application import fails | Not a signal to switch to fallback discovery. |

Do not add a second manual ComponentLoader merely to compensate for missing imports in an explicit application. The class is described here to explain the framework's automatic behavior, not as a new application-owned lifecycle service.

## Tag-to-module resolution

For `<hello-world>`:

1. Skip it if already registered in `customElements`.
2. Split on `-`, uppercase the first character of each segment, and concatenate: `HelloWorld`.
3. Construct a candidate for each configured namespace:

```text
<project-root>/<source-folder>/<namespace/path>/HelloWorld/index.js
```

4. Send HEAD requests sequentially in namespace order.
5. On the first successful HTTP response, import that URL as a module.
6. Verify that the module registered the **original encountered tag**, `<hello-world>`.

For `data-sandbox="examples.widgets components"`, candidates are:

```text
src/examples/widgets/HelloWorld/index.js
src/components/HelloWorld/index.js
```

This is convention-based lookup, not a scan of every JavaScript file. The filename is fixed at `index.js`; `data-controller` selects the application controller and does not change the discovered component filename. Lookup does not ask the import map to translate `components.HelloWorld`, although imports inside a discovered module may still use that map.

A folder whose class registers a different tag is not a match merely because it returned HTTP 200. Use the explicit encountered tag or deliberately arrange a matching naming convention.

## Search fallback and failure

| Result | Behavior |
| --- | --- |
| HEAD success | Choose this candidate and stop searching. |
| HEAD 404 | Try the next namespace. |
| Other non-success status, such as 403 or 500 | Throw; do not continue to the next namespace. |
| Network failure | Reject the load; do not silently skip to the next namespace. |
| All candidates return 404 | Resolve without importing or registering the tag. |
| Chosen module imports but does not register the tag | Report an error; no second-namespace fallback. |
| Chosen module import/evaluation fails | Report an error; no second-namespace fallback. |

A server returning an HTML application shell for every unknown URL can make a missing module appear successful to the HEAD probe, then fail during module import. Discovery requires meaningful status codes and actual JavaScript responses.

Each module attempt emits component-import activity start/end around its work; end is sent in a finally block. End does not by itself mean registration succeeded.

## Initial and dynamic scans

The loader scans the supplied root itself and its descendants matching `:not(:defined)`. It collects hyphenated, unregistered tag names into a Set so repeated instances of one tag share the scan's load request.

It installs a `MutationObserver` for child additions throughout each observed root. New subtrees are scanned, including their descendants; applications can therefore append tags after initial boot.

Native document queries do not traverse shadow boundaries. To follow Cocoon-created roots, the loader listens for component render-activity start and observes the reported component's `root`. This lets it discover children that a Cocoon component renders inside its shadow root.

This is not unconditional surveillance of every shadow tree on the page. Arbitrary third-party roots or roots created without the framework's observed activity path may not be discovered. It observes child-node changes, not every attribute mutation or shadow attachment.

The same root is observed only once per loader, using a WeakSet. The inspected class exposes no stop/disconnect method and does not retain its observers as public cleanup handles. Its intended ownership is the page's fallback Application.

## Caching and retries

The loader stores the load promise by tag name. Concurrent requests for the same tag reuse it, and later scans do not automatically create another attempt.

That cache includes successful work, rejected attempts, and the all-404 result. Adding another instance after fixing a server-side missing file does not force a retry in the same loader. Reload the sandbox to start a fresh page/loader; there is no documented public retry/cache-reset API.

Once the tag is registered, the existing custom-element definition takes precedence. The loader does not hot-replace registrations or import a different implementation for later instances.

## What completion means

A scan returns `Promise.allSettled()` for the tags found in that scan. One failed tag does not reject the whole initial scan. The fallback application can continue connecting even when some elements remain undefined.

Completion of a scan is not a promise that all recursively discovered descendants have finished rendering. Dynamic mutation callbacks and component activity can trigger later scans; module registration and a component's asynchronous lifecycle are separate stages.

Use explicit application imports and intentional readiness signals when a larger application's setup depends on known component ownership and completion.
