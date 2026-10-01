# Namespaces and imports

Cocoon namespaces organize classes and register them for framework lookup. Browser modules/import maps determine which JavaScript files are loaded. These are related but separate mechanisms: declaring a namespace does not fetch its files.

## Register a component class

```javascript
namespace `ui.cards` (
  class ProfileCard extends Component {
    static tag = 'profile-card';
  }
);
```

The namespace helper places the class at `ui.cards.ProfileCard` on the global namespace tree and records its qualified name for lookup. Registration also invokes the class's definition support, which registers its custom element.

Use the containing namespace (`ui.cards`), with the class name supplied by the class declaration. Do not redundantly append the class name to the namespace argument and expect identical naming: the implementation has special handling for namespace strings ending in an uppercase class-like segment, which can produce a different qualified path. The conventional directory is `src/ui/cards/ProfileCard/`.

Namespace registration returns the registered class. This enables a module to both register the component and explicitly export its value:

```javascript
export default namespace `ui.cards` (
  class ProfileCard extends Component {
    static tag = 'profile-card';
  }
);
```

The `export default` is a JavaScript module export chosen by this file; the namespace helper does not automatically synthesize every kind of module export.

## Side-effect import versus value import

In `.importmap`:

```json
{
  "imports": {
    "ui.cards.ProfileCard": "./src/ui/cards/ProfileCard/index.js"
  }
}
```

To load/register a component whose class is used through its namespace or tag:

```javascript
import 'ui.cards.ProfileCard';
```

To bind the class locally when that module explicitly exports it:

```javascript
import ProfileCard from 'ui.cards.ProfileCard';
```

The second form requires a default export; a side-effect-only namespace declaration is not enough. Likewise, a named import requires a matching named JavaScript export. A namespace property and an ES module export are not interchangeable.

A subclass can use either the local imported class binding or the loaded qualified class:

```javascript
import 'ui.cards.ProfileCard';

namespace `ui.cards` (
  class CompactCard extends ui.cards.ProfileCard {
    html() {
      return super.html();
    }
  }
);
```

This import is required before the superclass is evaluated. The inheritance declaration does not asynchronously load a missing superclass.

## Import-map startup

Cocoon's boot initialization:

1. Looks for the first `script[type="importmap"]` in the document head.
2. Uses its trimmed content if nonempty.
3. Otherwise fetches `.importmap` using the configured project-root prefix, replaces an empty map script if present, and appends a populated map script.
4. Parses the JSON and stores its `imports` mapping for framework access.
5. Allows controller preloading, application loading, and early stylesheet adoption to proceed after that initialization promise resolves.

A small standalone page can provide an explicit empty map when it has no bare imports:

```html
<script type="importmap">{"imports":{}}</script>
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel data-rootpath="./"></script>
```

The browser resolves module specifiers. Cocoon does not implement a second custom import evaluator for namespace strings. Relative values in the inserted import-map script use the document's base URL; do not assume that fetching `.importmap` from another directory changes that native resolution base. Use paths appropriate to the page/base or absolute root paths for nested page layouts.

## Failures and timing

- An invalid map is logged by initialization; the initialization function catches the error instead of permanently rejecting the boot wait. Later module imports can still fail because the required mapping is missing.
- A whitespace-only fetched body becomes an empty JSON object. A non-JSON error page does not become a usable map.
- The fetch path does not explicitly reject HTTP status before reading/parsing its body. A correct server response matters.
- Reassigning the framework's stored map object is not an API for changing browser module resolution after imports have started.
- Importing a module again normally follows browser module caching; it is not a component hot-reload contract.

The script attribute `data-import-maps` is mapped, but the current disable check tests truthiness of its string value. Do not recommend `data-import-maps="false"` as a reliable disable switch without reconciling that implementation behavior. An explicit inline map is the straightforward documented path for a self-contained page.

## Namespace-driven naming and inheritance

The qualified class name influences generated tags and default asset paths. An explicit `static tag` changes the tag without changing those paths. A subclass gets its own generated tag and default template provider unless it explicitly chooses otherwise; imported inheritance does not mean assets are merged automatically.

See [component tag names](component.md#tag-names), [template inheritance](templates.md#html-and-explicit-inheritance), and [stylesheet inheritance](styling.md).

## Registration limits

Custom-element definitions are page-global per registry. A registered tag is not replaced by a second declaration, and the namespace helper also guards already-registered component classes under the same qualified name. Do not use repeated namespace declarations as an update API.

## Ordinary classes and class lookup

Namespaces also organize ordinary non-UI classes:

```javascript
const Money = namespace `models` (
  class Money {
    constructor(amount) { this.amount = amount; }
    doubled() { return this.amount * 2; }
  }
);

const value = new models.Money(10);
console.log(value.doubled()); // 20
console.log(Money === models.Money); // true
```

`classof('models.Money')` looks up a registered class and returns undefined for a missing name. It does not import a missing module. Unlike component custom-element registration, ordinary class names are not themselves HTML tag declarations.

For reusable behavior composed onto a chosen base, see [class composition with .with()](class-composition.md). Composition and namespace placement are independent: a composed class can then be namespace-registered like any other class.
