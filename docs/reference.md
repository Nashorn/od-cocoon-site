# Cocoon: A web component kernel

Cocoon is a flexible web component framework designed for creating dynamic, modular web applications. The framework provides support for creating custom HTML elements, managing namespaces, inheritance, lazy loading, and shadow DOM management.

## Native DOM Integration

Cocoon enables streamlined development through a modular component architecture that separates concerns into three distinct parts:

- HTML Templates for structure and markup
- CSS Stylesheets for presentation and theming
- JavaScript Controllers for behavior and logic

At runtime, the kernel efficiently assembles these parts into unified component instances that initialize directly in the DOM as custom web components. This architecture eliminates intermediate abstractions, there's no virtual DOM, no diffing algorithms, and no background reconciliation processes. The result is a lean, high-performance rendering pipeline with minimal overhead and exceptionally fast paint times. This bare-metal approach delivers superior performance by working directly with the browser's native rendering capabilities.

## Quick Start

```bash
npm install github:Nashorn/od-cocoon#8.6.0
```

Create one component:

```
index.html
src/components/HelloWorld/
  index.js
  index.html
```

`index.html`:

```html
<script src="node_modules/od-cocoon/framework.src.js" data-kernel></script>

<hello-world></hello-world>
```

`src/components/HelloWorld/index.js`:

```javascript
namespace `components` (
  class HelloWorld extends Component {
    static tag = "hello-world";
  }
);
```

`src/components/HelloWorld/index.html`:

```html
<template>Hello world</template>
```

```bash
npx http-server ./ -o index.html
```

Cocoon discovers `<hello-world>`, imports its controller, and renders its template.
Tags added later or rendered inside another component are discovered too.

> This is a sandbox shortcut for quick tests and standalone demos. For an application,
> add an explicit Application and import map.

### Application setup

Add an Application controller and `.importmap`:

```json
{
  "imports": {
    "components.HelloWorld": "./src/components/HelloWorld/index.js"
  }
}
```

`src/applications/MyApplication/index.js`:

```javascript
import "components.HelloWorld";

namespace `applications` (
  class MyApplication extends Application {}
);
```

Connect the page to it:

```html
<script src="node_modules/od-cocoon/framework.src.js"
        data-kernel
        data-namespace="applications.MyApplication"
        data-controller="index.js"></script>

<body namespace="applications.MyApplication">
  <hello-world></hello-world>
</body>
```

The explicit Application owns startup and imports. Automatic discovery only runs for
the fallback Application, so existing applications retain their behavior.

### Where to go next

- [Import Maps](#import-maps) - grouping components so several import from one specifier
- [CSS Loading](#css-loading) - skins, `styles`, inline `css()`, and which one wins
- [Document-Level Stylesheets](#document-level-stylesheets) - share a font or token file across components
- [Template Inheritance](#template-inheritance) - explicitly reuse the nearest parent template
- [Advanced Templating](#advanced-templating) - passing data in, loops and logic in markup
- [Event-Bus Signaling Architecture](#event-bus-signaling-architecture) - `fire()` / `subscribe()` between components that do not know each other
- [Kernel Configuration](#kernel-configuration) - every boot attribute

## What's New

### v8.6.x

- **Automatic component discovery:** Without a custom Application, component tags are discovered and imported from the default `components` namespace—even when added later or rendered inside another component. Configure sandbox namespaces with `data-sandbox`, or disable the sandbox with `data-sandbox="false"`.
- **Template inheritance:** A subclass loads its own `index.html` by default. Use `html() { return super.html() }` to explicitly inherit the nearest parent's file or inline template. Cocoon does not probe missing files or fall back after a 404.

### v8.5.x

NOTE: Anchor links not supported in BitBucket

- [Document stylesheets, adopted by choice](#document-level-stylesheets): A component decides which document-level sheets it pulls into its shadow root - all of them, or only those matching a name, pattern or predicate.
- [Publish a shared sheet from the app](#publishing-a-document-level-stylesheet): An `Application`'s root IS the document, so `styles = [url]` there adopts at document level and announces it to every component that opted in. One request for an icon font or a token file, instead of one per component.
- [`styles` accepts absolute and page-relative entries](#declarative-custom-stylesheets): Not just filenames resolved against the component's namespace folder.
- [Late `stylesheets.add()` now works](#api-custom-stylesheets-files): A call made after the component connected used to be a silent no-op. It now adopts the sheet immediately.
- [Reliable delivery](#document-level-stylesheets): Components previously took a one-time snapshot of `document.adoptedStyleSheets` at connect time, so a sheet still being fetched was missed permanently - intermittently, depending on cache timing. They now subscribe.
- [Kernel boot configuration documented](#kernel-configuration): Script attributes and the `Config{}` block, including `ADOPTED_STYLESHEET`.

### v8.0.x

- [Compatibility/support for latest Safari and Firefox](#css-loading): Improved importCSS polyfill for dynamic stylesheet loading.
- [New .find() method](#custom-elements): Supports deep shadowRoot selectors (>>>) and returns a promise that resolves when the element is found.
- **New .findAll() method**: Returns all matching elements, including support for deep shadowRoot selectors (>>>), as a promise.
- **Improved querySelectorAll**: Now supports `>>>` shadowroot selectors for deep querying across shadow DOM boundaries.
- [CSS :state(connected) support](#styling-host-components-with-stateconnected): Components now have a `:state(connected)` selector that can be styled for connected state.
- [Small kernel](#v80x): No virtual DOM, no diffing, no reconciliation - the kernel ships as a single file with no runtime dependencies.
- [Improved support for custom built-in elements](#custom-elements): Use `extends .with(IHtmlComponent)` for advanced custom element inheritance.
- [Full ESM compliance](#v80x): Fully interoperable with modern JavaScript modules (ESM) and build systems.
- [cssStyle() is now css()](#inline-custom-stylesheets): The method for inline CSS should now be named `css()`. `cssStyle()` is deprecated and will be removed in a future release.
- [template() is now html()](#advanced-templating): The method for supplying a component's template should now be named `html()`. `template()` is deprecated and will be removed in a future release.
- [Declaring Components Outside of a Namespace](#declaring-components-outside-of-a-namespace): You can now define and register components without using a namespace.
- **Revamped event-bus signaling architecture**: New global event-bus for robust, decoupled communication between components and modules.
- All documentation and examples now use `css()` and `html()`.

## Table of Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Installation](#installation)
- [Static Configurations in Components](#static-configurations-in-components)
- [Lazy Loading](#lazy-loading)
- [Declarative Shadow DOM](#declarative-shadow-dom)
- [Template Inheritance](#template-inheritance)
- [Namespaces](#namespaces)
- [Importing and Destructuring](#importing-and-destructuring)
- [Advanced Templating](#advanced-templating)
- [Styling Host Components with :state(connected)](#styling-host-components-with-stateconnected)
- [Import Maps](#import-maps)
- [Custom Elements](#custom-elements)
- [CSS Loading](#css-loading)
- [Document-Level Stylesheets](#document-level-stylesheets)
- [Kernel Configuration](#kernel-configuration)
- [Event-Bus Signaling Architecture](#event-bus-signaling-architecture)
- [Declaring Components Outside of a Namespace](#declaring-components-outside-of-a-namespace)
- [Troubleshooting](#troubleshooting)
- [Migration Notes for v7.2.x](#migration-notes-for-v72x)
- [License](#license)

NOTE: Anchor links not supported in BitBucket

## Features

- **Custom Web Components**: Create custom elements with extensive support for declarative or programmatic instantiation.
- **Namespace Management**: Organize components and logic using a hierarchical namespace system.
- **Class Inheritance**: Leverage inheritance to extend and modify components.
- **Skin Inheritance**: Components will inherit and adopt the skin (stylesheets) of all combined ancestors
- **Shadow DOM Support**: Use shadow DOM to encapsulate styles and logic, with optional declarative and lazy modes.
- **Lazy Loading**: Components can be lazily loaded to optimize performance.
- **Dynamic CSS Loading**: Supports loading external CSS or skins dynamically into components.

## Installation

```bash
npm install github:Nashorn/od-cocoon#8.6.0
```

Include Cocoon in your project:

```html
<script src="path/to/od-cocoon/framework.src.js"></script>
```

A real page passes the kernel its configuration on that same tag - which namespace to
boot, where the project root is, which stylesheet to adopt. See
[Kernel Configuration](#kernel-configuration).

## Static Configurations in Components

Cocoon components come with various static configuration options that allow developers to control component behavior. These configurations can be set on a per-component basis.

```javascript
namespace `ui.components` (
    class MessageBar extends WebComponent {
        static tag = "message-bar"; (Optional)
        static synchronous = true;  (Optional)
        static declarative = false; (Optional)
        static lazy     = true;     (Optional)         
        static skin     = null;     (Optional)         
        static inline   = true;     (Optional)  
        static extends  = "span";   (Optional)    
        static csstext  = true;     (Optional) 
    }
);
```

### Available Static Properties

- **`tag`**: (Optional) Defines the HTML tag name for the component. Cocoon defaults to the classname of the component with dashes as the tag, ex: MessageBar -> `<message-bar>`, unless `Config.USES_NAMESPACE_FOR_TAGNAMES` is `true`, then the tagname will be the full namespace with dashes, example: `<ui-components-message-bar>`.

- **`synchronous`**: (Optional) When set to true, the component's HTML and CSS are loaded synchronously using an XMLHttpRequest (XHR). By default, the framework uses the fetch API, which is non-blocking and provides better performance. The synchronous flag forces the assets (HTML and CSS) for the component to be loaded sequentially and synchronously, ensuring that they are fully available before proceeding with further execution. However, this process is blocking and can negatively impact overall performance by preventing other tasks from running in parallel during the load.

- **`declarative`**: (Optional) When set to true (default), the component prioritizes an inline declarative shadow DOM template (defined directly in the HTML) for rendering its markup. This means that if a shadow root template is provided within the HTML, it will be used instead of loading the component's external index.html template file. This approach improves performance by avoiding external file fetches and allows for better integration with the existing DOM structure. If declarative is false, the component will fallback to loading and rendering its template from the index.html file.

- **`lazy`**: (Optional) Enables lazy loading for the component, meaning the component will only be instantiated and connected to the DOM when it becomes visible in the viewport or when a user interacts with it. This defers resource loading, improving performance by reducing the initial load time. The lazy option can be applied at either the class level (affecting all instances of the component) or at the instance level, where it is specified as an attribute on individual components. This ensures that the component's resources are only loaded when necessary, optimizing both memory usage and rendering time.

- **`skin`**: (Optional) Defines the CSS skin for the component. If set to null, the component's default index.css file will not be loaded, effectively disabling any predefined styling. Alternatively, you can specify a custom skin by providing a name, which will load a corresponding CSS file, allowing for flexible and themeable styling options for the component.

- **`inline`**: (Optional) When set to true, the component bypasses the use of shadow DOM and renders its content directly into the light DOM as standard inline markup. In this mode, the component's styles and structure are not encapsulated, meaning they are exposed to global styles and DOM manipulations. This approach is useful when shadow DOM isolation is not needed, but it sacrifices the encapsulation benefits such as style and DOM scope isolation.

- **`extends`**: (Optional) See example below (Custom Elements). Allows extending built-in elements such as SPAN, 
  DIV, INPUT, SELECT and so on, using a custom component class definition.

- **`csstext`**: (Optional) true by default. Controls whether CSS styles defined through the css() method is processed and applied to the component. When enabled, the component can use inline CSS defined directly in JavaScript, allowing for dynamic style generation based on component state. This is useful when you need to generate styles programmatically or want to keep styles co-located with component logic. Set to false only if you want to disable the component's ability to use inline CSS methods and rely exclusively on external CSS files for styling. 

## Lazy Loading

Lazy loading in Cocoon is controlled via the `lazy` property. When lazy loading is enabled, the component is only connected to the DOM when it becomes visible or is interacted with, which can significantly improve page load performance.

You can enable lazy loading at both the **class** and **instance** levels:

### Class Level Lazy Loading

Set `lazy = true` at the class level to make all instances of the component lazy:

```javascript
namespace `ui.components` (
    class MessageBar extends WebComponent {
        static lazy = true;

        async onConnected() {
            console.log("MessageBar is now connected to the DOM");
        }
    }
);
```

### Instance Level Lazy Loading

You can also control lazy loading at the instance level using the `lazy` attribute:

```html
<message-bar lazy="true"></message-bar>
```

```javascript
namespace `ui.components` (
    class MessageBar extends WebComponent {
        async onConnected() {
            console.log("MessageBar is now connected to the DOM");
        }
    }
);
```

In this example, only this specific instance of `MessageBar` will be lazily loaded.

## Declarative Shadow DOM

Cocoon components support declarative shadow DOM, which allows components to define their shadow DOM directly in HTML markup. To enable this, set the `declarative` property to `true`.

```javascript
namespace `ui.components` (
    class MessageBar extends WebComponent {
        static declarative = true;
    }
);
```

### Declarative Usage Example

```html
<message-bar>
    <template shadowroot="open">
        <slot></slot>
    </template>
    <h3>Message inside LightDOM, projected into slot of shadowroot</h3>
</message-bar>
```

By using declarative shadow DOM, you can directly specify the structure of the shadow DOM in your HTML, reducing the need to programmatically create shadow roots or loading the components default `index.html` for markup.

## Template Inheritance

Without a declarative template, each component loads its own conventional `index.html`. Define `html()` to supply inline markup instead:

```javascript
class MessageBar extends WebComponent {
    html() {
        return `<template><p>Message</p></template>`;
    }
}
```

A subclass can explicitly reuse the nearest parent template through normal JavaScript inheritance:

```javascript
class CompactMessageBar extends MessageBar {
    html() {
        return super.html();
    }
}
```

If the subclass does not define `html()`, it loads its own `index.html`. Cocoon selects the template directly; it does not probe for a missing file and then fall back to a parent.

## Namespaces

Cocoon uses a powerful namespace system to organize components and logic. A namespace is defined using the `namespace` function and can contain classes, components, or logic.

### Namespace Example

```javascript
namespace `ui.components` (
    class MessageBar extends WebComponent {

    }
);
```

Namespaces help in keeping the code modular and organized, allowing for easier maintenance and better code structure.

## Importing and Destructuring

Cocoon supports dynamic importing and destructuring to allow components and modules to be imported dynamically.

### Import Example

```javascript
import 'ui.components.MessageBar';

const messageBar = new ui.components.MessageBar;
document.body.appendChild(messageBar);
```

### Destructuring Example

You can destructure multiple imports easily:

```javascript
import { MessageBar, Label } from 'ui.components';

const messageBar = new MessageBar;
const label = new Label;
```

Cocoon also supports dynamic imports:

```javascript
const messageBar = await import('ui.components.MessageBar');
```

## Advanced Templating

Cocoon uses `TemplateLiteralParser` for handling templates. The `index.html` file for a component defines its structure and can be dynamically populated with data.

### Example Template

```html
<template>
    <div class="message-bar">
        <h3>${this.data.title}</h3>
        <p>${this.data.message}</p>
    </div>
</template>
```

### Passing Data into Templates

Data can be passed into templates dynamically, and the template engine will replace placeholders with actual values.

```javascript
const data = { title: "Welcome", message: "This is a message" };
messageBar.render(data);
```

### Template Logic

Full support for native JavaScript syntax, including variable declarations, if conditions, loops and returns statements:

#### Literal Return Statements Using, `<%= .... %>`

```javascript
<%= `<b>Total: ${this.countries.length} countries</b>` %>
```

#### Functions, Using `<% ... %>`

```html
<template>
    <div>
        <%
            var list = this.countries;
            var total = list.length || 0;
            return list > 3 ? total : "none";
        %>
    </div>
</template>
```

#### Loops in Function Blocks, Using `<% ... %>`

```html
<template>
  <select>
    <%
        return this.countries.map( country => 
        {
            if(country.name === "United States") {
                return `<option value="${country.name}" selected>${country.name}</option>`
            }
            else {
                return `<option value="${country.name}">${country.name}</option>`
            }
        }
        ).join("")
    %>
  </select>
</template>
```

#### Multiple Function Blocks, Using `<% ... %>`

```html
<template>
  <%= `<b>${this.countries.length} countries</b>` %>
  <select>
      <%
          var list = this.countries;
          if (list.length >= 3) {
              return `<option value="0">Select from ${this.countries.length} Countries </option>`;
          } else {
              return `<option value="0">Select Country</option>`;
          }
      %>
      <optgroup>
        <%
          return this.countries.map( country => 
            {
              if(country.name === "United States") {
                return `<option value="${country.name}" selected>${country.name}</option>`
              }
              else {
                return `<option value="${country.name}">${country.name}</option>`
              }
            }
          ).join("")
        %>
      </optgroup>
  </select>
  <slot></slot>
</template>
```

## Styling Host Components with :state(connected)

Cocoon v7.2.x introduces support for the `:state(connected)` pseudo-class, allowing you to style your host component based on its connection state. This is useful for controlling the appearance of your component before it is fully initialized and connected to the DOM.

### Example: Fade In on Connect

You can use your component's tag name as a selector and set an initial style (such as `opacity: 0;`) inline in your HTML or global stylesheet. Then, use the `:state(connected)` selector to reveal the component when it is connected:

```html
<!-- IN HEAD TAG -->
<style>
  my-component { 
    opacity: 0; transition: opacity 0.3s; 
    visibility: hidden;
  }
</style>
<my-component></my-component>
```

And in your component index.css:

```css
:host(:state(connected)) {
    visibility: visible !important;
    opacity: 1 !important;
}
```

This approach ensures that your component is hidden until it is fully connected and ready, then smoothly fades in.

### CLS (Cumulative Layout Shift) Considerations

Using opacity transitions with `:state(connected)` can help reduce perceived layout shifts, as the component's space is reserved in the DOM from the start. However, to further improve your CLS score, make sure to:

- Set explicit width and height (or min-height) for your component to avoid layout jumps.
- Avoid inserting large content or images after the component is revealed.

By combining `:state(connected)` with good layout practices, you can create visually smooth and CLS-friendly component loading experiences.

## Import Maps

Cocoon supports import maps, which allow you to map module specifiers to file paths. The `.importmap` file defines these mappings.

### Example .importmap File

```json
{
    "imports": {
        "ui.components.MessageBar": "../src/ui/components/MessageBar/index.js",
        "ui.components.CustomButton": "../src/ui/components/CustomButton/index.js",
        "ui.components" : "../src/ui/components/all.js",
    }
}
```

### How Import Maps Work

- The `.importmap` file is loaded when the app initializes, and all imports are resolved based on the mappings provided.
- Destructuring is supported when importing multiple components.

```javascript
import { MessageBar, CustomButton } from 'ui.components';
```

### Exporting Namespaces

Components could export their default namespaces (v7.x) using `export default`:

```javascript
export default namespace `ui.components` (
    class CustomButton extends WebComponent {

    }
);
```

This allows the component to be imported later on by other classes that depend on `CustomButton`:

```javascript
import CustomButton from 'ui.components';
```

## Custom Elements

Cocoon allows you to define custom elements with advanced functionality. Here's an example using `CustomButton`:

```javascript
namespace `ui.components` (
    class CustomButton extends HTMLSpanElement.with(IHtmlComponent) {
        static tag = "my-button";
        static extends = "span";

        async onConnected() {
            await super.onConnected();
            this.on("click", e => this.onClick(e));
        }

        onClick(e) {
            console.log("Button clicked", e);
        }

        inShadow() {
            return true;
        }
    }
);
```

### Explanation

- **`static tag`**: Defines the custom tag as `<my-button>`.
- **`extends = "span"`**: Extends a native HTML element (`span`).
- **Shadow DOM**: The `inShadow()` method ensures the component uses shadow DOM.
- **Event Binding**: The component listens for a `click` event and logs the interaction.

### HTML Usage: Extend built-in SPAN

```html
<span is="my-button">...</span>
```

## CSS Loading

Cocoon allows components to load external styles dynamically, either via predefined skins or custom stylesheets.

### Skins

You can define a skin for your component by setting the `skin` static property. This will load the skin from the components `/skins` folder, example:

```javascript
class MessageBar extends WebComponent {
    static skin = "dark"; // Loads MessageBar/skins/dark/index.css
}
```

The `static skin` property may also be set to `null` which would not load any component .css file, OR left `undefined` which will by default load the components `index.css` file.

### Component Skin Inheritance

Subclassed components will inherit all the styles specified in the ancestry of parents and will also attempt to load the skin of the subclassed component.

> **Deprecation Notice:**  
> When writing application-level or document-wide CSS rules, **do not use `:host`**.  
> Instead, use `:root` for global styles.  
> The `:host` selector is only valid inside shadow DOM and will not apply to the document root or application-level styles.  
> 
> **Example:**  
> 
> ```css
> /* Deprecated for application/document: */
> :host { ... }
> 
> /* Use this instead: */
> :root { ... }
> ```
> 
> If you use `:host` in application-level CSS, Cocoon will attempt to rewrite it to `:root` or a class selector, but this is deprecated and may be removed in future versions.

### Declarative Custom Stylesheets

To load custom stylesheet files declaratively, use the `styles` array property:

```javascript
class MessageBar extends WebComponent {
    styles = ["style1.css", "style2.css"];
}
```

Entries may take several forms, and **how an entry is resolved depends on how it starts**:

```javascript
styles = ["index.css"];              // the component's namespace folder: src/ui/MessageBar/index.css
styles = ["./index.css"];            // relative to the PAGE url
styles = ["../shared/tokens.css"];   // relative to the PAGE url
styles = ["/assets/reset.css"];      // site root
styles = ["https://cdn/icons.css"];  // absolute url, used as-is
styles = [someCSSStyleSheet];        // a live CSSStyleSheet object, adopted directly
```

Only a **bare filename** is resolved against the component's own folder. Anything
beginning with `.` or `/`, or carrying a scheme, is resolved against the page.
So `"index.css"` and `"./index.css"` are not the same file.

`styles` entries are adopted **last**, so a component's own rules win a tie against
anything inherited. See [Stylesheet Priority](#stylesheet-priority).

### API Custom Stylesheets Files

Alternatively, to load custom stylesheet files, use the `.stylesheets.add()` api call. This allow logic to be wrapped around the calls dynamically, whereas the declarative (above) approach is for simpler, static declarations.

```javascript
class MessageBar extends WebComponent {
    constructor() {
        super();
        this.stylesheets.add("style1.css");
        this.stylesheets.add("style2.css");
    }
}
```

`.add()` accepts the same entry forms as `styles`, and may be called at any time -
including long after the component connected, from gated or conditional logic:

```javascript
onThemeChanged(theme) {
    if (theme === "dark") { this.stylesheets.add("dark.css") }
}
```

#### Stylesheet Priority

`styles` and `.stylesheets.add()` are not interchangeable. They differ in **cascade
position**, and that difference is the reason to pick one:

```
[ document sheets ]   [ ancestral + .add() ]   [ styles ]
     weakest                                     strongest
```

- **`.add()`** inserts a sheet **ahead** of the component's own, so the component can
  override it. Use it for foundations: a vendor sheet, a reset, a shared file you
  then customise. This is also the channel the kernel uses internally for inherited
  and inline `css()` styles, which is why a subclass's rules beat its parent's.
- **`styles`** appends, so it lands **last** and wins ties. Use it for the component's
  own stylesheets.

A late `.add()` is still inserted, not appended - `.add()` means the same thing
whenever it runs. If you want a late sheet that *wins*, that is not `.add()`; push it
onto the root directly:

```javascript
this.root.adoptedStyleSheets.push(sheet);
```

Order only settles ties. Specificity is still decided first, and a document rule
matching the host from outside (`message-bar { ... }`) beats anything inside the
shadow root, `styles` included - that is shadow scoping, not the cascade. Marking the
inner rule `!important` reverses it.

### Inline Custom Stylesheets

To load an inline stylesheet, implement the `css()` method, returning valid cssText. `css()` rules will always take precedence and override rules declared in the components `index.css` skin.

```javascript
class MessageBar extends WebComponent {
    css = parse => `
        :host {
            display:block;
            background:red;
        }
        :host h3 {
            color:blue;
        }
    `
}
```

CSS is automatically applied to the component, and if the component is using shadow DOM, the styles are scoped to the shadow root.

### Available API Methods

- **`onConnected(data)`**: (Lifecycle) Called when the component is connected to the DOM. Use this to set up state, listeners, or fetch data.
  
  ```javascript
  async onConnected(data) {
      await super.onConnected(data);
      this.fetchData();
  }
  ```

- **`onDisconnected()`**: (Lifecycle) Called when the component is removed from the DOM. Clean up listeners or resources here.
  
  ```javascript
  onDisconnected() {
      window.removeEventListener('resize', this._resizeHandler);
  }
  ```

- **`onRendered()`**: (Lifecycle) Called after the component's template is rendered. Useful for DOM-dependent logic.
  
  ```javascript
  onRendered() {
      this.querySelector('.status').textContent = 'Ready!';
  }
  ```

- **`onAwake()`**: (Lifecycle) Called after the component is fully initialized and rendered.
  
  ```javascript
  onAwake() {
      this.startAnimation();
  }
  ```

- **`onSleep()`**: (Lifecycle) Called during disconnection, for pausing timers or animations.
  
  ```javascript
  onSleep() {
      clearInterval(this.timer);
  }
  ```

- **`querySelector(selector)`**: (DOM) Selects the first matching element within the component.
  
  ```javascript
  const button = this.querySelector('button.submit');
  ```

- **`querySelectorAll(selector)`**: (DOM) Selects all matching elements within the component.
  
  ```javascript
  const items = this.querySelectorAll('.item');
  ```

- **`append(element, container = this.root)`**: (DOM) Asynchronously appends an element to the container.
  
  ```javascript
  await this.append(newItem, this.$('.list'));
  ```

- **`find(selector, interval = 300, timeout = 3000)`**: (DOM) Finds an element asynchronously, retrying until found or timeout.
  
  ```javascript
  const el = await this.find('.dynamic-content'); //or
  this.find('.dynamic-content').then(el => console.log(el))
  ```

- **`findAll(selector, interval = 300, timeout = 3000)`**: (DOM) Finds all matching elements asynchronously, retrying until found or timeout.
  
  ```javascript
  const elements = await this.findAll('.dynamic-content'); //or
  this.findAll('.dynamic-content').then(elements => console.log(elements))
  ```

- **`on(eventName, handler, capture = false, selector)`**: (Event) Adds an event listener, with optional delegation.
  
  ```javascript
  this.on('click', e => this.handleClick(e), false, '.action-btn');
  ```

- **`fire(eventType, data = {}, element)`**: (Event) Dispatches a custom event with data.
  
  ```javascript
  this.fire('user:login', { userId: 42 });
  ```

- **`subscribe(eventType, listener, capture)`**: (Event) Subscribes to events with replay of the last event.
  
  ```javascript
  this.subscribe('data:updated', e => this.refresh(e.detail));
  ```

- **`css()`**: (Styling) Returns a string of CSS rules for dynamic styling.
  
  ```javascript
  css = parse => `
      :host { color: ${this.active ? 'green' : 'gray'}; }
  `
  ```

- **`stylesheets.add(url)`**: (Styling) Adds an external stylesheet to the component.
  
  ```javascript
  this.stylesheets.add('theme-dark.css');
  ```

- **`render(data = this.data)`**: (Template) Renders the component with new data.
  
  ```javascript
  await this.render({ title: "Hello", message: "Welcome!" });
  ```

- **`html()`**: (Template) Returns the HTML template string for the component.
  
  ```javascript
  html() {
      return `<div class="msg">${this.data.text}</div>`;
  }
  ```

- **`watch(object, property, callback, force, engine)`**: (Utility) Watches a property for changes.
  
  ```javascript
  this.watch(this.data, 'count', (val) => this.updateCount(val));
  ```

- **`getBoundingClientRect(element)`**: (Utility) Gets the bounding rect with center point.
  
  ```javascript
  const rect = this.getBoundingClientRect(this.$('.box'));
  console.log(rect.center.x, rect.center.y);
  ```

- **`inShadow()`**: (Utility) Returns true if the component uses shadow DOM.
  
  ```javascript
  if (this.inShadow()) { /* ... */ }
  ```

- **`setAttribute(name, value)`**: (Utility) Sets an attribute on the component.
  
  ```javascript
  this.setAttribute('aria-expanded', 'true');
  ```

## Document-Level Stylesheets

A stylesheet adopted on the **document** does not reach into shadow roots on its own.
`@font-face` is document-scoped, so fonts are available everywhere, but ordinary rules
are not: a `.icon { ... }` rule in a document sheet will never match an element inside
a component's shadow root.

Rather than having every component `@import` the same shared sheet into its own
template - a duplicate declaration and a duplicate request each time - a component can
**adopt** the document's sheets.

### Choosing What to Adopt

Override `shouldAdoptDocumentStyleSheets()`. It is off by default, so components stay
isolated unless they ask:

```javascript
shouldAdoptDocumentStyleSheets() { return false }              // none (default)
shouldAdoptDocumentStyleSheets() { return true }               // every document sheet
shouldAdoptDocumentStyleSheets() { return ["tabler-icons"] }   // url contains this
shouldAdoptDocumentStyleSheets() { return /\.tokens\.css$/ }   // url matches this
shouldAdoptDocumentStyleSheets() { return [/icons/, "reset.css"] }   // any of these
shouldAdoptDocumentStyleSheets() { return s => !s.url?.includes("app") }  // predicate
```

Strings and patterns are matched against the sheet's **full url**
(`http://host/src/ui/App/index.css`), not its filename - so `/\/shared\//` works where
`/^shared/` would not.

Returning `true` adopts everything the document has, including the application's own
stylesheet. That is rarely what a component wants; naming the sheet keeps the
component encapsulated while still sharing what it needs.

### Publishing a Document-Level Stylesheet

An `Application`'s `root` **is** the document, so its `styles` are adopted at document
level and announced to every component that opted in:

```javascript
export default namespace `ui` (
  class App extends Application {
    static ICON_FONT = "https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@2.44.0/tabler-icons.min.css";
    styles = [App.ICON_FONT];
  }
);
```

```javascript
export default namespace `ui` (
  class Toolbar extends Component {
    inShadow() { return true }
    shouldAdoptDocumentStyleSheets() { return ["tabler-icons"] }
  }
);
```

The font is fetched once. Every component that asked for it gets the rules inside its
own shadow root, and no component needs an `@import`.

The kernel's own application stylesheet - the one named by `ADOPTED_STYLESHEET`, see
[Kernel Configuration](#kernel-configuration) - is published the same way and is
available to the same mechanism.

### Timing

Adoption does not depend on load order. Components **subscribe** rather than reading
`document.adoptedStyleSheets` once, so:

- a component that connects **before** a sheet has finished loading receives it when it
  lands;
- a component that connects **after** receives it immediately, replayed;
- a sheet published later - from gated logic, a theme switch - reaches every subscriber
  the same way.

This is the event-bus replay behaviour described under
[Late Subscriptions](#late-subscriptions), applied to stylesheets.

### Where Adopted Sheets Land

Document sheets are inserted **ahead** of everything the component owns, so the
component always has the last word:

```
[ document sheets ]   [ ancestral + .add() ]   [ styles ]
```

See [Stylesheet Priority](#stylesheet-priority) for the full ordering rules.

## Kernel Configuration

The kernel reads its configuration from the `<script>` tag that loads it. This is the
preferred form - the values are available the moment the kernel parses, before
anything else runs:

```html
<script src="node_modules/od-cocoon/framework.src.js" charset="utf-8"
        data-kernel
        data-rootpath="./"
        data-namespace="ui.App"
        data-src-path="/src/"
        data-controller="index.js"
        data-adopted-stylesheet="index.css"></script>
```

| Attribute                 | Config key           | Purpose                                           |
| ------------------------- | -------------------- | ------------------------------------------------- |
| `data-kernel`             | -                    | Marks this script as the kernel                   |
| `data-namespace`          | `NAMESPACE`          | Namespace the controller resolves against         |
| `data-controller`         | `CONTROLLER`         | Controller filename, e.g. `index.js`              |
| `data-rootpath`           | `ROOTPATH`           | Path from the page to the project root            |
| `data-src-path`           | `SRC_PATH`           | Source folder, default `/src/`                    |
| `data-adopted-stylesheet` | `ADOPTED_STYLESHEET` | Application stylesheet, adopted at document level |
| `data-import-maps`        | `IMPORT_MAPS`        | Enable import map resolution                      |
| `data-sandbox`            | `SANDBOX`            | Fallback discovery namespaces, or `false`         |
| `data-enable-splash`      | `ENABLE_SPLASH`      | Show the resource loader splash                   |
| `data-debug`              | `DEBUG`              | Debug logging                                     |

The same values may be set from an inline `Config{}` block instead. Use this when the
values must be computed, or for pages predating the attribute form:

```html
<script src="node_modules/od-cocoon/framework.src.js" charset="utf-8"></script>
<script>
  Config.ROOTPATH = "./";
  Config.SRC_PATH = "/src/";
  Config.NAMESPACE = "ui.App";
  Config.CONTROLLER = "index.js";
  Config.ADOPTED_STYLESHEET = "index.css";
</script>
```

The block must come **after** the kernel script - `Config` does not exist before it.
Attributes win over `Config` assignments for the same key, so the two forms should not
be mixed for one value.

> **Deprecation Notice:**
> `Config.CSSFILENAME` is deprecated in favour of `Config.ADOPTED_STYLESHEET`, and
> `Config.FILENAME` in favour of `Config.CONTROLLER`. The old names still resolve to
> the new ones and will log a deprecation warning.

`ADOPTED_STYLESHEET` names the application's own stylesheet. The kernel adopts it at
document level, which is why an `Application` does not load it again through the
ancestral path, and why components can pull it in via
[document-level adoption](#document-level-stylesheets).

## Event-Bus Signaling Architecture

Cocoon v8 introduces a **revamped global event-bus** for robust, decoupled communication between components, modules, and even across namespaces. This system is modeled after a real hardware bus in electronics—imagine a breadboard with multiple chips (ICs) sitting on it, each chip tapping into shared bus lines (wires) that run across the board.

A key feature of this architecture is **late binding and replay**:  
Just as you can add a new chip to a breadboard at any time and it can immediately sense the current state of the bus lines, in Cocoon, components can subscribe to signals at any point—even after signals have already been broadcast. When a component subscribes late, it will immediately receive the most recent signal(s) of the requested type, ensuring no important information is missed. This enables dynamic, flexible, and loosely-coupled systems where components can come and go, always catching up with the latest state of the application.

**TL;DR – Why use the event-bus?**

- **No direct imports or references needed** between communicating components.
- **Late subscribers always receive the latest signal** (replay).
- **Works across namespaces and dynamically loaded modules.**
- **Reduces boilerplate** for event management.
- **Loose coupling:** Components can be loaded/unloaded/replaced at runtime without breaking communication.

### The Event-Bus as a Breadboard Bus

The event-bus acts as a **shared signal highway** for your application, just like the horizontal and vertical bus lines on a breadboard:

- **Any component or module can broadcast a signal** (using `fire`), placing it on the bus lines for all chips (components) to receive.
- **Any component can listen for signals** (using `subscribe`), tapping into the bus lines at any time—even after the signal was originally sent.
- There is no need for components to know about each other's existence; they only need to agree on the signal "protocol" (signal name/type).

#### Late Subscriptions

Unlike standard DOM events, **late subscribers** to the event-bus will immediately receive the most recent signal of the requested type, if it has already been fired. This is similar to how a new chip added to a breadboard can immediately sense the current state of the bus lines.

### Usage

#### Broadcasting a Signal

```javascript
this.fire("user:login", { userId: 42 });
```

#### Subscribing to a Signal

```javascript
this.subscribe("user:login", e => {
    console.log("User logged in:", e.detail.userId);
});
```

- Late subscribers will receive the last signal fired for that type, even if they subscribe after the signal was sent.
- Signals are global and bubble through the document, not just the component tree.

#### Example: Decoupled Communication

Component A (sender):

```javascript
this.fire("data-ready", { detail: { value: 123 } });
```

Component B (receiver, loaded later):

```javascript
this.subscribe("data-ready", e => {
    console.log("Received value:", e.detail.value);
});
```

Component B will receive the signal even if it subscribes after the signal is fired.

### Example: Application-Level Signal for Deeply Nested Child

Suppose your application wants to update the label of a deeply nested child component, but you don't want to pierce through multiple shadow DOM boundaries or traverse the DOM tree. Instead, you can simply broadcast a signal on the event-bus, and the child component can subscribe and update itself whenever it receives the signal—even if it is loaded after the signal is sent.

**Benefits of Application ↔ Component Signals:**

- **No Shadow DOM Piercing:** The application does not need to use `querySelector`, `shadowRoot`, or any DOM traversal to reach into encapsulated components.
- **Encapsulation Preserved:** Components remain fully encapsulated; their internal structure and state are not exposed or manipulated from the outside.
- **Loose Coupling:** The application and components do not need to know about each other's structure or existence—communication is based on agreed-upon signal names.
- **Late Binding:** Components can subscribe to signals at any time and will always receive the latest value, even if they are loaded after the signal is fired.
- **Cleaner, More Maintainable Code:** No brittle DOM queries or coupling to the component hierarchy; changes to the DOM structure or component nesting do not break communication.
- **Resilient to Change:** The child component's class name, tag name, position in the DOM, and nesting level can all change—nothing breaks as long as the signal name is consistent.

**Application-level code:**

```javascript
// Somewhere in your app logic
this.fire("update:payroll:amount", { label: "New Label Value" });
```

**Deeply nested child component:**

```javascript
class PayrollPopupOverview extends WebComponent {
    static tag = "sdf-payroll-popup";

    async onConnected() {
        await super.onConnected();
        // Subscribe to the signal, even if it was fired before this component was connected
        this.subscribe("update:payroll:amount", e => this.onUpdateLabel(e));

    }
    onUpdateLabel(e) {
        // Update the label in this component's own DOM tree
        this.querySelector(".label").textContent = e.detail.label;
    }

    html() {
        return `<span class="label">Default</span>`;
    }

}
```

**Usage:**

```html
<parent-component>
  <child-component>
    <deep-child></deep-child>
  </child-component>
</parent-component>
```

- The application doesn't need to know or traverse the DOM structure.
- The `deep-child` component will always receive the latest label value, even if it is added after the signal is fired.
- No shadow DOM boundaries are pierced; the child updates itself in response to the signal.
- The child component's class name, tag name, or its position/nesting in the DOM can change at any time—communication still works as long as the signal name matches.

### When to Use the Event-Bus vs. Standard Events

- **Standard events/dispatching** (using `dispatchEvent`, `addEventListener`) are best for tightly-coupled, direct communication—such as parent-child or DOM tree relationships. These events are not replayed to late listeners; if you miss the event, you miss the information.
- **The event-bus** is ideal for **decoupled, cross-cutting communication** where components may not know about each other, may be loaded dynamically, or may need to react to signals that occurred before they were initialized.

**Use the event-bus when:**

- You want to broadcast application-wide state changes or notifications.
- Components/modules need to communicate without direct references or imports.
- You want late subscribers to always receive the latest signal.
- You want to reduce boilerplate and avoid manual event replay logic.

**Use standard events when:**

- You need DOM-specific bubbling/capturing.
- Communication is strictly hierarchical or local to a subtree.
- You do not need replay or global signal delivery.

## Declaring Components Outside of a Namespace

You can also declare Cocoon components outside of a namespace, using standard ES6 class syntax. This is useful for quick prototyping or when you want to keep your component definitions simple and local.

### Example

```javascript
class UserCard extends WebComponent {
    static tag = "user-card";
    static skin = null;
    static {
        this.define();
    }
    async onConnected() {
        this.user = "Jane Doe";
        await super.onConnected();
    }
    html() {
        return `<div>Welcome, ${this.user}</div>`;
    }
    css() {
        return `
            :host {
                background: #f0f0f0;
                display: block;
                padding: 1em;
                border-radius: 8px;
            }
        `
    }
    inShadow() { return true }
}

class AdminCard extends UserCard {
    static tag = "admin-card";
    static skin = null;
    static {
        this.define();
    }
    async onConnected() {
        this.user = "Admin";
        await super.onConnected();
    }
    html() {
        return `<div>Admin Panel for ${this.user}</div>`;
    }
    css() {
        return `
            ${super.css()}
            :host {
                color: #222;
                border: 2px solid #0078d4;
            }
        `
    }
    inShadow() { return false }
}

// Usage
// This will append the AdminCard component to the document body
// and render its content in the light DOM (not shadow DOM)
document.appendChild(new AdminCard());
```

This example shows:

- How to define and register components with custom tags using `static { this.define(); }`
- Inheriting from another component and overriding methods
- Using both shadow DOM (`inShadow() { return true }`) and light DOM (`inShadow() { return false }`)
- Applying and extending CSS styles
- Instantiating and appending a component to the document

## Troubleshooting

### Custom Element Not Rendering or Registering

- **Symptom:** Your custom element does not appear in the DOM or throws an error such as `TagName, "your-tag" already defined` or `Uncaught TypeError: Failed to construct 'HTMLElement': Illegal constructor`.
- **Solution:** Ensure your component's tag name is unique, follows the custom element naming convention (must contain a dash), and is properly defined. The error `Uncaught TypeError: Failed to construct 'HTMLElement': Illegal constructor` often occurs if a component does not define a valid tag or if the tag is missing the required dash. Also, check that you are not registering the same tag multiple times.

### Styles Not Applying

- **Symptom:** Component styles are missing or not scoped as expected.

- **Solution:** Confirm that your component is using shadow DOM if you want style encapsulation. If using inline styles via `css()`, make sure `static csstext = true` is set. For external stylesheets, verify the file paths and that entries are declared in `styles` or added via `this.stylesheets.add()`.
  
  If your component needs styles that live on the **document** - an icon font, shared tokens - adopt them rather than giving up encapsulation. See [Document-Level Stylesheets](#document-level-stylesheets):
  
  ```javascript
  shouldAdoptDocumentStyleSheets() { return ["tokens.css"]; }
  ```
  
  This pulls the named sheets into the shadow root, ahead of the component's own, so the component keeps both its encapsulation and the last word in the cascade.
  
  Dropping out of shadow DOM entirely is the heavier option, and gives up all encapsulation in exchange:
  
  ```javascript
  inShadow() { return false; }
  ```
  
  This renders the component in the light DOM, where document styles apply to it directly. If `inShadow()` returns `true`, the component is isolated and no outer styling can reach it - except a rule matching the host element itself, which always wins over `:host` rules inside.

### Data Not Updating in Template

- **Symptom:** Changes to component data are not reflected in the rendered template.
- **Solution:** Always call `await this.render(newData)` after updating your data object to trigger a re-render. If using property watchers, ensure `this.watch()` is set up correctly.

### Event Listeners Not Firing

- **Symptom:** Your component's event listeners are not being triggered as expected.

- **Solution:** Ensure you are adding event listeners before the event is fired. A common issue is a race or late condition: if another component fires an event before your component adds its listener, your component will never be notified.
  
  In these cases, use the `subscribe()` and `fire()` methods provided by Cocoon. These methods track event state and ensure that late subscribers can still receive notifications for events that have already occurred.
  
  **Example:**
  
  ```javascript
  // In the sender component
  this.fire("data-ready", { detail: { value: 42 } });
  
  // In the receiving component (even if added after the event fired)
  this.subscribe("data-ready", (e) => {
      console.log("Received data:", e.detail.value);
  });
  ```
  
  Using `subscribe()` ensures your component will be notified of the event, even if it subscribes after the event was originally fired.

### CSS Module Imports Failing in Firefox

- **Symptom:** Dynamic CSS imports with `import(cssPath, {with: {type: "css"}})` fail in Firefox.
- **Solution:** Use the provided `importCSS()` helper, which falls back to fetching and creating a `CSSStyleSheet` when dynamic import with options is not supported.

### Session State Not Persisting

- **Symptom:** Changes to nested properties in `Session.State` do not trigger persistence.

- **Solution:** Only direct assignments to properties on `Session.State` are automatically persisted, because `Session.State` is a proxied object that traps and auto-commits changes at the top level. **Nested property changes** (e.g., `Session.State.x.y.z = 123`) will **not** be automatically persisted. In these cases, you must manually call `Session.commit()` after making changes to nested properties to ensure they are saved.
  
  **Example:**
  
  ```javascript
  // This will NOT persist automatically:
  Session.State.user.profile.name = "Alice";
  // You must call commit manually:
  Session.commit();
  ```
  
  > **Important:** Never attach state directly to the `Session` object itself (e.g., `Session.x = 123;`). Only properties on `Session.State` are tracked and persisted. Assigning properties directly to `Session` will never persist to storage.

### Content Security Policy (CSP) Blocking Resources

- **Symptom:** Errors in the console about resources (like images or CSS) being blocked by CSP.
- **Solution:** Update your CSP meta tag or server headers to explicitly allow the required resource types (e.g., add `data:` to `img-src` for inline images).

### Template Logic Not Working as Expected

- **Symptom:** Your component does not render the expected markup, or template logic (such as variable interpolation, loops, or conditionals) does not work as described in the "Template Logic" section.

- **Solution:** Cocoon templates support native JavaScript template literals and special logic blocks:
  
  - Use `${variable}` for variable interpolation in programmatic templates.
  - Use `<%= ... %>` for literal return statements and `<% ... %>` for logic blocks (loops, conditionals, etc.) inside your templates, as shown in the "Template Logic" section.
  - Make sure your template is being parsed by Cocoon's `TemplateLiteralParser` (the default).
  - If using declarative templates (inline `<template>` in HTML), ensure your component's static `declarative` property is set to `true` (default).
  - If your logic is not being executed, check that your template is not being loaded as plain HTML (which will not process logic blocks).
  
  **Example:**
  
  ```html
  <template>
    <div>
      <%= `<b>Total: ${this.countries.length} countries</b>` %>
      <select>
        <%
          return this.countries.map(country => 
            `<option value="${country.name}">${country.name}</option>`
          ).join("")
        %>
      </select>
    </div>
  </template>
  ```
  
  > **Tip:** Always follow the syntax described in the "Template Logic" section. If you see raw `<% ... %>` or `<%= ... %>` in your rendered output, your template is not being parsed by the correct engine or is not being loaded as a Cocoon template.

### Debugging Tips

- Use browser developer tools to inspect the DOM, check computed styles, and view console errors.
- Add `console.log()` statements in lifecycle methods to trace component behavior.
- Use the `getBoundingClientRect()` utility to verify element positioning.

If you encounter an issue not listed here, please open an issue or reach out to the maintainers for support.

## Migration Notes for v7.2.x

- `cssStyle()` is deprecated. Use `css()` instead for inline styles.
- `template()` is deprecated. Use `html()` instead for component templates.
- **Application-level CSS should use `:root` instead of `:host`.**  
  `:host` is only valid in shadow DOM. Using `:host` in document-level styles is deprecated and may be removed in future versions.
- Backward compatibility is provided for now, but these methods will be removed in a future major release. Update your components accordingly.

## License

This project is licensed under the MIT License.

## Page render readiness

`PageRenderObserver` waits for tracked framework startup, font readiness, and 300 ms without observed child-node additions/removals or layout/paint activity. Resource Timing entries provide a separate network-quiet signal without overriding fetch or XMLHttpRequest. Recent resource completions may delay readiness for at most 2 seconds after the first visual quiet period; later DOM activity still requires quiet but does not renew that allowance. Pending requests are not counted, so readiness does not guarantee every resource has loaded. The existing 60-second overall fallback remains.

Import-map initialization precedes both controller module loading and document stylesheet adoption, including CSS module import attempts. This prevents stylesheet loading from starting module resolution before the map is registered.
