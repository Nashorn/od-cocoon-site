# Component lab

The landing page embeds `/showcase/index.html` in an automatically sized iframe.
That document is a Cocoon application, booted with `data-namespace="lab.ShowcaseApplication"`,
`data-controller="index.js"`, an import map, and the pinned kernel. The hero and
footer remain in the landing document. The editor's preview iframe is never used.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `bootstrap.js` | Landing-page iframe height and navigation links |
| `frame-bridge.js` | Height reporting and boot failure recovery |
| `src/lab/ShowcaseApplication` | Native Cocoon Application entry |
| `src/lab/Showcase` | Marketing copy, controls, inspector, selection, editor UI |
| `src/lab/Component` | Common appearance and open shadow roots |
| `src/examples/team/TeamAccess` | Composes the toolbar and cards in responsive grid slots |
| `src/examples/team/AccessToolbar` | Fires native approval and member-selection signals |
| `src/examples/team/ProfileCard` | Ancestor template/skin, native signal subscriptions |
| `src/examples/team/MemberCard`, `AdminCard` | ProfileCard subclasses and their reactions |
| `PresentationController` | Cancellable animation, rotation/depth, pause/replay/reset |
| `ConnectionOverlay` | SVG paths attached to live DOM endpoints |
| `InheritedSkin` | Edits the actual inherited ProfileCard CSSStyleSheet |
| `ProjectWorkspace` | Source files, drafts, Run and reset |
| `project-worker.js` | Serves immutable edited runs only under `/showcase/runs/` |

Components use namespace imports/registration and `onConnected()` with
`await super.onConnected()`. They communicate with `this.fire()` and
`this.subscribe()`. The iframe owns its own event bus and custom-element registry.
There is no custom session bus, `mount`/`bind` lifecycle, manual registration, or
component `importCSS` override. MemberCard and AdminCard explicitly reuse the
ancestor template with `html() { return super.html(); }`; their CSS is inherited
by the kernel. The shell identifies that sheet by its actual module, not mutable
constructor metadata. For browsers using the kernel's CSS-fetch fallback, the
shell normalizes equivalent sheets into one editable shared sheet.

## Edit and Run

`project.json` lists the actual example source files. Source loading is deferred
until Edit or source inspection needs it; it never gates initial scene visibility.
The editor loads those files,
not a separate copy of the example. The shell and kernel are outside the editable
namespace. `<code-explorer editor-only>` is mounted once and retains its state
when switching between editor and scene. HTML preview and sharing controls are
suppressed in this mode; the hero explorer keeps its existing behavior.

Edits stay drafts until Run (or Cmd/Ctrl+S). Run writes a new immutable example
snapshot to Cache Storage and saves draft/view state in sessionStorage. A service
worker scoped to `/showcase/` serves the snapshot and fixed shell dependencies.
Only the showcase iframe navigates to the new run. Its fresh document gets a new
custom-element registry, allowing updated JavaScript classes to register normally.
New JS files receive namespace import-map entries automatically.

Run restores rotation, shared depth, selected component and presentation mode.
Business state starts fresh. Drafts and the active file survive Run. Returning to
the editor without Run keeps edits unapplied. Inspector skin changes update the
ProfileCard source as well. Reset example returns to the original project.

A startup error exposes a recovery action outside the application. It reopens the
baseline shell/editor with the failed draft preserved. Service-worker/storage
failures keep the current editor open with an error message. Run requires HTTPS
or localhost (service workers and Cache Storage).

## Visual and interaction contract

The same scene markup and CSS are retained. Actual component DOM surfaces lift
from their grid slots; all siblings use the same Z translation and parent
perspective. No cloned preview, screenshot or canvas substitutes for the UI.

Explore 3D is selected initially, but the first explosion waits for viewport
visibility. Scrolling away/back does not replay it. Signals update both listeners
synchronously; the pulse visualizes delivery without delaying business behavior.
Mode changes cancel the old timeline. Rotation is bounded to ±25° yaw and 6–28°
pitch; the Z-depth slider moves every sibling together. Reduced motion removes
transition waits. Cards/toolbar surfaces are selectable; native controls retain
their actions. The iframe follows content height, so page scrolling remains owned
by the landing page.

## Extending the example

Add components under `src/examples/team`, declare them in `namespace \`examples.team\``,
and import dependencies by namespace. Include shipped files in `project.json`
and `.importmap`/the entry HTML import map. Compose them in TeamAccess. Grid layout
grows with content. Register named DOM endpoints and inspector entries in the
shell when the new component needs visualized signals or inspection.

## Verification

`npm run test:showcase` starts a local static server and uses installed Chrome via
Playwright. `CHROME_PATH` can select a Chromium executable; `SHOWCASE_ARTIFACTS`
selects the screenshot directory (default `/tmp/arc-showcase-verification`).

Checks cover native registration/inheritance, real signals, animation, shared
Z-depth/reset, style editing, actual source inspection, interruption, mobile/tablet,
reduced motion, and editor Run with HTML/CSS/JavaScript changes while preserving
the landing page. Additional checks cover editor line-break preservation,
inspector-to-source synchronization, failed-run recovery, and added namespace
imports. Safari/Firefox need separate verification.
