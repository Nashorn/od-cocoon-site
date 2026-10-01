# Documentation generation contract

Internal authoring and renderer integration guide. This file is deliberately absent from `manifest.json`; it is not published or indexed as framework documentation.

## Ownership

| Input | Owns |
| --- | --- |
| Canonical `.md` files | Document heading, body, examples, section headings, source-relative links |
| `manifest.json` | Stable IDs, source paths, public routes, navigation titles/order, curated related reading |
| `scripts/build-docs.mjs` | Validation, Markdown compilation, anchor IDs, link resolution, search records and dependency map |
| Future presentation layer | Layout, theme, typography, syntax highlighting, search interaction and mobile navigation |

The generator produces content data, not a website. It creates no route directories, HTML pages, CSS, JavaScript UI, or deployment configuration. HTML in the bundle consists of content fragments for the future renderer, with escaped fenced code and language classes retained.

## Commands

```sh
npm run docs                  # Compile .generated/documentation/bundle.json
npm run docs:check            # Validate all inputs without writing
npm run test:docs:generator   # Temporary-fixture tests and real-document validation
npm run test:docs             # Existing Chrome tests of documented framework examples
```

Run the generator after source edits. There is no watcher, deployment integration, or incremental scheduler yet. A full rebuild computes every document and shared index so incoming links and navigation cannot silently retain old routes. Byte-identical output is left untouched.

The old two-page HTML generator is preserved as `scripts/build-legacy-docs.mjs`, available only through `npm run docs:legacy`. That command updates `docs.html` and `get-started.html`. Ordinary `npm run docs` no longer touches website files. Do not run the legacy command to preview the future documentation UI.

## Manifest format

`schemaVersion` is `1`. Every `documents` entry requires:

| Field | Meaning |
| --- | --- |
| `id` | Stable logical identity, for example `api.component`. Keep it when moving the file or changing the route. |
| `source` | Normalized path relative to `docs/`, for example `api/component.md`. Must stay inside that directory, including through symlinks. |
| `route` | Unique, extensionless `/documentation` route without a trailing slash. |
| `title` | Concise navigation/search title; the Markdown H1 remains the content heading. |
| `related` | Ordered array of other document IDs; use `[]` when there are no curated recommendations. |

`navigation` contains ordered groups with `id`, `label`, and an ordered `documents` array of IDs. Every document appears exactly once. Group order and document order determine previous/next links, including transitions between groups. Groups are labels, not invented page routes.

The manifest is an explicit publication allowlist. Files merely added under `docs/` do not enter the bundle. Discovery, archived reference, defect, privacy, architecture, and generator notes are excluded by the current manifest. Adding a document to the manifest is the deliberate publication decision.

## Links and anchors

Write ordinary source-relative Markdown links such as `[Styling](api/styling.md)` from a file at the docs root, or `[Styling](styling.md)` from another API file. The generator resolves the target through the manifest and emits its public route. Reference-style Markdown links work too.

Local fragments are checked against the generated headings. A heading slug uses lowercase text, removes punctuation except hyphens/underscores, and replaces whitespace with hyphens. Duplicate slugs receive numeric suffixes; collisions with already-used suffixed headings are also avoided. For example, two `Usage` headings become `usage` and `usage-1`. Renaming a heading can break incoming anchors; validation reports the originating document and missing destination anchor.

Local document targets must be in the manifest. Absolute `/documentation/...` links are validated too. Absolute routes outside `/documentation`, HTTP(S), mail and telephone links remain external to this content graph; the generator does not verify their availability. Images currently require an absolute site asset path or HTTP(S) URL and are not copied into the output.

Use Markdown links and headings, not raw HTML anchors, custom IDs, scripts, or embeds. Raw spans used by existing drafts remain supported. Canonical Markdown is trusted repository content; this compiler is not an untrusted-HTML sanitizer. Fenced code examples are content, not navigation, and their sample links are not rewritten or validated.

Each document starts with exactly one H1. The compiler does not invent missing content or automatically update source links when a file moves: move the source, update its manifest entry and source-relative incoming links, then validate.

## Output contract: `bundle.json`

The output is ignored by Git. Regenerate it from versioned inputs; do not edit it manually. A single bundle permits atomic replacement and avoids leaving stale per-document files after removals.

| Key | Consumer use |
| --- | --- |
| `schemaVersion` | Version of this data contract. Future renderers should reject unsupported versions. |
| `generatedBy` | Identifies generated data and its authoring sources. |
| `buildHash`, `inputs` | Deterministic hashes of manifest, generator, document sources, plus the installed Marked version. No build timestamps or machine paths. |
| `routes` | Public route to stable document ID lookup. |
| `documents[id]` | Source, source hash, title, H1 heading, `bodyHtml`, table of contents, breadcrumbs, previous/next, related reading and resolved document links. |
| `navigation` | Ordered groups and resolved document summaries. |
| `search` | Section records with document ID, document title, heading, destination URL and plain text. A future search UI can index these fields without scraping HTML. |
| `dependencies[source]` | Document identity, source hash, outgoing/incoming document links, curated related relationships in both directions, navigation group and affected output locations. |

`toc` excludes H1 and retains each other heading's depth, ID, text and URL. Search records split at top-level Markdown headings; the first record points at the page route. The full body includes H1, so a renderer must not add a duplicate visible H1. A breadcrumb group has no route; render it as a label rather than inventing a URL.

For a future page render, look up `bundle.routes[path]`, then `bundle.documents[id]`. Combine that record with `bundle.navigation` and the approved shared UI. Never maintain a second page-body copy. Syntax highlighting, code-copy controls, search ranking, redirects for old URLs, route serving and SEO output belong to that future integration.

Dependencies describe the relationship map; they do not claim incremental scheduling exists. A document's source change affects its rendered content, heading links and search. A manifest route/title change can affect incoming links, curated recommendations, navigation and neighboring pages. Full regeneration covers all of them.

## Validation and failure behavior

The build rejects missing sources, duplicate IDs/routes/sources, invalid paths/routes, missing or repeated navigation placements, unknown related IDs, missing H1s, unpublished document links and missing heading anchors. Source-relative links are resolved after all headings have been collected, so forward links work.

Compilation and validation finish in memory before output is written. A failed build leaves the last valid bundle intact and exits nonzero; consumers must honor that failure rather than deploy the stale bundle. Successful output is written to a temporary sibling file and renamed into place.

Tests prove source-edit regeneration, route propagation, stable identity after source moves, stale-document removal, no-op builds, failed-build preservation and exclusion of internal records. They also compile all current canonical documents and verify that compilation does not change the existing website files.
