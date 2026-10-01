# Documentation authoring

The documentation is Markdown-first. `manifest.json` binds each approved source to a stable document ID, future `/documentation` route, navigation position, and related reading. `npm run docs` compiles those sources into `.generated/documentation/bundle.json`; it does not build website pages.

See the [generation contract](generator.md) for commands, manifest fields, link/anchor rules, the output schema and the relationship map. The future presentation layer will consume this bundle after its visual mockup is approved. Existing `docs.html` and `get-started.html` remain on the separate `npm run docs:legacy` path.

## Reference drafts

- [Component](api/component.md)
- [Light DOM and shadow DOM](api/light-and-shadow-dom.md)
- [Namespaces and imports](api/namespaces-and-imports.md)
- [Class composition with .with()](api/class-composition.md)
- [Application](api/application.md)
- [World and simulation timing](api/world.md)
- [Page readiness](api/page-readiness.md)
- [Script attributes and defaults](api/script-attributes.md)
- [Component autodiscovery](api/component-autodiscovery.md)
- [Lifecycle](api/lifecycle.md)
- [Events](api/events.md)
- [Template syntax and complete examples](api/template-syntax.md)
- [Templates and rendering](api/templates.md)
- [Customized built-in elements](api/customized-built-in-elements.md)
- [Styling](api/styling.md)
- [Selectors and DOM](api/selectors-and-dom.md)
- [Watching inputs](api/watching-inputs.md)
- [Threading](api/threading.md)

The intended documentation contract follows the arc-kernel source, per Jason. Differences in the site runtime must be identified explicitly; neither a shared version string nor a local probe establishes public release equivalence. Read the [discovery inventory](discovery/api-inventory.md) for coverage, evidence, and unresolved release differences. Browser verification is recorded separately from source inspection.

## Authoring rules

1. Trace a feature to the active kernel import graph, not merely a similarly named file.
2. Keep application-defined classes such as DemoSample's `BaseComponent` outside the framework API.
3. Resolve source/README discrepancies before promising behavior in a guide.
4. Mark source-reviewed and browser-tested behavior separately.
5. Keep internal discovery material out of the eventual public navigation and search index.
6. Publish release attribution only after matching the target distributed artifact.

The content generator reads these Markdown files directly. The future site renderer must consume its bundle rather than create independently maintained content copies.

## Component contract audit

The [method coverage ledger](discovery/ihtmlcomponent-audit.md) traces all 58 method/getter declarations in the inspected IHtmlComponent source, including internal branches that explain public behavior. [Executable Chrome probes](discovery/verify-component-contracts.mjs) validate 54 selected contracts against the real vendored runtime; [results](discovery/component-verification.json) include its hash. Internal coverage does not imply public support for every method.

Owner-confirmed styling boundary: teach `styles`, `css()`, and `stylesheets.add()`; stylesheet construction/loading/adoption helpers remain internal. Threading, namespaces, class composition, World scheduling, and page readiness have now received a second kernel-wide pass. Remaining source/bundle discrepancies and public-boundary decisions are tracked in discovery. Storage/Collection/IStorageDriver are owner-designated legacy/internal and excluded from the public reference.

## Reading and maintenance order

Start with [compatibility](compatibility.md), then the complete [Application](api/application.md) example. Continue with [Component](api/component.md), [template syntax](api/template-syntax.md), [input watching](api/watching-inputs.md), [events](api/events.md), and [styling](api/styling.md). World and threading are task-specific extensions.

Public authoring: `get-started.md`, `reference.md`, `compatibility.md`, and `api/`. Internal source evidence and verification: `discovery/`. Site implementation: `showcase-architecture.md`. Operational privacy review: `privacy-notice-draft.md`; this is not framework teaching material.

The [framework issue register](discovery/framework-defects.md) records reproduced and suspected defects for repair. Preserve evidence; do not silently turn a suspected bug into a promised API contract. Signal replay of every retained event is owner-confirmed.

Run `npm run test:docs` to check Markdown links and execute the practical examples against the vendored runtime in installed Chrome. The new practical-example harness uses intercepted fixture URLs and needs no running server or sibling checkout. Older source-comparison probes have their own prerequisites; they remain supplemental evidence rather than part of this portable command.
