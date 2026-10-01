# Cocoon API discovery

Inspected 2026-10-01. This is internal authoring evidence, not a public release contract.

## Baseline

See [source snapshot](source-snapshot.json) for hashes, commits, and dirty-source status. The site and DemoSample bundles both report `8.6.1.09202026`, but have different SHA-256 hashes. The vendor README describes an unmodified public 8.6.0 artifact. These labels do not establish release equivalence.

The framework checkout contains pre-existing modifications to kernel.js, World.js, bootloader.js, Thread.js, version.js, and untracked ThreadPool.js/test files. Discovery does not modify that checkout or regenerate artifacts.

## Active ownership

`kernel.js` imports `HtmlComponent.js`, which imports `IHtmlComponent.js`. The intended public component surface is `Component` and `core.ui.HtmlComponent`. Compatibility aliases are excluded from public teaching material. Do not derive current lifecycle contracts from the separate older `WebComponent.js`, or any `copy` files.

DemoSample's `BaseComponent`, runtime orchestration, and Electron bridge methods are application-specific. They are useful usage evidence, not framework exports.

## Coverage and evidence

Paths in this table are relative to the sibling `arc-kernel` checkout unless otherwise identified. Symbol names are the durable lookup keys; source hashes pin this inspection.

| Area | Owner and evidence | Status |
| --- | --- | --- |
| Component | `src/core/ui/HtmlComponent.js`; `IHtmlComponent.js` initialize, define, render, inShadow | Draft written; source reviewed |
| Application | `src/core/ui/Application.js`; README Application setup; site getting-started/examples/03-application.html | Draft written; source reviewed |
| Lifecycle | `IHtmlComponent.js` connectedCallback, onConnected, render, disconnectedCallback | Draft written; source reviewed |
| Events | `IHtmlComponent.js` dispatchEvent, subscribe, fire, broadcast, on | Draft written; source reviewed |
| Threading | `src/system/lang/Thread.js`, `ThreadPool.js`; site parallel/src/examples/raytracer | Draft written; source reviewed; release status unresolved |
| Namespaces/imports | `src/system/lang/Class.js`, bootloader.js; README Namespaces and Import Maps | Reference written; registration/import resolution traced; selected browser contracts verified |
| Templates | `IHtmlComponent.js`; system/drivers/templating/TemplateLiteralParser | Deep source trace; template inheritance, caching, data mutation and declarative branches browser-tested |
| Styling | `IHtmlComponent.js` defineAncestralStylesheets, loadStylesheets, adoptDocumentStyleSheets | Deep source trace; cascade order, inline collection, late addition and document adoption browser-tested |
| Configuration | `-appconfig.js`, bootloader.js | Application-path defaults and sandbox traced and tested; additional mapped controls classified by active consumers |
| Selectors | `src/core/ui/SelectorResolver.js` | Resolver traced; root fallback, partial timeout and mutation wake-up tested; iframe/multi-root edge matrix pending |
| World/simulation | `src/core/ui/World.js`, Application.js, bootloader MainLoop binding | Scheduling reference and complete bouncing-ball example written; Chrome verification recorded |
| Readiness | bootloader render observer; README Page render readiness | Observer reference written; source/bundle differences explicit; browser evidence recorded |
| Other kernel exports | kernel imports, repository/storage and prototype extensions | Storage/Collection/IStorageDriver excluded by owner; composition documented as public |

This is not yet an exhaustive API reference. A method's presence alone is not sufficient evidence that it is a supported extension point.

## Discrepancies to resolve

1. README `synchronous` claims blocking asset loads. The active IHtmlComponent template loader uses fetch; do not carry that claim into the reference without finding an active implementation.
2. README describes `inline` as a light-DOM mode. Active render returns early for inline classes; shadow selection is separately owned by inShadow/initialize.
3. README describes lazy instantiation and user-interaction activation. Active connectedCallback defers onConnected with IntersectionObserver; JavaScript registration/instantiation can already have occurred.
4. README tag defaults mention USES_NAMESPACE_FOR_TAGNAMES. Active define derives the default from proto.namespace and does not consult that flag in this method. Namespace registration and generated fully qualified tags have now been traced and browser-verified; reference corrected.
5. Signal replay stores every retained event object, not a latest-value cache. Document cleanup and replay side effects.
6. Base connected/application:connected signals precede subclass work following await super.onConnected(). Do not label these as universal application-ready barriers.
7. Same version string, different bundled bytes: select and confirm the public release before publishing installation promises, especially for threading.
8. Base disconnection does not visibly remove entries added to document.component2d_instances by onAwake. Review reconnection and simulation cleanup before recommending those hooks broadly.

## Next authoring pass

Import resolution, World, and page readiness have received the second pass. Additional boot controls are now classified by active consumers. Finish release matching. Component/template/style/selector contracts now have the deeper audit linked below. Build runnable examples for those contracts, resolve release attribution, then derive beginner guides. The website layout and generator migration come after these artifacts have been reviewed.

## Browser verification, 2026-10-01

Headless Chrome through local Playwright, against `http://127.0.0.1:8081/parallel/raytracer.html`:

- Confirmed `Component === core.ui.HtmlComponent` and `WebComponent === Component`.
- Fired values 1 and 2 before subscription, then 3 after subscription, unsubscribed, and fired 4. The observed sequence was `[1, 2, 3]`, confirming replay and listener removal.
- Ran the documented two-worker square example: `[9, 16]`; pool size became zero after termination.
- Ran the documented transferable-buffer example: `[2, 4, 6]`; the sent buffer was detached.

These checks validate these specific contracts in the vendored site runtime, not the full API or public release.

An initial attempt to open `getting-started/examples/03-application.html` directly timed out waiting for initialization. That file references `./vendor/framework.src.js`, which is not present in its source folder; it is an export-oriented example, not a standalone verification URL as stored. Its complete packaged export still needs verification before the application guide is labeled runnable. No source files were changed to make that attempt pass.

## Deep component pass

See [IHtmlComponent audit](ihtmlcomponent-audit.md) for all 58 declarations, dependency traces, and unresolved implementation issues. Public drafts now separate templates, styling, selectors/DOM, and input watching instead of reducing these to summary rows. The [54-assertion Chrome result](component-verification.json) is tied to the vendored runtime hash.

Owner-confirmed boundary: createCSSStyleSheet/loadStyleSheet/onAppendStyle remain internal. The public stylesheet loading interface is styles, css(), and stylesheets.add(); document-sheet opt-in policy remains documented separately.

## Script attributes and autodiscovery pass

Added dedicated references for the seven script attributes in the application example, data-sandbox, and ComponentLoader behavior. Traced script lookup, absent/empty/default values, root/source path composition, namespace precedence, controller filename derivation, early stylesheet selection, and sandbox capture during Application class initialization.

ComponentLoader trace covers constructor namespace parsing, start/observe/scan/load/loadModule/resolve, per-tag promise caching, root observation, HEAD search ordering, registration verification, error handling and initial allSettled completion.

`node docs/discovery/verify-autodiscovery.mjs` passed six isolated Chrome scenarios against the real site runtime on 2026-10-01:

- Omitted sandbox/source attributes: default components namespace and /src/ resolution, plus later-added and nested-shadow children.
- data-sandbox=false: no discovery requests.
- Ordered namespaces: 404 in first namespace advances to components.
- Non-404 error: first namespace 403 stops fallback.
- All-404 missing component: later scan reuses cached attempt.
- Explicit application: no fallback discovery requests despite an undefined component tag.

The full set of remaining splash/debug/compressed-build/readiness controls is not claimed complete by this pass. Public docs explain actual attribute behavior without teaching the deprecated configuration object.

## Template language and native built-in pass

Read the actual Arc2D MessageBar template/controller and CustomButton controller/template; scanned neighboring template examples to distinguish current literal syntax from older EJS patterns. Followed LiteralParser -> TemplateLiteralParser -> render, plus Function.prototype.with -> namespace definition -> customized native registration -> initialization.

Added public references for full template authoring and customized built-in elements. They cover multi-statement blocks, lexical scope, branches, mapped/nested collections, helpers/getters, async evaluation order and concurrency, optional attributes, data receiver behavior, generated custom elements, native span/button creation, initialization and root restrictions, explicit imports and browser limits.

The IHtmlComponent name is documented specifically as the mixin operand in the owner-requested native-element recipe; this is not an invitation to present compatibility component aliases as alternative recommended component bases.

`node docs/discovery/verify-template-language.mjs` exercises the real Arc2D HTML template, the CountryPicker controller/HTML extracted directly from the new Markdown, and both customized built-in patterns. Results are in [template-language-verification.json](template-language-verification.json).

New confirmed edges:

- Each block is a separate function scope; EJS-style split control flow is not supported by the default parser.
- Non-returning statement blocks can output undefined; unjoined arrays insert commas; unawaited helper promises stringify.
- Awaited blocks execute in template order; Promise.all is available for explicit concurrency.
- `%>>` consumes the adjacent tag bracket because the parser uses a one-or-more closing-angle regex. A separated ` %> >` optional-attribute example is verified; quoted values/whole-element generation are clearer alternatives.
- Current native-element mixin initialization is automatic; the older Arc2D manual initialize constructor should not be copied.
- Native customized spans work with shadow templates in Chrome; native buttons retain label and disabled behavior with inline/light-DOM setup.
- Autonomous spelling and adding is after creation do not instantiate the customized built-in definition.
- ComponentLoader does not discover customized built-ins by their is attribute; import explicitly.

Chrome verification is not cross-browser certification. Current browser support references are linked in the public customized-built-in page. Further examples should continue to be traced from real applications instead of treating a method inventory as complete authoring guidance.

## Light/shadow DOM authoring pass

Added a dedicated guide joining root choice, inline preservation, shadow slot projection versus light replacement, inherited tokens, shared design rules, selectors, event retargeting, declarative markup, rerendering, and native built-in constraints. Traced CSSStyleSheet.js in addition to root/adoption/renderer code. The earlier missing-innerText fallback concern was corrected; the verified limitation is namespace-based light-style deduplication.

`node docs/discovery/verify-dom-modes.mjs` passed 24 Chrome assertions. See [results](dom-modes-verification.json). These include retained shadow host children, lost light children during template rendering, slot assignment, CSS boundaries, inherited/overridden tokens, composed event paths, rerender identity changes, inline preservation, actual shared-sheet adoption, and light-head style installation/deduplication.

## Second full-kernel review

Added namespaces/imports, general .with() composition, World, and page-readiness references; expanded Thread/ThreadPool contracts. Storage is excluded per owner direction. arc-kernel now explicitly defines the intended documentation baseline.

## Editorial and practical-example pass

The previous public reference snapshot is preserved in `legacy-reference.md` for migration evidence and excluded from current guidance. `reference.md` now indexes the canonical API drafts. Application setup includes every example file; events, watching inputs, safe text insertion, and threading now use concrete tasks.

`npm run test:docs` executes the exact Markdown examples against the vendored kernel through isolated routes, without a running local server or sibling project. It covers complete application boot/styles, product selection and late signal replay, disconnect/reconnect listener ownership, contact filtering and rerendering, untrusted text display, and worker aggregation. The framework repair backlog is `framework-defects.md`; all-event signal replay is confirmed intended behavior.
