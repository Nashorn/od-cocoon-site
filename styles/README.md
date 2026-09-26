# Interactive section design tokens

`interactive-tokens.css` is the shared visual source for the landing page's
interactive sections. Values come from the existing showcase, not the simulation
mockup. The showcase, stats carousel, Getting Started and simulation sections consume them now.

Load it in **each iframe document**, before the application starts:

```html
<link rel="stylesheet" href="../styles/interactive-tokens.css">
```

Adjust the relative URL for that document's location. Parent-page CSS does not
cross an iframe boundary. Within a document, these properties inherit into Cocoon
shadow roots. Do not redeclare the defaults on every component host; override a
property on a section host only when an intentional variation is needed.

## Token groups

- `font-*`, `*-size`, `text-*`: font families, shell typography and text roles.
- `section-*`: maximum width, horizontal gutters and section spacing. Gutters are
  the total width subtracted (64px means 32px on each side).
- `heading-*`, `story-*`: headings, copy and responsive typography.
- `primary-*`, `secondary-*`: View Source and Download actions.
- `tabs-*`, `tab-*`, `control-*`: segmented navigation and controls.
- `shell-*`, `border-*`, `status-*`: container, separators and status strip.
- `stat-*`: existing carousel accents and surfaces.
- `editor-*`: the existing editor's intentional button variations.

Media-query breakpoints stay in component styles: native CSS custom properties
cannot be used in media-query conditions. Preserve the current 1100px and 720px
showcase transitions, and the carousel's existing breakpoints.

The editable team-access skins, 3D geometry, animation timings and future flocking
behavior remain component-owned. The shared reset uses font, text and focus
fallbacks so standalone ZIP examples don't depend on this landing-page stylesheet.

`interactive-lab.css` holds the lab-section layout shared by SimulationShell and
ParallelShell: example picker, story + stage grid, controls, status metric, lifecycle
note and source view, with their 1100px and 720px breakpoints. It sits in the
`interactive-lab` layer, above `interactive-shell`, so unlayered component rules still
win. Stage frame colours (`--arc-stage-border`, `-background`, `-chip`, `-hint`) are
tokens; sample fields use them with fallbacks so exported ZIPs stay self-contained.

`interactive-shell.css` shares the actual header, story typography, button,
segmented control and status-strip recipes between Showcase and SimulationShell.
Each loads it through its Cocoon `styles` list. It uses the `interactive-shell`
cascade layer above `interactive-reset`; unlayered component rules retain control
of layout and responsive overrides regardless of stylesheet fetch/adoption order.
The stylesheet is for component shadow roots, not the outer landing document.

## Open stage background

Use `--arc-shell-background` for the section glow. Layer the graph-paper texture
above it using these shared tokens:

```css
.demo { background: var(--arc-shell-background); }
.stage-grid {
  background-image: var(--arc-stage-grid-image);
  background-size: var(--arc-stage-grid-size);
  mask-image: var(--arc-stage-grid-mask);
  opacity: var(--arc-stage-grid-opacity);
  pointer-events: none;
}
```

The grid uses 1px lines at 10% and 11% opacity, 22px cells, and an elliptical
fade. Placement belongs to the section; colors, spacing, fade and opacity belong
to these tokens. Showcase and Getting Started both consume them. The Hello World
preview loads the same token file inside its iframe and stays transparent so the
section glow shows through. Its downloadable page has fallback values to stay
self-contained without the landing-page stylesheet.
