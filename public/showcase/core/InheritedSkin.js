/** Edits the actual ancestral sheet, shared by the two Cocoon shadow roots. */
export class InheritedSkin {
  constructor(parts) {
    this.parts = parts;
    const inherited = parts[0].profileStyleSheet;
    if (!inherited) throw new Error('ProfileCard inherited stylesheet did not load.');
    // A stage owns its editable copy, so a second embedded stage cannot change
    // its neighbors. Both subclasses adopt this same ancestral stylesheet.
    this.sheet = new CSSStyleSheet();
    this.sheet.replaceSync([...inherited.cssRules].map(rule => rule.cssText).join('\n'));
    // CSS module imports share the sheet. Cocoon's fetch fallback may create
    // one per root: normalize those to the same inherited sheet as well.
    for (const part of parts) {
      part.root.adoptedStyleSheets = [...new Set(part.root.adoptedStyleSheets.map(sheet => sheet === part.profileStyleSheet ? this.sheet : sheet))];
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
