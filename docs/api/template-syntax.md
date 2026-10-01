# Template syntax: JavaScript inside HTML

Cocoon templates can calculate and return complete sections of markup using ordinary JavaScript: expressions, local variables, conditionals, loops, array operations, nested template literals, helper methods, and awaited work. The language is not limited to substituting a field into an HTML string.

The HTML file is interpreted by Cocoon's built-in parser. Inside its markers you write native JavaScript rather than a separate expression language. These markers are Cocoon syntax; browsers do not evaluate them in ordinary HTML without the runtime.

This page focuses on what authors can write. [Templates and rendering](templates.md) explains provider selection, source caching, data context, declarative content, and rerendering.

## Two forms, two purposes

| Syntax | Use | Result |
| --- | --- | --- |
| `<%= expression %>` | Return one expression: a value, method call, ternary, generated string, or awaited result. | Expression result is interpolated into the output. |
| `<% statements %>` | Run a JavaScript function body with declarations, branching, loops, helper functions, and explicit returns. | The block's returned value is interpolated. |

```html
<template>
  <h2><%= this.heading %></h2>
  <p><%= this.items.length ? `${this.items.length} items` : 'No items' %></p>
  <%
    const available = this.items.filter(item => item.available);
    if (!available.length) return '<p>No available items.</p>';
    return `<ul>${available.map(item => `<li>${item.name}</li>`).join('')}</ul>`;
  %>
</template>
```

Examples with direct string insertion assume trusted example data. For values supplied by users, apply context-appropriate escaping; this parser returns HTML and does not automatically escape interpolated values.

## Complete example: asynchronous country picker

This pattern follows the real Arc2D MessageBar example: an asynchronous method, a component getter, a conditional prompt, and a generated list with selected state.

`src/components/CountryPicker/index.js`:

```javascript
namespace `components` (
  class CountryPicker extends Component {
    static tag = 'country-picker';

    async onConnected() {
      this._countries = [
        { code: 'US', name: 'United States' },
        { code: 'CA', name: 'Canada' },
        { code: 'AF', name: 'Afghanistan' },
        { code: 'AL', name: 'Albania' },
      ];
      await super.onConnected({ selectedCode: 'US' });
    }

    get countries() {
      return this._countries;
    }

    async greeting() {
      return 'Choose a destination';
    }

    inShadow() {
      return true;
    }
  }
);
```

`src/components/CountryPicker/index.html`:

```html
<template>
  <h2><%= await this.greeting() %></h2>
  <%= `<p><b>${this.countries.length}</b> countries available</p>` %>

  <label>
    Destination
    <select>
      <%
        const count = this.countries.length;
        if (count >= 3) {
          return `<option value="">Select from ${count} countries</option>`;
        }
        return '<option value="">Select a country</option>';
      %>

      <optgroup label="Countries">
        <%
          return this.countries.map(country => {
            const selected = country.code === this.selectedCode
              ? ' selected'
              : '';
            return `<option value="${country.code}"${selected}>${country.name}</option>`;
          }).join('');
        %>
      </optgroup>
    </select>
  </label>
  <slot></slot>
</template>
```

`src/components/CountryPicker/index.css`:

```css
:host {
  display: block;
}
label {
  display: grid;
  gap: .5rem;
}
select {
  font: inherit;
  padding: .5rem;
}
```

Import/register the controller through the application, then use `<country-picker></country-picker>`.

What this demonstrates:

- Data needed by the template is established **before** awaiting the base connection.
- `this.selectedCode` comes from the explicit template data; `countries` and `greeting()` are found through the component context.
- The awaited greeting completes before the rendered fragment is installed.
- A statement block can return different HTML for each branch.
- `map()` callbacks can themselves contain multiple statements and return markup.
- `.join('')` combines fragments without array commas.
- Static markup, computed sections, and a normal slot coexist in one template.

## Conditional sections and early returns

Use a complete statement block to choose an entire section:

```html
<%
  if (this.loading) return '<p role="status">Loading…</p>';
  if (this.items.length === 0) return '<p>No results.</p>';

  return `<ul>${this.items.map(item => `<li>${item.name}</li>`).join('')}</ul>`;
%>
```

Return `''` when a branch should produce no markup. A block that reaches its end without returning a value can insert the text `undefined`; a statement block is a function result, not an implicit output buffer.

A ternary is useful for short choices:

```html
<span class="<%= this.active ? 'status active' : 'status' %>">
  <%= this.active ? 'Active' : 'Inactive' %>
</span>
```

For a long branch with declarations, use `<% … %>` and `return` rather than treating `<%= … %>` as a general statement block.

## Loops and accumulators

`map().join('')` is convenient, but ordinary loops work as well:

```html
<%
  let rows = '';
  for (const [index, item] of this.items.entries()) {
    if (item.hidden) continue;
    rows += `<tr><td>${index + 1}</td><td>${item.name}</td></tr>`;
  }
  return `<table><tbody>${rows}</tbody></table>`;
%>
```

You can sort/filter/group data, compute totals, and build nested markup within a single block. Avoid mutating a shared source array merely to choose display order; for example, sort a copy when the original order belongs to application state.

### Nested collections

```html
<%
  return this.groups.map(group => {
    const visible = group.items.filter(item => !item.hidden);
    if (!visible.length) return '';

    const entries = visible.map(item => `<li>${item.name}</li>`).join('');
    return `<section><h3>${group.name}</h3><ul>${entries}</ul></section>`;
  }).join('');
%>
```

These are normal JavaScript template literals inside the block, not a second Cocoon rendering pass. `${…}` inside them evaluates in their JavaScript lexical scope.

## Local helpers and scope

Each marker pair becomes its own immediately invoked function. A block can define local helpers and use them throughout that block:

```html
<%
  const formatAmount = value => `$${value.toFixed(2)}`;
  const total = this.lines.reduce((sum, line) => sum + line.amount, 0);
  return `<strong>Total: ${formatAmount(total)}</strong>`;
%>
```

A `const` or `let` declared in one block is not visible in a sibling block. Blocks share access to `this`, but not each other's local variables.

This is **not** EJS-style open/close control flow:

```html
<!-- Do not split a loop across marker pairs like this: -->
<% for (const item of this.items) { %>
  <li><%= item.name %></li>
<% } %>
```

Instead, keep the loop and its returned markup in one block, or move the operation into a component helper. The workspace contains older `.ejs.html` examples; their syntax must not be confused with the current default parser.

## Calling component helpers

A template may call ordinary component methods or getters:

```html
<%= this.renderSummary() %>
<%= this.visibleItems.map(item => this.formatItem(item)).join('') %>
```

These names are example application-defined helpers, not built-in Cocoon methods. Keeping reusable formatting/filtering logic in the component can make a large template easier to read.

The parser binds `this` to the supplied data object, whose prototype normally points to the component. Own data values win over component fields. A helper invoked through this context also receives that data object as `this`; it does not automatically rebind to the underlying HTMLElement instance.

Therefore:

- Pure helpers and ordinary component getters reading plain fields work naturally, as the country getter demonstrates.
- Assigning `this.someValue` in a block/helper can write to the data object rather than the component. Do not use template evaluation as an implicit state-update mechanism.
- Helpers requiring native HTMLElement receivers, private class fields, or other receiver-sensitive operations need deliberate binding/design. Passing through the data prototype does not give an ordinary object a native element's internal state.
- Use normal lifecycle/event methods for interaction side effects. Keep rendering predictable across repeated calls.

## Asynchronous templates

```html
<%= await this.loadSummary() %>
```

Or use awaited work inside a larger block:

```html
<%
  const rows = await Promise.all(
    this.items.map(async item => {
      const label = await this.describeItem(item);
      return `<li>${label}</li>`;
    })
  );
  return `<ul>${rows.join('')}</ul>`;
%>
```

The current parser selects its async-function path when the source contains the exact substring `await `, including the trailing space. Use the demonstrated spelling; it is a source-text check, not a JavaScript syntax-tree analysis. An `await` separated from its expression only by a newline is not sufficient to select that path by itself.

On the async path, block evaluations are awaited in template order. Two successive awaited blocks are not automatically parallel. Use `Promise.all()` explicitly when independent operations should overlap.

Returning/interpolating a promise without awaiting it does not cause implicit promise resolution and can produce `[object Promise]`. Returning an array of strings without joining it can insert commas. Both follow the string-evaluation model.

An awaited failure rejects parsing/rendering; Cocoon does not automatically render a loading or error component. Fetch once in connection logic when the result should be retained, or catch an expected error inside the block and return explicit fallback markup. Repeated template evaluation can repeat helper calls and network side effects even though template **source** is cached.

## Attributes and generated elements

Quoted value expressions work for strings:

```html
<a href="<%= this.destination %>" class="<%= this.linkClass %>">
  <%= this.linkLabel %>
</a>
```

HTML boolean attributes are based on presence. `disabled="false"` still disables a button. Generate the whole optional attribute or whole element:

```html
<%= `<button type="button"${this.busy ? ' disabled' : ''}>Save</button>` %>
```

Current delimiter parsing consumes one or more `>` characters after `%`. If a marker ends immediately next to the tag's closing `>`, the parser can consume both. For a bare optional attribute, separate the delimiter from the closing bracket:

```html
<input type="checkbox" <%= this.checked ? 'checked' : '' %> >
```

Do not write the final characters as `%>>` and assume the second bracket is preserved. Quoted attribute expressions and whole-element output avoid this adjacency. This is a verified parser edge case, not an HTML requirement.

Generated custom-element markup is real DOM once the fragment is inserted. In an explicit application, import its controllers. In fallback sandbox mode, [autodiscovery](component-autodiscovery.md) can discover generated undefined tags; awaiting the parent render is not a blanket wait for all children's asynchronous connections.

## Direct `${…}` and literal text

The default evaluator ultimately builds a JavaScript template literal, so direct `${this.message}` interpolation also evaluates on ordinary template-source paths. The `<% … %>` forms remain the clearer documented delimiters, particularly because declarative-content marker detection looks for those forms rather than every `${…}` occurrence.

Text containing raw backticks, `${…}`, or delimiter-like sequences can be interpreted by the evaluator rather than displayed literally. The implementation is regex/template-literal based, not a token-aware HTML/JavaScript compiler. Do not assume those characters inside code samples or strings are automatically escaped. Verify literal-display use cases separately or insert such text using native textContent after rendering.

## HTML output and escaping

An expression can deliberately return `<b>…</b>` and produce an element; this is a key part of composing rich markup. It also means there is no automatic escaping of untrusted values.

Use a context-appropriate escaping helper for user text, validate URL/attribute values according to their destination, or insert untrusted text through `textContent`. An escaping helper is application code, not a Cocoon built-in. Templates themselves are executable application code and should not be accepted as arbitrary user-authored strings.

## Example: display a customer comment as text

For a comment preview, keep the template static and assign the untrusted value through `textContent`. This avoids HTML interpretation without introducing an undocumented escaping API:

```javascript
namespace `components` (
  class CommentPreview extends Component {
    static tag = 'comment-preview';
    static skin = null;
    inShadow() {
      return true;
    }

    html() {
      return `
        <template>
          <p class="comment"></p>
        </template>
      `;
    }

    async onConnected() {
      await super.onConnected({ comment: '<img src=x onerror="alert(1)">' });
    }

    onRendered() {
      this.root.querySelector('.comment').textContent = this.data.comment;
    }
  }
);
```

After importing this controller, `<comment-preview></comment-preview>` displays the literal `<img …>` text, without creating an image. To update it, assign `preview.data.comment` and call `await preview.render()`. This example uses persistent `this.data`; passing temporary data to `render(otherData)` does not replace that property.

Use the same approach for user names, comments, and search results. Rich user-authored HTML needs a deliberate sanitization policy; text escaping alone does not validate links or make executable template source safe.

## Rendering again

```javascript
this.data = { selectedCode: 'CA' };
await this.render();
```

This reevaluates cached source with current data and component context. It does not automatically rerun the `html()` provider, rebuild CSS, or reconcile node identity. See [rendering contracts](templates.md#renderdata--thisdata) for the complete branch/timing behavior.
