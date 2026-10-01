# World and simulation timing

`World` extends Application with control of the window's shared simulation loop. Use it when an application needs coordinated updates and drawing; ordinary Application boot does not automatically start this loop.

## Build a bouncing ball

This example draws a ball that bounces off the edges of a canvas. A Pause button stops it; Resume continues from the same position. It uses one World controller and native HTML—no additional component or undefined helper classes.

The two responsibilities are easy to see:

- `onFixedUpdate()` moves the ball and handles collisions.
- `onDraw()` paints the ball at its current position.

Use this project layout with Cocoon installed:

```text
index.html
node_modules/od-cocoon/framework.src.js
src/applications/BouncingBall/
  index.js
  index.css
```

### Page: `index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cocoon bouncing ball</title>
    <script type="importmap">{"imports":{}}</script>
    <script src="node_modules/od-cocoon/framework.src.js"
            data-kernel
            data-rootpath="./"
            data-src-path="/src/"
            data-namespace="applications.BouncingBall"
            data-controller="index.js"
            data-adopted-stylesheet="index.css"></script>
  </head>
  <body>
    <h1>Bouncing ball</h1>
    <canvas id="game" width="640" height="360"
            aria-label="An animated ball bouncing inside a rectangle"></canvas>
    <button id="toggle" type="button">Pause</button>
  </body>
</html>
```

The empty import map makes this example self-contained: it has no component modules to import and does not need a separate `.importmap` file. The script attributes select the World controller and load its stylesheet early.

### Controller: `src/applications/BouncingBall/index.js`

```javascript
namespace `applications` (
  class BouncingBall extends World {
    async onConnected(data) {
      this.canvas = this.querySelector('#game');
      this.context = this.canvas.getContext('2d');
      this.ball = { x: 80, y: 90, radius: 16, vx: 180, vy: 120 };
      this.toggleButton = this.querySelector('#toggle');

      await super.onConnected(data);

      this.on('click', () => {
        if (this.isRunning()) {
          this.onStop();
          this.toggleButton.textContent = 'Resume';
        } else {
          this.onStart();
          this.toggleButton.textContent = 'Pause';
        }
      }, false, '#toggle');
    }

    getSimulationTimestep() {
      return 1000 / 60; // Move the ball in 60 fixed steps per second.
    }

    onFixedUpdate(milliseconds) {
      const seconds = milliseconds / 1000;
      const ball = this.ball;
      ball.x += ball.vx * seconds;
      ball.y += ball.vy * seconds;

      // Keep the whole ball inside the canvas and reverse at each wall.
      if (ball.x < ball.radius || ball.x > this.canvas.width - ball.radius) {
        ball.x = Math.max(ball.radius, Math.min(this.canvas.width - ball.radius, ball.x));
        ball.vx *= -1;
      }
      if (ball.y < ball.radius || ball.y > this.canvas.height - ball.radius) {
        ball.y = Math.max(ball.radius, Math.min(this.canvas.height - ball.radius, ball.y));
        ball.vy *= -1;
      }
    }

    onDraw() {
      const ctx = this.context;
      const ball = this.ball;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
      ctx.fillStyle = '#5fe9bd';
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    onDisconnected() {
      this.onStop();
    }
  }
);
```

The canvas and ball are initialized before the base connection starts the loop. Velocities are **pixels per second**: `vx: 180` moves the ball three pixels in a 1/60-second update. Converting the provided milliseconds to seconds keeps those units consistent.

The example clamps the ball to the wall and reverses its velocity. It is deliberately simple collision handling, suitable for this fixed step and speed—not a general high-speed physics solver.

### Styles: `src/applications/BouncingBall/index.css`

```css
:root {
  color-scheme: dark;
  font-family: system-ui, sans-serif;
}
body {
  max-width: 640px;
  margin: 3rem auto;
  padding: 0 1rem;
}
canvas {
  display: block;
  width: 100%;
  height: auto;
  background: #070c15;
  border: 1px solid #233047;
  border-radius: 12px;
}
button {
  margin-top: 1rem;
  padding: .6rem 1rem;
  font: inherit;
}
```

Serve the project over HTTP and open `index.html`. You should see the mint ball moving diagonally, reversing at the walls, and responding to Pause/Resume. CSS scales the canvas for smaller screens; its drawing coordinates remain 640 by 360.

## How the example uses World

Cocoon selects `applications.BouncingBall` from the script attribute. Boot binds its timing hooks and sets the simulation timestep. World's base connection starts the loop—you do not write a separate requestAnimationFrame loop.

The ball moves only in `onFixedUpdate`, while `onDraw` only paints. This separation is useful for games, particle effects, physics demos, and other animations whose state should advance consistently even when display frames arrive irregularly.

The example does not need `onUpdate` or `onUpdateEnd`; leave hooks alone until you have a reason to use them. Pause stops scheduling without deleting the ball's state or clearing the canvas. Resume restarts the same loop.

## Lifecycle and loop ownership

During explicit application boot, a World instance becomes both `window.application` and `window.world`. Boot binds its hooks into MainLoop and applies `getSimulationTimestep()`. World's base connection starts the loop after Application connection completes.

The loop is shared within that window. Creating another World is not an isolated per-component scheduler, and constructing one manually is not the same as boot selecting it and binding its callbacks. Separate iframe windows can own separate loop instances.

## Callback contracts

| Hook | Arguments and scheduling |
| --- | --- |
| `onUpdate(timestamp, accumulatedMilliseconds)` | Called at the beginning of an admitted animation frame. The second argument is accumulated unsimulated time, not simply a guaranteed fixed frame delta. |
| `onFixedUpdate(milliseconds)` | Called with the configured fixed timestep, zero or multiple times per animation frame to consume accumulated time. |
| `onDraw(interpolation)` | Called after fixed updates with remaining-time/timestep fraction. The loop's initial startup draw uses 1. |
| `onUpdateEnd(fps, panic)` | Called after drawing with smoothed FPS and a flag indicating that fixed-step catch-up reached the loop's cap. |

Callbacks are invoked synchronously. Returning a promise does not make the loop await it. Use workers or separately managed asynchronous tasks for expensive work rather than assuming an async update hook serializes frames.

The imported loop caps fixed updates at 240 iterations in a frame. World's default end hook discards accumulated frame delta on panic. If overriding that hook, retain the base behavior when you still want that recovery policy.

## Timestep versus display rate

Default `getSimulationTimestep()` returns `1000 / 120` milliseconds. This is the simulation step, not a guarantee of 120 browser paints per second.

A fixed timestep lets physics/state integration use a consistent duration while drawing follows available animation frames. Convert milliseconds to seconds explicitly when your simulation equations use seconds. The ball example draws the latest simulated position. More advanced animation can keep previous/current positions and use the draw interpolation fraction to blend them; interpolation changes the displayed position, not the simulation step.

Boot reads the timestep while configuring the World. Changing what the getter returns afterward does not by itself reconfigure the already-running loop.

## Control methods

| Method | Behavior |
| --- | --- |
| `onStart()` | Requests MainLoop startup; repeated starts while already started are ignored by the loop. |
| `onStop()` | Cancels the scheduled loop and marks it stopped. |
| `isRunning()` | Reports the loop's running state. It can remain false immediately after requesting startup until the first scheduled frame runs. |
| `setMaxAllowedFPS(fps)` | Limits admitted display frames without changing the simulation timestep. Passing 0 stops the loop. Omitting the value removes the cap in the imported implementation. |

Validate positive numeric limits or intentionally use `Infinity`; the World wrapper does not validate arbitrary input. Raising a cap after stopping at zero does not itself restart the loop. These wrappers do not provide fluent chaining return values.

## Visibility and cleanup

The base World does not implement application-specific offscreen, tab-visibility, or user-pause policy. The site's FlockingWorld and RayTracerWorld implement that policy explicitly using IntersectionObserver, `visibilitychange`, and start/stop calls.

A typical owner starts only while its scene is visible and the document is active, stops on disconnect/unload, and releases its own observers/listeners. Pausing MainLoop does not automatically terminate a ThreadPool or cancel other promises.

## Components with update hooks

Component's base `onAwake()` can register components with update/draw methods in an internal list. However, World overrides its update/fixed/draw hooks with empty methods rather than automatically forwarding that list. Do not assume every nested component is updated merely because it implements a hook.

The ball example keeps its state and drawing in the World itself. If a larger game moves that work into separate objects, the World must explicitly call them—for example, `this.player.move(seconds)` or `this.scoreboard.draw()`. Those would be classes you implement, not extra Cocoon hooks.
