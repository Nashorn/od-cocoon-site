# Component lab

The middle of the landing page is one persistent stage. Its real DOM components
are transformed into an exploded assembly and returned to their original layout.
No screenshot, cloned component, canvas render, or third-party 3D engine substitutes
for the application UI.

## Ownership

| Owner | Responsibility |
| --- | --- |
| `ArcShowcase` | Marketing surface, mode controls, inspector, keyboard interaction |
| `TeamAccess` | Composes the toolbar and cards; responsive assembly geometry |
| `AccessToolbar` | Selection and approval requests; emits the corresponding signal |
| `ProfileCard` | Shared template, styling, status display and inspection affordances |
| `MemberCard`, `AdminCard` | Real ProfileCard subclasses with their own signal reactions |
| `PresentationController` | Single cancellable timeline, modes, rotation limits, pause/replay/reset |
| `ConnectionOverlay` | SVG paths projected from named DOM endpoints every playback frame |
| `InheritedSkin` | Per-stage editable ancestral CSSStyleSheet adopted by both subclasses |
| `SignalSession` | Cocoon fire/subscribe topic scoping, replay retention and cleanup |

Components extend the real Cocoon `WebComponent`, use open shadow roots, and load
their HTML/CSS through the kernel. The subclasses explicitly inherit the base
template with `html() { return super.html(); }`. The inspector reads the actual
source files; CSS edits affect the real adopted base stylesheet.

## Add or change a child

1. Implement its behavior and presentation under `public/showcase/components/`.
2. Compose it in TeamAccess's template and `parts` map. Its layout belongs in
   TeamAccess CSS. Grid slots flow with their content and stack through container queries;
   3D transforms lift those same surfaces without fixed layout coordinates or JavaScript scaling.
3. Bind it to the owned SignalSession in the same path as existing children.
4. To visualize a connection, expose a small `data-endpoint` element inside it
   and register source/target getters in ArcShowcase's ConnectionOverlay registry.
   Never encode screen coordinates in the connection registry.
5. Add the component to the inspector selector and source-owner mapping if it is
   inspectable. Layout-only changes do not require changing SVG paths.

## State and interaction contract

Explore 3D is the initial selected mode. The surfaces stay assembled offscreen;
a one-shot IntersectionObserver triggers the explosion when at least 30% of the
stage enters the usable viewport. Subsequent scrolling does not replay the intro.
An explicit mode/action cancels a pending intro, and disposal disconnects it.

Presentation states are `interface`, `exploding`, `playing`, `delivered`,
`explore`, `inspecting`, and `assembling`. Mode changes cancel the old timeline
with AbortController. Real business actions are synchronous; cancelling a visual
transition never discards an approval or member selection. The traveling pulse
illustrates the real signal exchange after the components separate; it does not
artificially delay event listeners.

Approval/selection opens the scene, visualizes the signal, holds briefly, and
returns to the flat interface. Explore keeps the scene open. Inspect opens the
source panel and highlights the chosen component. Rotation is limited to ±25°
yaw and 6–28° pitch. Reduced-motion mode applies transitions immediately.

Reset cancels playback and restores member selection, status, rotation, and shared
styles. Closing/reopening inspection preserves applied edits. CSS editing accepts
valid `border-radius`, `background`, and `border-color` declarations in one `:host`
rule; validation is atomic. It is deliberately a style playground, not a general
code execution environment.

## Runtime integration

The pinned Cocoon 8.6.0 distribution is vendored, with its license, in
`public/vendor/cocoon/`. The import map is in the document head. An empty
`public/.importmap` is also available for kernel fallback. Relative ESM imports
define the components; automatic sandbox discovery is disabled on the marketing
page so the existing hero explorer remains independently owned.

Two published-kernel details are contained in application adapters:

- Its ancestor walk reuses stylesheet constructor metadata. ProfileCard captures
  its sheet reference when it is imported, rather than identifying it later by
  mutable metadata. Each stage adopts its own editable copy in both card roots.
- Its signal history retains a Set. SignalSession bounds only its instance-owned
  topics to the latest event and removes those topics/subscriptions on disposal.
  Other application topics are never touched.

## Verification

```sh
npm ci
npm run test:showcase
```

The test starts its own static server and uses installed Chrome through Playwright.
Set `CHROME_PATH` for another Chromium executable. Set `SHOWCASE_ARTIFACTS` to
choose the screenshot directory (default `/tmp/arc-showcase-verification`).

Coverage includes real class/style inheritance, signal reactions, live endpoint
positions, pause/resume, reassembly, CSS validation, source inspection, interrupted
actions, reset, bounded replay storage, mobile/tablet, reduced motion and remount
cleanup. Chrome is verified; Safari/Firefox require separate browser verification.
