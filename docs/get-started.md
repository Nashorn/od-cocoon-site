# Your first native component.

Create a component, open your browser, and see it run. Arc is the framework; **od-cocoon** is the package that delivers its kernel.

## 1. Install the kernel

In an empty project folder, run:

```sh
npm install github:Nashorn/od-cocoon#8.6.0
```

This installs the public GitHub release. You’ll need Node.js, npm, and Git installed.

## 2. Give your component a home

Create these four files. The component has one file each for structure, style, and behavior.

```text
index.html
src/components/HelloWorld/
  index.html
  index.css
  index.js
```

### index.html

The page loads the kernel and places your component in the DOM. The empty import map is enough for this small sandbox example.

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Hello, Arc</title>
  <script type="importmap">{"imports": {}}</script>
  <script src="node_modules/od-cocoon/framework.src.js"
          data-kernel data-rootpath="./"></script>
</head>
<body>
  <hello-world></hello-world>
</body>
</html>
```

### src/components/HelloWorld/index.js

```javascript
namespace `components` (
  class HelloWorld extends Component {
    static tag = "hello-world";
  }
);
```

### src/components/HelloWorld/index.html

```html
<template>
  <h1>Hello, Arc.</h1>
  <p>Your first component is running in the browser.</p>
</template>
```

### src/components/HelloWorld/index.css

```css
:host {
  display: block;
  padding: 3rem;
  font-family: system-ui, sans-serif;
  color: #eef2fa;
  background: #0a101f;
  border-radius: 1rem;
}

h1 { color: #7fb1ff; }
```

## 3. Open it in the browser

From the project folder, start a local HTTP server:

```sh
npx http-server . -p 8080 -c-1
```

Open [localhost:8080](http://localhost:8080). You should see **Hello, Arc.** in a dark panel. Edit the component’s HTML or CSS, then refresh to see your changes.

## From a component to an application

This example uses automatic component discovery for a small sandbox. For an application, define an explicit Application controller and import map to own startup and imports.

- [Set up an application](docs.html#application-setup)
- [Inherit and customize component styles](docs.html#css-loading)
- [Connect components with signals](docs.html#event-bus-signaling-architecture)
- [Browse the full reference](docs.html)
