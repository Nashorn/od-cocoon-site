# Watching inputs

## `watch(object, property, callback = null, force, engine)`

Connects an object's `input` and `change` events to a callback through Cocoon's default watcher. It is **not** general property reactivity: assigning `object[property]` does not itself trigger the callback.

## Example: search a contact list

Save this controller as `src/components/ContactSearch/index.js`, import it through your application, and use `<contact-search></contact-search>`. The inline template and `skin = null` make separate HTML/CSS files unnecessary.

```javascript
namespace `components` (
  class ContactSearch extends Component {
    static tag = 'contact-search';
    static skin = null;
    inShadow() {
      return true;
    }

    html() {
      return `<template>
        <label>Search contacts <input type="search" name="search"></label>
        <p role="status"></p><ul></ul>
      </template>`;
    }

    onRendered() {
      this.searchWatch?.unwatch();
      const contacts = ['Ada Lovelace', 'Grace Hopper', 'Katherine Johnson'];
      const list = this.root.querySelector('ul');
      const status = this.root.querySelector('[role="status"]');
      this.searchWatch = this.watch('input[name="search"]', 'value', change => {
        const query = (change.value ?? '').trim().toLowerCase();
        const matches = contacts.filter(name => name.toLowerCase().includes(query));
        list.replaceChildren(...matches.map(name => {
          const row = document.createElement('li');
          row.textContent = name;
          return row;
        }));
        status.textContent = matches.length ? `${matches.length} contacts` : 'No contacts found.';
      });
    }

    async onDisconnected() {
      this.searchWatch?.unwatch();
      this.searchWatch = null;
      await super.onDisconnected();
    }
  }
);
```

All three contacts appear immediately because `force` defaults to true. Type **grace** to see one match, or **zzz** for the empty state. The search field keeps its focus and value because the callback updates only the list and status; it does not rerender the whole component. Names are inserted with `textContent`, so text cannot become HTML.

`onRendered()` releases the old watch and binds the newly rendered input. Disconnecting releases it too. Assigning `input.value` from code alone does not notify this watcher; dispatch an appropriate native event or call your own update logic explicitly.

### Arguments and resolution

| Argument | Behavior |
| --- | --- |
| `object` | Object to read. If a string, resolved once through `this.querySelector()`. |
| `property` | Property name read from that object. |
| `callback` | Receives the watcher data object. |
| `force` | Defaults to `true` in the default engine when omitted; with a callback, immediately deliver the initial data. Set `false` to wait for an event. |
| `engine` | Defaults to the framework watcher; custom engines receive `(object, property, callback, force, component)`. |

If a selector has no match, `watch()` returns `undefined`; it does not wait for the input to appear. Use `find()` first for delayed inputs.

### Callback data

| Field | Initial callback | Later input/change callback |
| --- | --- | --- |
| `object` | Original watched object | Same object |
| `prop` | Property name | Same name |
| `old` | Value at subscription | Still the initial value; not a rolling previous value |
| `val`, `value` | `object[property] || null` | Actual current property value |
| Named property, e.g. `value` or `checked` | Not generally added separately at initialization | Assigned as `data[property] = data.value` |

Initial falsy values such as `''`, `0`, or `false` are represented as `null` in `val`/`value`. Later events preserve the actual falsy value. The engine reuses one callback data object; copy fields if you need historical snapshots.

### Lifetime and limitations

The returned handle has `unwatch()`, which removes both native listeners. Store it and call it during cleanup; base component disconnection does not automatically do this for you.

A plain object without `addEventListener` can receive the forced initial callback, but no later assignment notifications. The default handle still attempts `removeEventListener` during cleanup, so ordinary plain objects are not the intended observation target.

Provide a callback in general-purpose component code. The no-callback event path assigns `component.value[object.id]`; it assumes your component has initialized that storage. Cocoon does not create a universal form model for it.

A custom engine can define different behavior, but that must be documented as the engine's contract rather than attributed to the default watcher.
