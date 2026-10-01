import { ExampleFiles } from './ExampleFiles.js';

export class RayTracerFiles extends ExampleFiles {
  static archiveName = 'raytracer';
  static paths = [
    'src/examples/raytracer/RayTracer.js',
    'src/examples/raytracer/RenderSession.js',
    'src/examples/raytracer/OrbitCamera.js',
    'src/examples/raytracer/RayTracerWorld/index.js',
    'src/examples/raytracer/RayTracerWorld/index.css',
    'src/examples/raytracer/RayTracerField/index.js',
    'src/examples/raytracer/RayTracerField/index.html',
    'src/examples/raytracer/RayTracerField/index.css',
  ];
  static imports = {
    'examples.raytracer.RayTracerWorld': './src/examples/raytracer/RayTracerWorld/index.js',
    'examples.raytracer.RayTracerField': './src/examples/raytracer/RayTracerField/index.js',
  };
  static readme = '# Ray Tracer · Cocoon parallel example\n\nServe this folder with a local HTTP server (for example python3 -m http.server 8080), then open http://localhost:8080. No build or internet connection is needed.\n\nRayTracer.js owns the scene, lighting, recursive reflections, and deterministic sampling. RenderSession.js distributes tiles through Cocoon ThreadPool and accumulates samples. RayTracerField owns the canvas and drag interaction; OrbitCamera.js defines the bounded orbit; RayTracerWorld handles visibility and the heartbeat.\n\nDrag to orbit, release to refine, and use Reset view to restore the camera. Arrow keys orbit; Home resets. Choose Preview for a quicker comparison. Main thread mode intentionally blocks browser interaction while rendering the same image.\n';

  static htmlTemplate() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Ray Tracer · Cocoon parallel example</title>
  <link rel="icon" href="data:,">
  <style>html,body{margin:0;background:#04060c;color:#eef2fa;font-family:system-ui,sans-serif}main{max-width:1100px;margin:32px auto;padding:0 16px}button,select{font:inherit;padding:10px 14px;background:#152139;color:#eef2fa;border:1px solid #344762;border-radius:8px;margin:12px 8px 0 0}button{cursor:pointer}button[aria-pressed="true"]{background:#1c2b47;border-color:#6889fa}button:disabled{opacity:.5}#result{font:13px/1.6 ui-monospace,monospace;color:#93a4c1}</style>
  <script src="./vendor/framework.min.js" data-kernel data-namespace="examples.raytracer.RayTracerWorld" data-controller="index.js" data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script>
</head>
<body namespace="examples.raytracer.RayTracerWorld">
  <main><h1>Ray Tracer</h1><p>Drag to orbit the scene; release to refine. Choose Preview for a quicker Main thread comparison.</p><arc-raytracer-field></arc-raytracer-field><button id="main" aria-pressed="false" disabled>Main thread</button><button id="threads" aria-pressed="true" disabled>All threads</button><label>Quality <select id="samples" disabled><option value="24">Preview · 24 samples</option><option value="96" selected>Studio · 96 samples</option><option value="256">Fine · 256 samples</option></select></label><button id="render" disabled>Render again</button><button id="stop" disabled>Stop</button><p id="result" role="status"></p></main>
  <script type="module">
    document.addEventListener('raytracer:ready', event => {
      const field = event.detail.field;
      document.querySelectorAll('button,select').forEach(control => control.disabled = false);
      const choose = threads => {
        document.querySelector('#main').setAttribute('aria-pressed', String(!threads));
        document.querySelector('#threads').setAttribute('aria-pressed', String(Boolean(threads)));
        field.setThreads(threads);
      };
      document.querySelector('#main').onclick = () => choose(0);
      document.querySelector('#threads').onclick = () => choose(field.maxThreads);
      document.querySelector('#samples').onchange = event => field.setSamples(Number(event.target.value));
      document.querySelector('#render').onclick = () => field.renderView();
      document.querySelector('#stop').onclick = () => field.stop();
    }, {once:true});
    const result = document.querySelector('#result');
    document.addEventListener('raytracer:render-start', () => result.textContent = 'Rendering…');
    document.addEventListener('raytracer:stopped', () => result.textContent = 'Render paused');
    document.addEventListener('raytracer:error', event => result.textContent = event.detail.message);
    document.addEventListener('raytracer:rendered', event => {
      const {time,threads,samples,speedup} = event.detail;
      result.textContent = (threads ? threads + ' threads' : 'Main thread') + ': ' + (time/1000).toFixed(1) + ' s · ' + samples + ' samples' + (speedup ? ' · ' + speedup.toFixed(1) + '× faster on threads' : '');
    });
  </script>
</body>
</html>`;
  }
}
