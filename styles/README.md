# Interactive section design tokens

`interactive-tokens.css` is the shared visual source for the landing page's
interactive sections. Values come from the existing showcase, not the simulation
mockup. The showcase and stats carousel consume them now.

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

For the simulation section, reuse these values and the showcase's layout/control
patterns. Extract shared CSS recipes when implementing the second consumer rather
than making a separate set of nearly identical defaults.
