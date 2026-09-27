import { ExampleDownload } from '../../showcase/core/ExampleDownload.js';

export class ExampleFiles {
  static paths = [
    'src/examples/lifecycle/LifecycleCard/index.js',
    'src/examples/lifecycle/LifecycleCard/index.html',
    'src/examples/lifecycle/LifecycleCard/index.css',
    'src/examples/lifecycle/LifecycleApplication/index.js',
    'src/examples/lifecycle/LifecycleApplication/index.css',
    'src/lab/LifecycleShell/content.js',
  ];

  static async load() {
    const files = Object.fromEntries(await Promise.all(this.paths.map(async path => {
      const response = await fetch(new URL('../' + path, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
      return [path, await response.text()];
    })));
    files['auto-discovery.html'] = this.autoDiscoveryTemplate();
    files['application.html'] = this.applicationTemplate();
    files['.importmap'] = this.importMapTemplate();
    return files;
  }

  static autoDiscoveryTemplate() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Automatic discovery · Cocoon lifecycle</title>
  <script src="./vendor/framework.min.js" data-kernel data-rootpath="./" data-src-path="/src/" data-sandbox="examples.lifecycle"></script>
</head>
<body>
  <hello-world></hello-world>
</body>
</html>`;
  }

  static applicationTemplate() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Application code-behind · Cocoon lifecycle</title>
  <script src="./vendor/framework.min.js" data-kernel data-namespace="examples.lifecycle.LifecycleApplication" data-controller="index.js" data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script>
</head>
<body namespace="examples.lifecycle.LifecycleApplication">
  <hello-world></hello-world>
</body>
</html>`;
  }

  static importMapTemplate() {
    return JSON.stringify({ imports: {
      'examples.lifecycle.LifecycleApplication': './src/examples/lifecycle/LifecycleApplication/index.js',
      'examples.lifecycle.LifecycleCard': './src/examples/lifecycle/LifecycleCard/index.js',
    } }, null, 2);
  }

  static async download(files) {
    const archive = { ...files };
    archive['README.md'] = '# Cocoon component lifecycle\n\nThis example includes both Cocoon boot paths. Open auto-discovery.html to let the base Application discover the undefined component tag. Open application.html to load the same component through explicit application code-behind.\n\nServe this folder with a local HTTP server, for example `python3 -m http.server 8080`. No build or internet connection is required. Browser file:// restrictions mean double-clicking the HTML files is not supported.\n';
    for (const [path, url] of [['vendor/framework.min.js','/vendor/cocoon/framework.min.js'],['vendor/LICENSE.txt','/vendor/cocoon/LICENSE.txt']]) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Could not package ${path}`);
      archive[path] = new Uint8Array(await response.arrayBuffer());
    }
    const blob = ExampleDownload.zip(archive, 'component-lifecycle');
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href:url, download:'cocoon-component-lifecycle.zip' });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
