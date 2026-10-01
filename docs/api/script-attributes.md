# Kernel script attributes

Configure startup on the script that loads the Cocoon runtime. The example sets paths explicitly so page nesting does not silently change the application layout:

```html
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel
        data-rootpath="./"
        data-src-path="/src/"
        data-namespace="applications.MyApplication"
        data-controller="index.js"
        data-adopted-stylesheet="index.css"></script>
```

The following defaults are traced through the inspected runtime, not inferred from example values. The main table covers application-path attributes and sandbox discovery. Additional mapped controls are classified below so a configuration name is not mistaken for an implemented feature.

## Defaults and fallbacks

| Attribute | When omitted | When supplied | Important interaction |
| --- | --- | --- | --- |
| `src` | No runtime is loaded by an absent external script URL. | Browser resolves the runtime URL against the document base URL. | This is a native script attribute. Cocoon does not infer `node_modules/od-cocoon/framework.src.js`. |
| `data-kernel` | During normal synchronous script execution, `document.currentScript` still identifies the loading script. The fallback lookup searches the head for a kernel marker, a namespace-bearing data attribute, or a source containing `framework.src.js`. | Marks the kernel script for fallback lookup. Its value is not a class name or boolean switch. | Keep it in examples even though normal currentScript lookup can work without it. |
| `data-rootpath` | Raw default `../../../`. URL resolution normalizes this against the document base. | Project-root prefix; `./` means the page/base directory. | It is not automatically derived from the kernel script's `src`. Include a trailing slash for directory values, including project-root `.importmap` lookup. |
| `data-src-path` | `/src/`. | Source directory beneath the project root in controller, conventional stylesheet and discovery URL construction. | Use a consistent slash-delimited directory such as `/src/`. Several paths concatenate strings; arbitrary missing separators are not normalized uniformly. |
| `data-namespace` | No application namespace is configured by default; body `namespace` can supply one. With no resolved namespace, boot constructs the fallback Application. | Fully qualified application class used to resolve its controller and registry entry. | It does not import every component in that namespace. Explicit application imports own registration. |
| `data-controller` | Derived from the final page-path segment, or `index.html` for a trailing-slash URL; terminal `.html`/`.htm` becomes `.*js`, then the ordinary controller URL path removes `*`. | Controller filename appended under the resolved application namespace folder. | Without an application namespace, a filename alone does not select an application controller. |
| `data-adopted-stylesheet` | No early stylesheet request through this attribute path. There is no automatic `index.css` fallback here. | One stylesheet location, loaded during boot after import-map setup, adopted on the document and published for components. | Distinct from the application's later conventional own stylesheet. Matching filenames avoid the second own-sheet load. |
| `data-sandbox` | `components`. | Whitespace-separated discovery namespaces, or the exact string `false` to disable discovery. | Used by fallback Application, not automatically by explicit subclasses. It is not a browser security sandbox. |

Values generally remain attribute strings. The raw attribute getter distinguishes absent from empty; consumers then apply their own truthiness or string checks. Do not apply a universal boolean interpretation to all script attributes.

## Application namespace precedence

The ordinary intended setup declares `data-namespace` on the kernel script. Body `namespace` is also recognized.

The current bootloader's effective lookup first checks the first head `script[namespace]` if present, otherwise the body namespace, then falls back to the attribute-backed namespace value. That final value itself prefers a truthy kernel `data-namespace`, then body namespace, then its stored default.

Thus a nonempty body namespace can take precedence over the kernel attribute in the ordinary no-legacy-head-script path. An empty legacy head-script namespace also changes which branch checks the body. Avoid conflicting declarations: use the kernel attribute consistently rather than relying on these compatibility branches.

No namespace means fallback Application; an explicit namespace whose controller import fails is not silently replaced with fallback discovery. The controller must register the selected namespace. Current boot waits/retries registry lookup after import when the entry is absent; it does not guess a different class.

## Controller filename examples

With namespace `applications.MyApplication`, root `./`, and source `/src/`:

| Page path | Omitted controller, ordinary build | Explicit `data-controller="index.js"` |
| --- | --- | --- |
| `/demo/index.html` | `/demo/src/applications/MyApplication/index.js` | Same |
| `/demo/dashboard.html` | `/demo/src/applications/MyApplication/dashboard.js` | `/demo/src/applications/MyApplication/index.js` |
| `/demo/` | `/demo/src/applications/MyApplication/index.js` | Same |

The filename derivation uses the URL pathname, not query-string parameters. An extensionless pathname is not automatically rewritten to `index.js`; specify the controller rather than assuming directory routing conventions.

The wildcard derivation also participates in compressed-build selection elsewhere in boot. These examples use the ordinary uncompressed selection. Do not treat the wildcard spelling as a filename developers must create.

## Early stylesheet paths

Assume project root `/demo/`, page `/demo/index.html`, source `/src/`, namespace `applications.MyApplication`:

| Attribute value | Early stylesheet URL path |
| --- | --- |
| `index.css` | `/demo/src/applications/MyApplication/index.css` |
| `themes/dark.css` | `/demo/src/applications/MyApplication/themes/dark.css` |
| `./index.css` | `/demo/index.css` |
| `../shared.css` | `/shared.css` |
| `/assets/app.css` | `/assets/app.css` |

This boot resolver distinguishes leading `.` or `/` from namespace-relative values. It does not use precisely the same URL test as the component `styles` collection; do not assume every absolute-scheme spelling is handled identically across both APIs.

The attribute is **singular**, `data-adopted-stylesheet`, and accepts one location. An empty value does not request a sheet; the string `false` is a truthy filename, not a disable switch. Additional sheets belong in application `styles`.

For `data-controller="index.js"`, using `data-adopted-stylesheet="index.css"` also tells the Application to skip its later conventional own-sheet request. This is a literal filename comparison: a different spelling of the same resolved URL is not guaranteed to suppress the second load.

See [early stylesheet adoption](application.md#early-boot-stylesheet-data-adopted-stylesheet) for publication, replay, and why early loading is not a first-paint guarantee.

## Sandbox values

```html
<!-- Default when the attribute is absent: -->
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel data-rootpath="./" data-sandbox="components"></script>
```

```html
<!-- Search candidate namespaces in this order: -->
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel data-rootpath="./"
        data-sandbox="examples.widgets components"></script>
```

```html
<!-- Disable fallback discovery: -->
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel data-rootpath="./" data-sandbox="false"></script>
```

Namespace names are separated by whitespace, not commas. Dots within a namespace become directory separators. A bare `data-sandbox`/empty value is falsy and also prevents loader construction, but explicit `false` communicates the intention clearly. `true` is not “use defaults”: it is a namespace string. Use exact lowercase `false`, not a case-insensitive boolean convention.

The Application class captures the sandbox setting when its static initialization runs. Changing the attribute afterward does not reconfigure that existing loader. See [component autodiscovery](component-autodiscovery.md) for its complete search, observation, caching and error behavior.

## Additional boot controls

These controls are traced through the active `kernel.js` imports, the attribute reader, and their consumers. A mapping alone does not prove that the current bootloader implements a feature.

| Attribute | Omitted | Supplied / current behavior | Recommendation |
| --- | --- | --- | --- |
| `data-dynamicload` | Enabled (`true`). | Truthiness controls controller URL creation. Empty string disables that path; `"false"` remains truthy. With no controller path, boot constructs fallback Application. | Leave enabled for an explicit controller. Do not use the string `false` as a boolean switch. |
| `data-import-maps` | Enabled (`true`). | Empty string skips Cocoon's map initialization. `"false"` does not. This does not remove the browser's native import-map capability. | Supply an inline map or `.importmap`; avoid disabling setup in ordinary examples. |
| `data-use-compressed-build` | Unset/falsy. | A truthy value replaces the derived filename's `*` with `src.` or `min.` according to debug truthiness. `"false"` also enables this branch. An explicit `index.js` has no wildcard to replace. | Keep an explicit controller filename until your build layout needs this selection. |
| `data-debug` | Enabled (`true`). | Truthy values enable readiness logging and select `src.` in wildcard build selection. Empty string is falsy; `"false"` is still truthy. | Do not treat this as a universal production-mode switch. |
| `data-frame-role` | Legacy `iframe#mainFrame` detection supplies the shell fallback. | Read from the kernel script first, then the document element. Case-insensitive `shell` suppresses the page-readiness observer. Other nonempty values do not select shell. | Use only when deliberately assigning shell ownership; see [page readiness](page-readiness.md). |
| `data-enable-splash` | No default supplied in the active attribute configuration. | Mapped, but no consumer was found in the active kernel source graph. | Do not advertise a working splash switch. |
| `data-splash-timeout` | No default supplied. | Mapped, but no consumer in the active kernel source graph. | Do not use it to configure readiness deadlines. |
| `data-critical-resources` | No default supplied. | Mapped, but no consumer in the active kernel source graph. | Do not promise critical-resource waiting through this attribute. |

For example, the derived `index.*js` becomes `index.js` without compressed selection, `index.src.js` with compressed selection and truthy debug, or `index.min.js` with compressed selection and falsy debug. These are filename choices, not a build process: Cocoon does not generate those files at boot.

The splash attributes have consumers in an older aggregate file, but that file is not the active kernel entry. Their presence there must not be carried into current public promises. Boolean-string parsing remains a tracked configuration design issue; the defaults and truthiness above describe current behavior, not a recommended new convention.
