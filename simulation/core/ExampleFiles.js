import { ExampleDownload } from '../../showcase/core/ExampleDownload.js';

export class ExampleFiles {
  static paths = [
    'src/examples/flocking/FlockingWorld/index.js',
    'src/examples/flocking/FlockingWorld/index.css',
    'src/examples/flocking/FlockingField/index.js',
    'src/examples/flocking/FlockingField/index.html',
    'src/examples/flocking/FlockingField/index.css',
    'src/examples/flocking/Steering.js',
  ];

  static async load() {
    return Object.fromEntries(await Promise.all(this.paths.map(async path => {
      const response = await fetch(new URL('../' + path, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
      return [path, await response.text()];
    })));
  }

  static htmlTemplate() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Flocking Worlds · Cocoon example</title>
  <style>html,body{margin:0;background:#04060c;color:#eef2fa;font-family:system-ui,sans-serif}main{max-width:1100px;margin:32px auto;padding:0 16px}button{padding:10px 18px;background:#152139;color:#eef2fa;border:1px solid #344762;border-radius:8px;cursor:pointer;margin:16px 0}</style>
  <script src="./vendor/framework.min.js" data-kernel data-namespace="examples.flocking.FlockingWorld" data-controller="index.js" data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script>
</head>
<body namespace="examples.flocking.FlockingWorld">
  <main><h1>Flocking Worlds</h1><p>Move to attract. Hold to repel. Arrow keys move your influence point; Space repels.</p><arc-flocking-field></arc-flocking-field><button id="pause" disabled>Pause / Resume</button></main>
  <script type="module">
    await customElements.whenDefined('arc-flocking-field');
    const field = document.querySelector('arc-flocking-field');
    const button = document.querySelector('#pause');
    button.disabled = false;
    button.addEventListener('click', () => { if (field.model) field.setPaused(!field.paused); });
  </script>
</body>
</html>`;
  }

  static async download(files) {
    const archive = { ...files, 'index.html': this.htmlTemplate() };
    archive['.importmap'] = JSON.stringify({ imports: {
      'examples.flocking.FlockingWorld': './src/examples/flocking/FlockingWorld/index.js',
      'examples.flocking.FlockingField': './src/examples/flocking/FlockingField/index.js',
    } }, null, 2);
    archive['src/core/ui/World/index.css'] = '/* World has no visual UI. */';
    archive['README.md'] = '# Flocking Worlds\n\nA Cocoon World with fixed-step flocking and interpolated canvas rendering.\n\nServe this folder with a local HTTP server (for example python3 -m http.server 8080), then open http://localhost:8080. No build or internet connection is needed. Browser file:// restrictions mean double-clicking index.html is not supported.\n\nThe steering model is in src/examples/flocking/Steering.js. Change behavior there; rendering and input live in FlockingField. FlockingWorld connects the component to the native Cocoon lifecycle. Reduced-motion users start paused.\n';
    for (const [path, url] of [['vendor/framework.min.js','/vendor/cocoon/framework.min.js'],['vendor/LICENSE.txt','/vendor/cocoon/LICENSE.txt']]) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not package ${path}`);
      archive[path] = new Uint8Array(await response.arrayBuffer());
    }
    const blob = ExampleDownload.zip(archive, 'flocking-worlds');
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href:url, download:'cocoon-flocking-worlds.zip' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
