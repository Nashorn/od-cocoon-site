# Page readiness

Cocoon exposes component, application, and page-level notifications for different stages. They are not interchangeable “everything is ready” events.

## Choose the notification

| Event | Target/mechanism | What it describes |
| --- | --- | --- |
| `connected` | Document-level Cocoon signal | Base component connection pipeline reached its completion signal. |
| `application:connected` | Document-level Cocoon signal | Base Application connection completed. |
| `page:pre:rendered` | Native event on window | Page observer finalized its startup observation. |
| `page:rendered` | Native event on window | Subsequent page announcement after the observer's scheduling step. |

The component/application signals can precede subclass work after `await super.onConnected()`. The page events describe observed startup quiet, not the completion of every application-defined task.

Listen on window for page events:

```javascript
window.addEventListener('page:rendered', event => {
  const { reason, elapsed, href } = event.detail;
  console.log(reason, elapsed, href);
}, { once: true });
```

Install the listener before the announcement. These are ordinary window events, not the replayable history supplied by component `subscribe()`.

## What the observer waits for

The current source and site bundle share these mechanisms:

- Outstanding framework activity tokens for boot, component connection, discovered component imports, and stylesheet imports must settle.
- Font readiness is observed when the browser provides `document.fonts`.
- A 300 ms quiet period follows tracked activity, child-node DOM changes, and supported layout/paint performance entries.
- Resource Timing provides a soft signal of completed network resources. Recent completions can delay finalization within a 2-second allowance started after the first visual quiet period; later DOM changes require quiet again but do not renew that allowance.
- A 60-second deadline provides an escape path. Finalization waits until the document has left its loading state.

The observer checks on a 100 ms interval, so these thresholds are not exact event-delivery timestamps.

It does not count every pending fetch/XHR, wait for arbitrary promises, or continuously monitor the application's entire lifetime. Direct DOM observation covers child-list mutations in the document tree; arbitrary shadow mutations and attribute-only changes are not universally observed through that path. Framework activity reporting supplies additional coverage during component work.

## Event details

The finalized event detail contains:

- `reason`: normally `settled`, or `deadline` when the fallback wins.
- `elapsed`: rounded milliseconds since observation began, measured at finalization.
- `blockedBy`: the most recent tracked blocker label; diagnostic context, not necessarily an error.
- `href`: the page URL.

A deadline announcement is not proof of successful rendering. Framework activity end also does not necessarily imply success: cleanup paths can close tokens after failures.

Finalization tears down the startup observers. Later data loads, navigation, or dynamically mounted scenes need application-owned readiness signals. The runtime also installs a one-time page:rendered listener that sets the body's inline opacity to 1; keep that in mind when coordinating your own reveal effects.

## Shell pages

The bootloader can suppress the observer for a page classified as a shell. It checks an explicit frame-role value from the kernel script or document element, with a legacy iframe#mainFrame detection when no explicit role is supplied. The value `shell` selects suppression; it is not a component visibility state.

Do not assume every iframe uses identical event forwarding or that a shell gets its own ordinary observer announcement.

## Version-dependent announcement scheduling

**Documentation baseline: arc-kernel.** The site's vendored runtime differs here despite sharing a version string; it must not silently define the intended source contract.

| Artifact inspected | Additional behavior |
| --- | --- |
| Local arc-kernel bootloader | Adds 300 ms inside page:rendered dispatch. |
| Site vendored runtime | Dispatches without that extra delay; also attempts to forward page:rendered from a direct child frame to the top window. |

Both schedule the post-finalization announcement through two animation frames with a 50 ms timer alternative, guarded against duplicate announcements. Do not add a fixed sleep based on either implementation detail to determine whether application data is ready.

The intended contract follows arc-kernel: include its extra dispatch delay and do not promise the bundle-only direct-child forwarding behavior. The actual site bundle's settled event order and payload were tested in Chrome; the extra source delay was identified by comparison, not incorrectly claimed as deployed behavior.
