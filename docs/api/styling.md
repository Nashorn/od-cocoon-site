# Styling

Cocoon combines inherited skin files, prototype `css()` methods, additional `styles`, and opt-in document sheets. These channels differ in resolution, collection timing, and cascade position.

## Conventional stylesheets and skins

A component normally loads `index.css` from its qualified namespace folder. A named `static skin = 'dark'` selects `skins/dark/index.css`. Each visited ancestor resolves its own namespace and effective skin; a child's skin does not automatically select the same file for every ancestor.

Static skin values inherit through JavaScript class inheritance. To return from an inherited named or disabled skin to the ordinary path, explicitly set `static skin = undefined`.

`hasOwnSkin()` is truthy for an undefined or truthy skin and falsy for `null`, `false`, `''`, and `0`. For the concrete class, a falsy result skips both its conventional sheet and its inline `css()` collection. Parent iterations still run when eligible. Additional `styles` are collected later and are not disabled by that decision.

Applications derive their own conventional CSS filename from `data-controller`: `index.js`, `index.src.js`, and `index.min.js` produce `index.css`. Other component ancestors use `index.css`.

## Skinning without an own default stylesheet: `static skin = null`

`static skin = null` is an intentional skinning feature. It lets a component participate in an inherited or explicitly supplied visual design without requesting its own conventional `index.css`.

For example, a specialized card can reuse its parent's markup and eligible styles, then supply a separate theme sheet:

```javascript
namespace `ui.cards` (
  class CompactCard extends ui.cards.ProfileCard {
    static skin = null;
    styles = ['compact-theme.css'];

    html() {
      return super.html();
    }
  }
);
```

Here the parent `ProfileCard` must already be imported/registered. The child does not request its own conventional `CompactCard/index.css`; its explicit theme resolves to `src/ui/cards/CompactCard/compact-theme.css`. Eligible parent styles remain, and the additional theme is adopted after the inherited sheets.

Important distinctions:

- `null` does not mean “remove all styling.” Explicit `styles`, `.stylesheets.add()`, and opted-in document sheets remain available.
- It does not automatically inherit the parent template. The example explicitly delegates `html()` for that reason; without the override, the child still has its own conventional HTML provider.
- A named skin such as `'dark'` selects the class's `skins/dark/` assets; `null` opts out of its default stylesheet rather than selecting a named directory.
- The static value is inherited. A further subclass can declare `static skin = undefined` to restore its ordinary default skin, or a name to select a named skin.
- The current implementation also skips the concrete class's `css()` collection. That observed interaction is separate from the confirmed purpose of the feature; its intended contract is still awaiting clarification.

## `css()`

Define a **prototype method** returning CSS text:

```javascript
css() {
  return `
    :host {
      display: block;
      color: ${this.accent || 'rebeccapurple'};
    }
  `;
}
```

Collection walks class prototypes and checks for an own `css` method. It calls that method with the actual component instance as `this`. An instance arrow-function field such as `css = () => '…'` is not found by this collection path; use method syntax.

For each eligible ancestor, its inline CSS is placed after that ancestor's conventional stylesheet. The concrete class's `csstext` value governs inline collection across the ancestry. Setting `static csstext = false` leaves external sheets and `styles` enabled.

CSS text is evaluated during connection-time stylesheet collection. Changing a field later does not regenerate the sheet, and calling `render()` alone does not rerun stylesheet collection. Use CSS custom properties or explicitly managed stylesheet changes for live styling.

## `styles`

```javascript
styles = ['shared.css', './assets/overrides.css'];
```

Defaults to `null`. During connection, entries not already present in `stylesheets` are appended to that collection, then adopted in collection order. Use an array or other intended iterable; a string by itself would be iterated character by character.

Appending to `styles` after connection does not automatically load the new value. This field is not an observed collection. If a subclass declares its own `styles` field, ordinary JavaScript field replacement applies; Cocoon does not separately merge every ancestor's `styles` field.

### Entry resolution

Assume page `/demo/index.html`, project root `/demo/`, source `/src/`, and component `ui.ProfileCard`:

| Entry | Resolves against |
| --- | --- |
| `'extra.css'` | `/demo/src/ui/ProfileCard/extra.css` |
| `'themes/dark.css'` | `/demo/src/ui/ProfileCard/themes/dark.css` |
| `'./extra.css'` | Page base: `/demo/extra.css` |
| `'../shared.css'` | Page base: `/shared.css` |
| `'/assets/reset.css'` | Origin root |
| `'https://example.com/theme.css'` | That absolute URL |
| A constructed `CSSStyleSheet` | Adopt the same object directly |

The key distinction is the prefix, not simply the presence of a slash. A relative path beginning with neither `.` nor `/` is namespace-relative. These explicit entries do not automatically acquire the named skin's directory.

## `stylesheets` and `.add(sheet)`

`stylesheets` is an instance-owned array augmented with `.add()`. `.add()`:

1. Ignores a value already present according to array identity/equality.
2. Prepends a new value to the collection.
3. If initial loading has completed, starts loading/adopting it at the document-sheet boundary, before component-owned sheets.

```javascript
this.stylesheets.add('foundation.css');
```

A late add remains a lower-priority foundation. It does not become the final override merely because it loaded later. Two consecutive additions are prepends: adding A then B places B before A.

`.add()` returns `undefined`, not a loading promise. `await this.stylesheets.add(...)` does not wait for stylesheet loading. Direct `.push()` changes the array only and does not trigger the late-loading behavior.

Deduplication checks the original input value, not canonical resolved URLs. Two different strings pointing to the same resource are not guaranteed to deduplicate. Repeated adoption through lower-level methods can insert the same sheet more than once.

## Cascade order

For a parent and child that each have a conventional sheet and a `css()` method, the normal initial sequence is:

```text
accepted document sheets
parent index.css
parent css()
child index.css
child css()
additional styles[0], styles[1], …
```

The implementation walks descendants toward ancestors but prepends ancestral inputs, producing the parent-before-child result. `.add()` and any custom collection modifications can change positions as described above.

This sequence describes the normal adopted-sheet path, such as a shadow root. The current light-root style-element path deduplicates by class namespace and can skip later sheets for that class; see [light-DOM styling limits](light-and-shadow-dom.md#light-dom).

This is **source order**, not a promise that the last sheet always wins. Specificity, importance, cascade layers, and shadow-boundary rules still participate. Do not describe the ordering as overriding every other CSS priority.

## Light DOM and shadow DOM

For shadow components, rules are adopted into the shadow root and `:host` remains native CSS.

For conventional light-DOM component sheets, Cocoon rewrites host selectors toward the ancestor's class name. For inline CSS, `onTransformStyle(cssText, cls)` performs text replacement when `inShadow()` is falsy:

```css
:host {
  display: block;
}            /* becomes .ProfileCard */
:host(.selected) {
  color: green;
}   /* becomes .ProfileCard.selected */
```

Connection adds ancestor class names to the host or wrapped application body. Other selectors are not automatically prefixed; this is not a full CSS scoping compiler. A plain `button { … }` rule in document-level CSS can affect unrelated buttons.

Use `:root` for application/document-wide rules. Do not depend on host-selector rewriting as an application styling convention.

The conventional-sheet rewrite inspects top-level CSS rules with `selectorText`; do not assume equivalent rewriting for every nested at-rule. Additional sheets loaded through `styles` follow their own import path and do not receive the same conventional-sheet rewriting step.

## `shouldAdoptDocumentStyleSheets()`

Defaults to `false`. Override to select document sheets published through Cocoon's stylesheet signal:

```javascript
shouldAdoptDocumentStyleSheets() {
  return ['tokens.css', /\/icons\//];
}
```

| Return value | Meaning |
| --- | --- |
| `false` or another falsy value | No subscription/adoption. |
| `true` | Accept all announced sheets. |
| String | Match a substring of `sheet.url || sheet.href || ''`. |
| RegExp | Test that URL string. |
| Array of strings/RegExps | Accept when any entry matches. An empty array matches nothing. |
| Function | Invoke with the sheet and use the returned truthiness. |

Use non-global, non-sticky regular expressions for repeatable matching; the implementation calls `.test()` directly and does not reset `lastIndex`.

For the application's default stylesheet, prefer the kernel script's **`data-adopted-stylesheet="index.css"`** attribute. It starts adoption during boot after import-map setup, publishes the sheet for component sharing, and avoids waiting for application connection to request it. See [early boot stylesheet adoption](application.md#early-boot-stylesheet-data-adopted-stylesheet). Additional shared sheets can use application `styles`.

### Shared design systems and icon fonts

Use this hook to share application-published design-system rules with participating shadow components. The application loads the shared CSS through its `styles` collection; each component selects the sheets it needs:

```javascript
// In your Application subclass:
styles = ['./assets/design-system.css', './assets/icons.css'];
```

```javascript
// In a Component subclass:
inShadow() {
  return true;
}

shouldAdoptDocumentStyleSheets() {
  return ['design-system.css', 'icons.css'];
}
```

This can supply shared typography classes, button/form styling, layout utilities, resets, icon classes, and reusable animation rules inside shadow roots. Each component opts in; arbitrary page styles do not automatically penetrate every component. An application-defined base component can centralize this policy for its descendants.

For icon fonts, make the font-face definition available at document level and adopt the CSS that applies the icon font and glyph/pseudo-element rules inside each participating root. Components can then use icon markup without repeating a library link or import in every template. The font files must still be available and successfully load; adoption shares CSS rather than embedding the font assets.

Ordinary inheriting CSS custom properties can already flow from document/host into shadow content. Adoption is especially useful for the **selector rules** that consume those tokens, since document selectors do not themselves match inside shadow roots. A document `:root` token rule is not automatically rewritten to `:host` by adoption.

The same constructed sheet object is reused across adopters rather than copied into separate style tags. This supports a common visual foundation with component-specific overrides and shared-rule updates. It does not promise a fixed network-request count or automatic propagation of document sheet replacement/removal.

The planned guide will cover a complete token/theme/icon example and verify font URLs, third-party CSS compatibility, late component connection, and local overrides.

### Publication, replay, and placement

The component first adopts its own sheets, then subscribes to `stylesheet:adopted`. Previously announced events replay synchronously; future events arrive while connected. Accepted sheets are inserted in a leading document-sheet segment, ahead of owned sheets. Identity checks prevent adopting the same announced sheet twice in that root.

The publisher must announce the sheet. Cocoon's application/document loading paths do so. Merely pushing a sheet into `document.adoptedStyleSheets`, or adding an ordinary `<link>`, is not equivalent to publishing it through Cocoon. This method does not scan arbitrary document stylesheets on demand.

The adopted sheet is shared by reference rather than copied. Altering that object affects roots that adopted it. URL filters need a meaningful `url` or `href`; an anonymous constructed sheet generally has neither unless the publisher supplies metadata.

Framework disconnection removes the subscription. Removing or replacing a sheet in the document does not automatically remove an already adopted copy/reference from every component: there is no mirrored removal event in this path. Changing the filter later is also not an automatic reconciliation operation.

## Import and fallback limits

The importer first tries a CSS module import when its feature gate permits, then falls back to fetching text and constructing a sheet. A failed module import may therefore log a warning even if the fallback succeeds.

The text fallback does not explicitly reject non-successful HTTP status before constructing CSS. Connection-time conventional import failures are warned; additional stylesheet failures are logged. Neither path is a guarantee that every stylesheet error rejects component connection.

For an ordinary light-DOM host without adoptedStyleSheets, the runtime installs a style element in the document head. Cocoon supplies an innerText getter on constructed stylesheets to serialize their rules for this path. Chrome checks confirm conventional host-rule rewriting and installation. The per-namespace deduplication can skip subsequent same-class sheets; multi-sheet parity with shadow roots is not currently established.
