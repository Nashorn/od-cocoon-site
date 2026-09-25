/** Edits the actual ancestral sheet, shared by the two Cocoon shadow roots. */
export class InheritedSkin {
  static async create(parts) {
    const url = new URL('src/examples/team/BaseProfileCard/index.css', document.baseURI);
    let inherited;
    try { inherited = (await import(url.href, { with: { type: 'css' } })).default; }
    catch {
      const source = await (await fetch(url)).text();
      inherited = new CSSStyleSheet(); inherited.replaceSync(source);
    }
    return new InheritedSkin(parts, inherited);
  }
  constructor(parts, inherited) {
    this.parts = parts;
    this.sheet = inherited;
    // Native CSS modules already share one sheet. Normalize only the kernel's
    // fetch fallback, which creates separate sheets from the same source.
    const text = [...inherited.cssRules].map(rule => rule.cssText).join('\n');
    for (const part of parts) {
      part.root.adoptedStyleSheets = [...new Set(part.root.adoptedStyleSheets.map(sheet =>
        [...sheet.cssRules].map(rule => rule.cssText).join('\n') === text ? inherited : sheet))];
    }
    this.rule = [...this.sheet.cssRules].find(rule => rule.selectorText === ':host');
    this.original = this.rule.style.cssText;
  }
  get text() {
    return `:host {\n  border-radius: ${this.rule.style.getPropertyValue('border-radius')};\n  background: ${this.rule.style.getPropertyValue('background')};\n  border-color: ${this.rule.style.getPropertyValue('border-color')};\n}`;
  }
  set(property, value) {
    if (!['border-radius', 'background', 'border-color'].includes(property) || !CSS.supports(property, value)) throw new Error('Use a valid radius, background, or border color.');
    this.rule.style.setProperty(property, value);
  }
  apply(text) {
    if (!/^\s*:host\s*\{[^{}]*\}\s*$/.test(text)) throw new Error('Keep one :host rule. Edit its radius, background, or border color.');
    const content = text.slice(text.indexOf('{') + 1, text.lastIndexOf('}'));
    const values = content.split(';').map(value => value.trim()).filter(Boolean).map(value => {
      const split = value.indexOf(':');
      const property = value.slice(0, split).trim();
      const input = value.slice(split + 1).trim();
      if (split < 0 || !['border-radius', 'background', 'border-color'].includes(property) || !CSS.supports(property, input) || /url\s*\(/i.test(input)) throw new Error(`Use valid border-radius, background, and border-color declarations.`);
      return [property, input];
    });
    if (!values.length) throw new Error('Add a supported CSS declaration.');
    values.forEach(([property, value]) => this.set(property, value));
  }
  reset() { this.rule.style.cssText = this.original; }
}
