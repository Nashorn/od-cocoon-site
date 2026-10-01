# IHtmlComponent contract audit

This ledger accounts for every method/getter in the inspected `src/core/ui/IHtmlComponent.js`. “Internal” entries are traced to explain public behavior; their existence does not make them recommended application APIs. Line numbers refer to the source pinned in `source-snapshot.json`.

Public-surface decisions supplied by Jason: keep createCSSStyleSheet, loadStyleSheet, and onAppendStyle internal; teach `Component` and `core.ui.HtmlComponent`; omit compatibility component aliases and `static is`; document script attributes instead of object-based configuration; document namespace-qualified generated tags and explicit `static tag`.

## Method coverage

| Method/getter | Source line | Role | Reference | Contract/branch trace |
| --- | --- | --- | --- | --- |
| `constructor` | 8 | Construction | [component](../api/component.md) | Calls initialize without awaiting; wrapped-element connection may start before derived fields. |
| `initialize` | 13 | Internal root setup | [component](../api/component.md) | options || this; snapshots declarative root, branches for wrapped/inline/extends vs normal host; optional slot insertion; no general attachShadow error fallback. |
| `static define` | 41 | Registration plumbing | [component](../api/component.md) | Own html synthesized even over inherited html; own explicit tag vs namespace fallback; duplicate tag returns early; bool parameter unused. |
| `defineAncestralStylesheets` | 72 | Internal style collection | [styling](../api/styling.md) | Descendant-to-parent traversal with prepending; concrete no-skin skips inline too; own prototype CSS; swallowed conventional import errors. |
| `hasOwnSkin` | 142 | Skin policy hook | [component](../api/component.md) | Returns effective skin or skin === undefined; truthy string possible; called on instance and ancestor prototypes. |
| `getDefaultStylesheetFilename` | 146 | Internal path selection | [styling](../api/styling.md) | Concrete Application uses controller-derived name; all other ancestors index.css. |
| `getApplicationStylesheetFilename` | 153 | Internal filename mapping | [application](../api/application.md) | src.js/min.js/.*js/js suffix transformations; input fallback index.*js. |
| `static defineAncestors` | 160 | Internal registration | [component](../api/component.md) | Starts concrete class, follows prototype.ancestor, stops before HtmlComponent; no runtime asset probing. |
| `static defineAncestralClassList` | 171 | Internal registration | [styling](../api/styling.md) | Prepends eligible class names; excludes implementation base names; shared prototype metadata. |
| `createCSSStyleSheet` | 183 | Internal helper | [styling](../api/styling.md) | Construct + replaceSync; annotated constructor; no adoption; supplied cctor fallback is this. |
| `static getSkin` | 190 | Skin helper | [component](../api/component.md) | Static method reads inherited this.skin; instance method delegates; truthy name adds skin directory. |
| `getSkin` | 196 | Skin helper | [component](../api/component.md) | Static method reads inherited this.skin; instance method delegates; truthy name adds skin directory. |
| `dispatchEvent` | 200 | Public event operation | [events](../api/events.md) | Target precedence, mutable option normalization, event-object return and existing Event branch. |
| `on` | 227 | Public listener helper | [events](../api/events.md) | Delegates with four arguments; no return or cleanup handle. |
| `addEventListener` | 231 | Public extended listener | [events](../api/events.md) | No selector/native host or document; Node/path delegation; extended find then one direct binding; wrappers retained. |
| `subscribe` | 261 | Public signal subscription | [events](../api/events.md) | Replay entire Set before listener install; same Event references; replay errors abort; cleanup removes listener only. |
| `fire` | 272 | Public signal publication | [events](../api/events.md) | Document dispatch before history insert; returns event; no element argument or eviction policy. |
| `broadcast` | 282 | Public signal publication | [events](../api/events.md) | Delegates to fire without different semantics. |
| `append` | 286 | Public DOM helper | [selectors-and-dom](../api/selectors-and-dom.md) | One element/container, scheduled RAF, resolves node; callback exceptions not routed to reject. |
| `watch` | 292 | Public watcher adapter | [watching-inputs](../api/watching-inputs.md) | Resolve selector once, missing -> undefined; passes engine arguments and component receiver. |
| `getBoundingClientRect` | 297 | Public geometry helper | [selectors-and-dom](../api/selectors-and-dom.md) | Optional target else native host; augments rectangle with viewport center. |
| `loadTemplate` | 303 | Template loading | [templates](../api/templates.md) | Truthy source cache; function data prototype mutation; exact terminal .html fetch test; status rejection; element wrapping. |
| `_selectors` | 321 | Internal getter | [selectors-and-dom](../api/selectors-and-dom.md) | Lazily caches one SelectorResolver with component context. |
| `find` | 326 | Public async selector | [selectors-and-dom](../api/selectors-and-dom.md) | Forwards positional interval/duration; resolver ignores interval and returns last observed match at timeout. |
| `findAll` | 330 | Public async selector | [selectors-and-dom](../api/selectors-and-dom.md) | Forwards options object; default count 2; array output including partial timeout. |
| `querySelectorAll` | 334 | Public query | [selectors-and-dom](../api/selectors-and-dom.md) | Native NodeList vs extended array; shadow/root first and host fallback only if empty. |
| `querySelector` | 338 | Public query | [selectors-and-dom](../api/selectors-and-dom.md) | Root first, host fallback; explicit traversal uses no equivalent merged fallback. |
| `_arcSelectors` | 342 | Internal parser adapter | [selectors-and-dom](../api/selectors-and-dom.md) | Recognizes >>> and ::document through resolver. |
| `$_` | 346 | Internal traversal adapter | [selectors-and-dom](../api/selectors-and-dom.md) | Forwards roots/start/visitor to resolver walk; not taught as another public selector syntax. |
| `_waitFor` | 350 | Internal wait adapter | [selectors-and-dom](../api/selectors-and-dom.md) | Forwards into observer-based resolver; no polling or cancellation parameter. |
| `disconnectedCallback` | 354 | Framework callback | [lifecycle](../api/lifecycle.md) | Unsubscribe sheets then await onDisconnected then unawaited onSleep; no finally or general resource cleanup. |
| `connectedCallback` | 360 | Framework callback | [lifecycle](../api/lifecycle.md) | Instance OR class lazy; observer intersection, await hook then unobserve; normal path await hook. |
| `onConnected` | 379 | Public lifecycle hook | [lifecycle](../api/lifecycle.md) | Sets data; awaits style/render/attributes; unawaited awake; connected signal; activity end finally. |
| `onAwake` | 406 | Public lifecycle hook | [lifecycle](../api/lifecycle.md) | Registers update-capable components, no dedup; overriding replaces behavior unless super called. |
| `onSleep` | 413 | Public lifecycle hook | [lifecycle](../api/lifecycle.md) | Empty base, unawaited by callback; not automatic loop-resource release. |
| `onDisconnected` | 415 | Public lifecycle hook | [lifecycle](../api/lifecycle.md) | Empty async base; own cleanup responsibility. |
| `hasOwnTemplate` | 417 | Template policy | [templates](../api/templates.md) | Exactly declarative === false; no file existence check. |
| `getTemplateToLoad` | 421 | Internal provider selection | [templates](../api/templates.md) | Truthy own template OR html OR template; registration own-html synthesis matters. |
| `shouldParse` | 425 | Internal marker detection | [templates](../api/templates.md) | Decoded markers in candidate/fallback host OR root; not confined to supplied string. |
| `render` | 429 | Public rendering | [templates](../api/templates.md) | Engine first; inline, dynamic DSD, external/own, preserve branches; hook unawaited; no this.data assignment. |
| `parseInnerHTML` | 453 | Internal light-content pass | [templates](../api/templates.md) | Runs engine on host innerHTML when combined marker check passes; clears and appends host content. |
| `onRendered` | 461 | Public lifecycle hook | [lifecycle](../api/lifecycle.md) | Empty base; render calls synchronously without awaiting return. |
| `setAttribute` | 463 | Public DOM override | [selectors-and-dom](../api/selectors-and-dom.md) | Wrapped element -> root.setAttribute; otherwise native host; document-root caveat. |
| `loadStylesheets` | 468 | Internal collection/adoption | [styling](../api/styling.md) | Append styles iterable by identity; await collection adoption then document subscription. |
| `shouldAdoptDocumentStyleSheets` | 481 | Public policy hook | [styling](../api/styling.md) | False default; true/string/RegExp/array/predicate interpretation in accepts helper. |
| `adoptDocumentStyleSheets` | 483 | Internal subscription setup | [styling](../api/styling.md) | Truthy policy + adoptedStyleSheets required; resets doc count, subscribes with replay; catches and warns. |
| `acceptsDocumentStyleSheet` | 494 | Internal filter | [styling](../api/styling.md) | Reevaluates policy; url || href || empty; substring/regex OR; predicate receives sheet; no regex-state reset. |
| `onDocumentStylesheetAdopted` | 503 | Internal signal consumer | [styling](../api/styling.md) | Missing or duplicate sheet -> no-op; filter then splice at doc count, increment count. |
| `onAppendStyle` | 512 | Internal adoption | [styling](../api/styling.md) | shadowRoot || root; insert/append; doc publishes; fallback input shape and replaceSync return hazard. |
| `stylesheets` | 541 | Public collection getter | [styling](../api/styling.md) | Per-instance array; add identity-check, unshift, late load at doc boundary, undefined return. |
| `onAdoptStylesheets` | 555 | Internal loader | [styling](../api/styling.md) | Sequential await loadStyleSheet; sets loaded flag; does not clear prior adopted sheets. |
| `loadStyleSheet` | 562 | Internal loader | [styling](../api/styling.md) | Sheet direct path returns adoption promise; string namespace/page resolution, catch/log, unawaited onAppendStyle. |
| `onTransformStyle` | 583 | Style transformation hook | [styling](../api/styling.md) | Non-shadow regex replacement only; no namespace scoping for all selectors; ns argument unused. |
| `getTemplateEngine` | 591 | Template engine selection | [templates](../api/templates.md) | Default engine from manager; construct if function else return instance; no absent-engine fallback. |
| `setInternalAttributes` | 596 | Internal metadata | [component](../api/component.md) | One-time guard; target element.body || element || this; class list + namespace; not refreshed on every render. |
| `inShadow` | 603 | Public root policy hook | [component](../api/component.md) | Non-Element false; internals.shadowRoot || shadowRoot || false in try/catch; not boolean-only; override before initialization. |
| `cssStyle` | 612 | Compatibility implementation | [styling](../api/styling.md) | Empty base; collection uses it only when ancestor owns no css method; omitted from intended public teaching surface. |
| `importCSS` | 614 | Internal import/fallback | [styling](../api/styling.md) | Absolute URL plus src/src cleanup; module import attempt then fetch text; no fallback status check; activity finally; ancestor/options args not used for selection. |

## Dependencies followed

- `HtmlComponent.js` and `kernel.js`: active import chain/public alias.
- `Class.js`: namespace/class registration and define invocation.
- `SelectorResolver.js`: ordinary/extended queries, observer wake-ups, count/timeout behavior.
- `watchers/default.js`: default force, callback payload mutation, event-backed observation, cleanup.
- `TemplateLiteralParser/index.js`, `LiteralParser.js`, `Manager.js`, and String.decode: parser context, HTML generation, await selection, default engine construction.
- `Application.js`, `-appconfig.js`, bootloader startup: wrapped document, attribute mapping, controller path, stylesheet publication, base signals.
- README: comparison evidence, not an authority that overrides current code or the intended public surface.

## Implementation issues kept separate from recommended usage

These findings are not authorization to change the framework. Some are intentional restrictions, others are likely defects or documentation mismatches. Source inspection alone is not a full cross-browser reproduction.

| Finding | Evidence and consequence | Validation |
| --- | --- | --- |
| Dynamic declarative content wins before declarative=false | render's second branch precedes hasOwnTemplate branch. | Browser reproduced with existing open declarative root. |
| Instance arrow css is ignored | Collection checks ancestor prototype own properties. README arrow-field examples do not use that path. | Browser reproduced. |
| skin=null skips own css too | Top-of-loop continue precedes inline collection. | Browser reproduced; parent sheets retained. |
| Native accessors through data prototype | Parser makes plain data inherit from an HTMLElement; a native getter may reject that receiver. | Browser reproduced with missing own title field. |
| Flat event flags are deleted before copying | dispatchEvent shares flat data/detail then deletes option properties. | Browser reproduced; nested detail shape preserves outer flags. |
| No general read-only/frozen data support | Template context and event normalization mutate caller objects. | Source traced; not all object types tested. |
| Stylesheet local var can retain a prior iteration value | defineAncestralStylesheets declares function-scoped var sheet; some branches do not reset it before later use. | Source finding; targeted missing/suppressed-ancestor reproduction pending. |
| Non-sheet onAppendStyle branch uses replaceSync return | replaceSync returns no constructed sheet, yet expression is used as sheet. | Source finding; branch not recommended as a general input adapter. |
| Non-adoption fallback expects innerText and owner namespace | Follow-up trace found Cocoon installs CSSStyleSheet.prototype.innerText to serialize cssRules; the original missing-innerText concern was incorrect. | Getter and normal light-root installation verified; namespace dedup behavior documented separately. |
| CSS fallback HTTP errors not checked | importCSS reads response.text without response.ok check, unlike loadTemplate. | Source traced. |
| Reconnection can accumulate work | Existing sheet lists/root adoption are not reset; onAwake list push has no removal here; own listeners survive unless cleaned. | Source traced; full reconnection matrix pending. |
| Lazy observer cleanup/failure | Unobserve only after successful onConnected; disconnectedCallback does not disconnect it. | Source traced; lazy failure/disconnection matrix pending. |
| Async append failure cannot use explicit rejection | Scheduled async callback throws outside the promise's reject path. | Source traced; invalid containers excluded from examples. |
| Async lifecycle hooks not universally awaited | onRendered/onAwake/onSleep are plain calls; onDisconnected is awaited without finally for onSleep. | onRendered and normal ordering browser-tested; rejection matrix pending. |
| define is async but caller does not await | Namespace createClass wraps invocation in synchronous try/catch; asynchronous registration rejection is not thereby caught. | Source traced; invalid-name matrix pending. |
| Extended find resumes from a subtree | Observers use captured roots/index; a later count can be branch-local. | Source traced; multi-root wait matrix pending. |
| Watches are event adapters, not assignment observers | Only input/change listeners are installed; old is not advanced. | Browser reproduced, including force=false and missing selector. |

## Executable evidence

Run `node docs/discovery/verify-component-contracts.mjs` from the site checkout. The script routes an isolated fixture in Playwright, loads the unmodified vendored kernel, and checks the contracts described by the assertion names. No application or framework files are patched for the probes.

See [verification results](component-verification.json) for the last successful result and runtime SHA-256. Results cover specific contracts in headless Chrome, not exhaustive browser compatibility or public-release certification.

## Owner clarification: skinning

Jason confirmed that `skin = null` is an intentional skinning feature and must be taught as such, with purpose and usage rather than only an implementation truth table. This does not yet settle the separate question of whether suppressing the concrete class's inline `css()` is intended. The public example now shows inherited styling plus an explicit theme and explicit parent-template reuse.

## Light-root correction and follow-up

The initial fallback concern missed the active CSSStyleSheet prototype extension. That extension supplies innerText; the normal light-root stylesheet path works in Chrome. The verified issue is instead per-namespace deduplication: after the conventional sheet is installed, same-class inline CSS can be skipped. Intended behavior was submitted to Jason as a multiple-choice clarification; no framework changes made.
