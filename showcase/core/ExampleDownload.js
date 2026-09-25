// Standalone example templates and download packaging.
export class ExampleDownload {
  // Edit the downloaded application controller here.
  static applicationTemplate() {
    return `import 'examples.team.TeamAccess';

namespace \`application\`
(
    class DemoApplication extends Application {
        async onConnected() {
            await super.onConnected();
        }
    }
);
`;
  }

  // Entry page and instructions included in the same archive.
  static htmlTemplate() {
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Team access · Cocoon example</title>
  <style>
    html, body { margin: 0; background: #04060c; color: #eef2fa; font-family: system-ui, sans-serif; }
    main { width: min(100%, 1000px); margin: 0 auto; }
  </style>
  <script src="./vendor/framework.min.js" data-kernel data-namespace="application.DemoApplication" data-controller="index.js" data-rootpath="./" data-src-path="/src/" data-sandbox="false"></script>
</head>
<body namespace="application.DemoApplication">
  <main><arc-team-access></arc-team-access></main>
</body>
</html>
`;
  }

  static readmeTemplate() {
    return `# Team access — standalone Cocoon application

Extract this ZIP, then serve the team-access folder with a local HTTP server.
For example, with Python 3 already installed:

    cd team-access
    python3 -m http.server 8080

Open http://localhost:8080. Or, with http-server already installed:

    http-server ./ -o index.html

No build or internet connection is required to run the included example.
Opening index.html directly with file:// is not supported because browsers
restrict module imports and asset fetching there.

Use the member dropdown and Approve access button to see native signals update
the profile cards. The app includes only the team component family, its shared
styles, the Cocoon kernel and license. The showcase shell is not included.

These are your current editor files (including unrun draft edits).
Custom edits that introduce remote assets or external dependencies must include
those dependencies locally to remain offline. Draft code errors are preserved.
Fonts fall back to locally available system fonts; there are no CDN font requests.
`;
  }

  // ZIP packaging uses the standard STORE method, without dependencies.
  static zip(files) {
    const encoder = new TextEncoder();
    const chunks = [], directory = [];
    let offset = 0;
    for (const [path, content] of Object.entries(files)) {
      const name = encoder.encode('team-access/' + path);
      const data = typeof content === 'string' ? encoder.encode(content) : content;
      let crc = 0xffffffff;
      for (const byte of data) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
      crc = (crc ^ 0xffffffff) >>> 0;
      const local = new Uint8Array(30 + name.length), l = new DataView(local.buffer);
      l.setUint32(0, 0x04034b50, true); l.setUint16(4, 20, true);
      l.setUint16(6, 0x800, true); l.setUint16(12, 33, true);
      l.setUint32(14, crc, true); l.setUint32(18, data.length, true);
      l.setUint32(22, data.length, true); l.setUint16(26, name.length, true); local.set(name, 30);
      const central = new Uint8Array(46 + name.length), c = new DataView(central.buffer);
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true);
      c.setUint16(8, 0x800, true); c.setUint16(14, 33, true); c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true); c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true); central.set(name, 46);
      chunks.push(local, data); directory.push(central); offset += local.length + data.length;
    }
    const end = new Uint8Array(22), e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, directory.length, true); e.setUint16(10, directory.length, true);
    e.setUint32(12, directory.reduce((sum, entry) => sum + entry.length, 0), true);
    e.setUint32(16, offset, true);
    return new Blob([...chunks, ...directory, end], { type: 'application/zip' });
  }

  static async create(workspace) {
    await workspace.loadFiles();
    const source = workspace.loaded ? workspace.editor.getFiles() : workspace.saved?.files || workspace.files;
    const files = {};
    for (const required of workspace.paths) {
      if (!(required in source)) throw new Error('Restore the required file: ' + required);
    }
    const imports = { 'application.DemoApplication': './src/application/DemoApplication/index.js' };
    for (const [path, content] of Object.entries(source)) {
      if (!path.startsWith('src/examples/team/') || path.split('/').some(part => !part || part === '..' || part === '.') || path.includes('\\') || typeof content !== 'string') {
        throw new Error('Keep example files inside src/examples/team.');
      }
      files[path] = content.replaceAll('./src/lab/shared.css', './styles/shared.css');
      if (path.endsWith('.js')) imports[path.replace(/^src\//, '').replace(/\/index\.js$/, '').replace(/\.js$/, '').replaceAll('/', '.')] = './' + path;
    }
    const assets = {
      'vendor/framework.min.js': '/vendor/cocoon/framework.min.js',
      'vendor/LICENSE.txt': '/vendor/cocoon/LICENSE.txt',
      'styles/shared.css': '/showcase/src/lab/shared.css',
    };
    await Promise.all(Object.entries(assets).map(async ([path, url]) => {
      const response = await fetch(url);
      if (!response.ok) throw new Error('Could not download ' + path);
      files[path] = new Uint8Array(await response.arrayBuffer());
    }));
    files['.importmap'] = JSON.stringify({ imports }, null, 2);
    files['src/application/DemoApplication/index.js'] = this.applicationTemplate();
    files['src/application/DemoApplication/index.css'] = 'body { margin: 0; }';
    files['index.html'] = this.htmlTemplate();
    files['README.md'] = this.readmeTemplate();
    return this.zip(files);
  }
}
