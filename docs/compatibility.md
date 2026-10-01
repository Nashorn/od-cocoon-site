# Documentation compatibility

These reference drafts target the intended arc-kernel source contract. The examples are checked against the website's vendored Cocoon runtime; source-specific differences are identified on the relevant pages.

## Choose the matching runtime

The existing installation example pins public `8.6.0`. The local source and site bundle report `8.6.1.09202026`, and equal version strings do not establish equal code. The newer reference must not be presented as verified against the older installation release.

For local documentation development in this repository, `vendor/cocoon/framework.src.js` is the tested artifact. The example harness supplies that artifact at the examples' `node_modules/od-cocoon/framework.src.js` URL. A consumer project needs a corresponding runtime installed there; final public installation instructions await release matching.

## Known differences and limits

| Area | Current documentation treatment |
| --- | --- |
| Thread/ThreadPool | Exercised in the site runtime; availability in the public installation release remains unverified. |
| Page readiness | Source includes an extra dispatch delay; the site bundle instead includes child-frame forwarding. See [page readiness](api/page-readiness.md). |
| `skin = null` | Documented feature; current collection also skips the class's `css()`. Intended handling of that interaction remains under review. |
| Light-DOM styles | Later same-class sheets can be skipped. Use the limitation in [light/shadow DOM](api/light-and-shadow-dom.md) when designing a multi-sheet component. |
| Signals | Owner-confirmed contract: retain and replay every fired event. Examples use replaceable state, not replay-sensitive purchase commands. |
| Browser coverage | Example probes establish Chrome behavior. Other browsers require their own verification, especially for customized built-ins. |

These limits do not change the feature contracts silently. A future behavior change needs corresponding runtime, reference, and example updates.
