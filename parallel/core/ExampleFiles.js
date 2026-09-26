import { ExampleDownload } from '../../showcase/core/ExampleDownload.js';

export class ExampleFiles {
  static paths = [
    'src/examples/mandelbrot/MandelbrotWorld/index.js',
    'src/examples/mandelbrot/MandelbrotWorld/index.css',
    'src/examples/mandelbrot/MandelbrotField/index.js',
    'src/examples/mandelbrot/MandelbrotField/index.html',
    'src/examples/mandelbrot/MandelbrotField/index.css',
    'src/examples/mandelbrot/Mandelbrot.js',
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
  <title>Mandelbrot · Cocoon parallel example</title>
  <style>html,body{margin:0;background:#04060c;color:#eef2fa;font-family:system-ui,sans-serif}main{max-width:1100px;margin:32px auto;padding:0 16px}button{padding:10px 18px;background:#152139;color:#eef2fa;border:1px solid #344762;border-radius:8px;cursor:pointer;margin:16px 8px 0 0}button[aria-pressed="true"]{background:#1c2b47;border-color:#3d5480}#result{font-family:ui-monospace,monospace;font-size:13px;color:#93a4c1}</style>
  <script src="./vendor/framework.min.js" data-kernel data-namespace="examples.mandelbrot.MandelbrotWorld" data-controller="index.js" data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script>
</head>
<body namespace="examples.mandelbrot.MandelbrotWorld">
  <main><h1>Mandelbrot</h1><p>Rendered in tiles on a Cocoon ThreadPool. Click to zoom in; Shift-click to zoom out. Switch to Main thread to compare.</p><arc-mandelbrot-field></arc-mandelbrot-field><button id="main" aria-pressed="false" disabled>Main thread</button><button id="threads" aria-pressed="true" disabled>All threads</button><p id="result"></p></main>
  <script type="module">
    await customElements.whenDefined('arc-mandelbrot-field');
    const field = document.querySelector('arc-mandelbrot-field');
    const buttons = { main: document.querySelector('#main'), threads: document.querySelector('#threads') };
    const choose = which => {
      buttons.main.setAttribute('aria-pressed', String(which === 'main'));
      buttons.threads.setAttribute('aria-pressed', String(which === 'threads'));
      field.setThreads(which === 'main' ? 0 : field.maxThreads);
    };
    buttons.main.addEventListener('click', () => choose('main'));
    buttons.threads.addEventListener('click', () => choose('threads'));
    Object.values(buttons).forEach(button => { button.disabled = false; });
    document.addEventListener('mandelbrot:rendered', event => {
      const { time, threads, speedup } = event.detail;
      document.querySelector('#result').textContent = \`\${threads ? threads + ' threads' : 'Main thread'}: \${Math.round(time)} ms\${speedup ? ' · ' + speedup.toFixed(1) + '× faster on threads' : ''}\`;
    });
  </script>
</body>
</html>`;
  }

  static async download(files) {
    const archive = { ...files, 'index.html': this.htmlTemplate() };
    archive['.importmap'] = JSON.stringify({ imports: {
      'examples.mandelbrot.MandelbrotWorld': './src/examples/mandelbrot/MandelbrotWorld/index.js',
      'examples.mandelbrot.MandelbrotField': './src/examples/mandelbrot/MandelbrotField/index.js',
    } }, null, 2);
    archive['src/core/ui/World/index.css'] = '/* World has no visual UI. */';
    archive['README.md'] = '# Mandelbrot · Cocoon parallel example\n\nThe Mandelbrot set rendered in tiles on a Cocoon ThreadPool: one worker per core, each tile a job, pixels handed back without a copy.\n\nServe this folder with a local HTTP server (for example python3 -m http.server 8080), then open http://localhost:8080. No build or internet connection is needed. Browser file:// restrictions mean double-clicking index.html is not supported.\n\nThe maths is in src/examples/mandelbrot/Mandelbrot.js. Mandelbrot.renderTile runs inside worker threads as source text, so keep it self-contained. The pool, canvas and input live in MandelbrotField; MandelbrotWorld drives the heartbeat that shows whether the main thread is free.\n';
    for (const [path, url] of [['vendor/framework.min.js','/vendor/cocoon/framework.min.js'],['vendor/LICENSE.txt','/vendor/cocoon/LICENSE.txt']]) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not package ${path}`);
      archive[path] = new Uint8Array(await response.arrayBuffer());
    }
    const blob = ExampleDownload.zip(archive, 'mandelbrot');
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href:url, download:'cocoon-mandelbrot.zip' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
