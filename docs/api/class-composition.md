# Class composition with `.with()`

Cocoon's `Base.with(...mixins)` creates a subclass of Base and copies selected property descriptors from the supplied mixins onto that intermediate class and its prototype. Your final class can extend the result.

```javascript
class Combined extends Base.with(SelectionBehavior, FormattingBehavior) {}
```

This lets independent capabilities be reused without forcing them into one deep inheritance hierarchy. It is descriptor-based composition, not multiple inheritance and not automatic construction of every mixed-in class.

## A reusable behavior

```javascript
class SelectionBehavior {
  initializeSelection(initial = null) {
    this._selectedId = initial;
  }

  select(id) {
    const previous = this._selectedId;
    this._selectedId = id;
    return { previous, current: id };
  }

  get selectedId() {
    return this._selectedId;
  }
}

class Formatter {
  formatSelection() {
    return this.selectedId === null ? 'Nothing selected' : `Selected: ${this.selectedId}`;
  }
}

class SelectionModel extends Object.with(SelectionBehavior, Formatter) {
  constructor() {
    super();
    this.initializeSelection();
  }
}

const model = new SelectionModel();
model.select('account');
console.log(model.formatSelection()); // Selected: account
```

SelectionBehavior explicitly initializes the state it needs; Formatter expects the selectedId interface. The mixins are ordinary JavaScript classes that supply methods/getters. They do not need to extend Component or be namespace-registered to be passed to `.with()`.

## Use the same capability in a component

```javascript
namespace `components` (
  class SelectableCard extends Component.with(SelectionBehavior, Formatter) {
    static tag = 'selectable-card';
    static skin = null;

    html() {
      return `
        <template>
          <button data-id="account">Account</button>
          <output></output>
        </template>
      `;
    }

    async onConnected(data) {
      this.initializeSelection();
      await super.onConnected(data);
      this.on('click', event => {
        const change = this.select(event.matchedTarget.dataset.id);
        this.querySelector('output').textContent = this.formatSelection();
        this.fire('selection:changed', change);
      }, false, 'button[data-id]');
    }
  }
);
```

The host owns lifecycle and signals, while the mixins provide selection/formatting behavior. These are application-defined helpers, not Cocoon APIs. The example resets selection on each connection deliberately; retain state differently if reconnection should preserve it. `skin = null` avoids requesting an otherwise unnecessary conventional stylesheet for this small example.

## What gets composed

For a class/function mixin, the implementation copies descriptors from its **own prototype properties**, then its **own static properties**. For an object mixin, it copies the object's own descriptors onto the intermediate prototype; it also passes the object through the static-copy step.

Getters/setters remain accessors; methods remain functions. Values are not deep-cloned, and inherited mixin methods are not recursively flattened into the destination.

```javascript
const TimestampBehavior = {
  stamp() {
    this.updatedAt = Date.now();
  },
  get hasTimestamp() {
    return this.updatedAt !== undefined;
  },
};

class Record extends Object.with(TimestampBehavior) {}
```

An object holding mutable values can therefore share those values through the destination prototype. Prefer explicit per-instance initialization for arrays, maps, and other mutable state.

## Construction and state

| Concern | Behavior |
| --- | --- |
| Base constructor | Runs normally through the generated subclass and super(). |
| Mixin constructors | Not invoked. |
| Mixin instance field initializers | Not copied or executed. |
| Explicit initialization methods | Copied when eligible; your host calls them. |
| Private fields/brands | Not installed by descriptor copying. A copied method accessing its class's private fields can throw on the composed instance. |
| Method receiver | The composed instance, not a separate mixin object. |

A field such as `items = []` in a mixin does not initialize items in the composed host. Replacing it with an explicit `initializeItems()` gives the host control over timing and ownership.

For native HTML element bases, Cocoon has a special constructor path that calls `initialize()` automatically. That supplies the customized-built-in integration described in [customized built-in elements](customized-built-in-elements.md); it does not mean arbitrary mixin constructors or fields are executed.

## Collision order

Mixins are applied left to right. Later copied members normally override earlier ones with the same key, and copied prototype members can shadow inherited base members. Your final subclass can provide its own method to override the intermediate class.

```javascript
class A {
  label() {
    return 'A';
  }
}

class B {
  label() {
    return 'B';
  }
}
class Host extends Object.with(A, B) {}
new Host().label(); // B
```

Descriptors retain their flags. A non-configurable copied property can make a later redefinition throw; “last wins” is not a blanket promise that every conflicting descriptor is redefinable. There is no automatic collision warning, renaming, or merged return value.

The same order applies to eligible static members. Be especially deliberate if a mixin defines component settings such as tag, inline, or skin, or hooks such as onConnected: overwriting one can change registration or lifecycle behavior.

## `super` and `instanceof`

The composed host is an instance of Base. It does not become an instance of every mixin class merely because their descriptors were copied.

A method's `super` binding retains its original JavaScript home-object chain. It is not rebound to the previously applied mixin or the newly selected Base. Consequently `.with(A, B)` does not create an automatic A-then-B cooperative super chain.

For lifecycle composition, prefer non-conflicting helper names called by one owning onConnected/onDisconnected method. Explicitly initialize and clean up each capability instead of assuming all mixed-in lifecycle methods will run.

## Members deliberately not copied

The reflector excludes symbol keys and string keys matching its reserved-name pattern: Symbol, namespace, constructor, ancestor, classname, prototype, name, or length. The implementation matches those substrings, not only exact names.

Consequences include:

- A Symbol.iterator method is not copied.
- Constructors and class identity metadata are excluded.
- A helper name containing a reserved substring can be omitted even if it seems otherwise ordinary.
- A mixin's inherited methods are absent unless they are available through some other part of the destination's existing chain.

Keep capability interfaces explicit and verify essential members rather than assuming that every conceivable class feature is copied. Internal trait metadata is not a substitute for native type identity.

## Benefits and trade-offs

**Benefits:** reuse orthogonal behavior across different base classes; retain native base identity; share getter/setter interfaces; avoid duplicating utility logic; make capability initialization explicit.

**Trade-offs:** ordering and name collisions become part of the design; constructors/fields/private brands do not transfer; source super semantics can surprise; mutable descriptor values may be shared; component lifecycle hooks still need a clear owner.

Each `.with()` call creates another intermediate class. Define reusable compositions once at module/class declaration time rather than rebuilding them for each instance. It is a JavaScript composition facility; it does not add workers, reactive state, dependency injection, module loading, or automatic resource disposal.

Use ordinary inheritance for a coherent specialization with a natural super chain. Use `.with()` for small capabilities with clear prerequisites and non-conflicting interfaces. Combining both is supported when ownership remains explicit.
