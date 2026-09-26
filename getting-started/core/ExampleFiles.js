import { ExampleDownload } from '../../showcase/core/ExampleDownload.js';

export class ExampleFiles {
  static steps = [
    { file: '01-component.html', title: 'Your first component.', label: '01 / COMPONENT', description: 'Add the script, define your component, and place its tag on the page. Cocoon discovers and loads it automatically.', detail: 'HTML, CSS, JavaScript — plus the page that brings them together.', change: 'The complete setup, including the page that hosts Hello World.', focus: 'index.html' },
    { file: '02-importmap.html', title: 'Give it an address.', label: '02 / IMPORT MAP', description: 'Map a readable component namespace to its file. Cocoon loads .importmap for you; automatic discovery still runs this example.', detail: 'The new alias is ready for an explicit import in the next step.', change: 'The page loads .importmap to give your component a readable import name. Hello World itself is unchanged.', focus: '.importmap' },
    { file: '03-application.html', title: 'Make it an application.', label: '03 / APPLICATION', description: 'Your Application now coordinates two components. Click Continue to open WelcomePanel above Hello World. Each component owns its own interactions.', detail: 'Application orchestration · Two independent components', change: 'HelloApplication opens the new WelcomePanel from Continue. The import map adds its namespace, and page styles move into the Application index.css. Hello World stays unchanged.', focus: 'src/applications/HelloApplication/index.js' },
  ];

  static async load(step) {
    const paths = ['js', 'html', 'css'].map(ext => `src/components/HelloWorld/index.${ext}`);
    if (step < 2) paths.unshift('page.css');
    if (step > 0) paths.push('.importmap');
    if (step === 2) paths.push('src/applications/HelloApplication/index.js', 'src/applications/HelloApplication/index.css', ...['js', 'html', 'css'].map(ext => `src/components/WelcomePanel/index.${ext}`));
    const entries = [['index.html', this.steps[step].file], ...paths.map(path => [path, step === 2 && path === '.importmap' ? 'application.importmap' : path])];
    return Object.fromEntries(await Promise.all(entries.map(async ([name, path]) => {
      const response = await fetch(new URL('../examples/' + path, import.meta.url));
      if (!response.ok) throw new Error(`Could not load ${name} (${response.status})`);
      return [name, await response.text()];
    })));
  }

  static preview(files) {
    // Only resolve deployment paths; the displayed and downloaded example stays portable.
    const importMap = files['.importmap']
      ? `<script type="importmap">${JSON.stringify(JSON.parse(files['.importmap'])).replaceAll('<', '\\u003c')}</script>` : '';
    return files['index.html'].replace('<head>', `<head><base href="${new URL('../examples/', import.meta.url)}">${importMap}<link rel="stylesheet" href="/styles/interactive-tokens.css"><link rel="stylesheet" href="/getting-started/preview.css">`)
      .replace('./vendor/framework.src.js', '/vendor/cocoon/framework.src.js');
  }

  static async download(files, step) {
    const archive = { ...files };
    for (const [name, path] of [['framework.src.js', 'framework.src.js'], ['LICENSE.txt', 'LICENSE.txt']]) {
      const response = await fetch('/vendor/cocoon/' + path);
      if (!response.ok) throw new Error(`Could not package ${name}`);
      archive['vendor/' + name] = new Uint8Array(await response.arrayBuffer());
    }
    archive['README.md'] = `# Hello World — ${this.steps[step].label}\n\nExtract this folder and serve it with a local HTTP server:\n\n    python3 -m http.server 8080\n\nThen open http://localhost:8080. Or use an already installed http-server:\n\n    http-server ./ -o index.html\n\nNo build or internet connection is required. Open through HTTP, not file://.\n\nindex.html hosts the component. ${step === 2 ? 'src/applications/HelloApplication/index.css styles the document and is adopted automatically by Cocoon.' : 'page.css styles the backdrop.'} The component triad lives in src/components/HelloWorld/. The Cocoon runtime and license are included in vendor/.\n`;
    const name = 'hello-world-' + ['component', 'importmap', 'application'][step];
    const url = URL.createObjectURL(ExampleDownload.zip(archive, name));
    const link = Object.assign(document.createElement('a'), { href: url, download: name + '.zip' });
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
