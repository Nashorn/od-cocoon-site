# Guide plan: shared design system and icon fonts

Requested by Jason: expand shouldAdoptDocumentStyleSheets beyond its API signature into practical guides showing shared CSS tokens/design-system rules and font icons without a library link/import in each component template.

## Confirmed framework foundation

- Application styles are adopted on the document and announced by Cocoon.
- Components opt in with shouldAdoptDocumentStyleSheets, optionally filtering URL patterns or sheet metadata.
- Previously published sheets replay to late subscribers; future publications reach existing subscribers.
- Accepted sheets are shared by reference and inserted ahead of component-owned styles.
- Disconnection removes the framework subscription. Automatic removal/replacement reconciliation is not provided.
- A common application-defined component superclass can centralize adoption. This must not be presented as a Cocoon-supplied BaseComponent.

## Guide chapters to build

1. **Design tokens:** document-level colors, spacing, typography, radii, and motion variables; inherited variables versus rules requiring adoption; host-level overrides. Do not imply variables always require shared-sheet adoption.
2. **Reusable rules:** publish a design-system sheet once from the application and use shared button, input, layout, and typography classes inside multiple shadow roots. Explain opting in selectively instead of importing every application rule.
3. **Font icons:** application-owned font-face and shared icon selectors/pseudo-elements; components use only icon markup. Show loading behavior and missing-font diagnostics. Select a real library and validate its CSS before claiming turnkey compatibility.
4. **Themes:** change document/host custom properties for token-driven themes; distinguish mutating a shared sheet from replacing/removing it. No fictional automatic theme-reconciliation API.
5. **Component customization:** inherited shared foundations, local css()/styles overrides, and skin=null for components intentionally supplied with their design externally.
6. **Loading and lifetime:** component before/after stylesheet publication, dynamically inserted components, unsubscribe on disconnect, and explicit limits on reconnect/replacement behavior.
7. **Other shared assets:** reusable animations, utility classes, form foundations and typography. Verify selector assumptions in shadow roots rather than claiming every third-party CSS framework works unchanged.

## Verification before publishing a runnable guide

- Use actual Application.styles and component opt-in, not internal stylesheet helpers.
- Check computed styles in multiple shadow roots, token changes, local overrides and an excluded sheet.
- Verify a real glyph renders, font loading succeeds, and templates contain no repeated stylesheet links/imports.
- Check relative font URL resolution on the CSS-module path and text-fetch fallback. The fallback constructs CSS text without an explicit original-sheet base URL; asset URLs need deliberate handling.
- Avoid CSS libraries whose essential rules depend on @import unless those imports are resolved beforehand: replaceSync removes @import rules.
- Check document-specific selectors such as body/.app/:root; adoption does not rewrite them to fit component markup.
- Measure network behavior rather than promising one request per asset across all environments.
- Verify target browsers; current component probes establish adoption mechanics, not complete icon-font compatibility.

## Browser references

- [MDN: sharing constructed stylesheets between document and shadow roots](https://developer.mozilla.org/en-US/docs/Web/API/Document/adoptedStyleSheets)
- [MDN: shadow DOM styles and stylesheet reuse](https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_shadow_DOM)
- [MDN: replaceSync removes imported rules](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/replaceSync)

## Early application stylesheet: confirmed trace and probe

Teach `data-adopted-stylesheet="index.css"` (singular) as the recommended default application sheet entry point. Boot starts this path after import-map initialization, independently from application construction. Trace: `-appconfig.js` attribute mapping -> bootloader `importMapReady.then(tryAdopt)` -> `adoptDocumentStylesheet` -> document adoption + stylesheet:adopted -> component subscription/filter/insertion. Internal aliases used by boot are not part of the public setup instructions.

`node docs/discovery/verify-boot-stylesheet.mjs` passed in headless Chrome on 2026-10-01 using the real vendored runtime and isolated routed assets:

- Held the application controller response while allowing the default stylesheet to load.
- Confirmed a component connected before publication acquired the shared rule while no application instance existed.
- Released the controller and confirmed the matching default sheet appeared only once in document adoption.
- Connected another component afterward and confirmed replay adoption.
- Confirmed both roots adopted the exact document stylesheet object and rendered the expected computed color.

This demonstrates early independent loading and both subscriber timings. It does not guarantee first-paint ordering on arbitrary networks. The application skip check compares the configured filename to its derived CSS filename literally, not by normalized URL.
