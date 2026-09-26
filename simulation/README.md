# Games & Simulation

The landing page loads `index.html` in one iframe when this section comes within
400px of the viewport, or when its navigation link is clicked. Nothing in this
application is required to boot the landing page or the team-access showcase.

## Ownership

- `src/lab/SimulationShell`: section copy, example picker, controls and source view.
- `src/lab/SimulationApplication`: connects the lab shell to the sample World.
- `src/examples/flocking/FlockingWorld`: Cocoon World lifecycle, visibility and pause.
- `src/examples/flocking/FlockingField`: canvas component, input and rendering.
- `src/examples/flocking/Steering.js`: separation, alignment, cohesion, obstacle
  avoidance and pointer influence. Neighbour searches use a spatial grid.
- `core/ExampleFiles.js`: source manifest and standalone download template. It
  fetches the same on-disk sample files used by the running world.

Cocoon's loop advances steering at 60 fixed steps per second. Drawing interpolates
positions at the display's available frame cadence. FPS is measured, not promised. The FPS cap slider uses Cocoon’s
`MainLoop.setMaxAllowedFPS()` to cap rendering from 15–120 FPS, with Max restoring
uncapped rendering. The simulation timestep remains 60 fixed steps per second;
Speed controls simulation time independently. Reset restores Max.
The loop stops when the field leaves view, the browser tab is hidden, Pause is
selected, or the source viewer opens. Reduced-motion users start paused.

The sample contains a small empty `src/core/ui/World/index.css` because the shipped
kernel looks up the World ancestor's visual skin. No kernel modification is needed.

## UI and source

The iframe loads `/styles/interactive-tokens.css`. The interactive section shells
use `/styles/interactive-shell.css` for their common UI, and SimulationShell and
ParallelShell share `/styles/interactive-lab.css` for the lab layout. Flock colors
live with their components.

View Source lazy-loads the existing `<code-explorer>` and supplies the source
manifest with `setFiles()`. `readonly` disables user edits, drop imports and file
management while allowing navigation, selection and copying. `editor-only` disables
its preview and sharing controls. This does not change the editable showcase editor.

The downloaded ZIP contains the sample World, field, steering model, import map,
local Cocoon kernel and license. Serve it with a local HTTP server; it does not need
an internet connection or build step. Source and download use the same file set.

## Adding examples

Gravity Playground and Side Scroller are labeled Coming soon and disabled. When
implemented, give each its own Cocoon application and map its picker button to the
shared iframe's next document. Replacing that document disposes the old World;
do not run hidden examples in parallel. Keep lab controls outside exported samples.

## Verification

Run `node tests/simulation.mjs` for lazy loading, playback, sliders, source read-only
behavior, keyboard/touch, responsive overflow and a standalone ZIP boot with external
requests blocked. `node tests/showcase.mjs` covers the original showcase and editor.
