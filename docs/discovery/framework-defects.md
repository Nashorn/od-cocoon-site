# Framework issues for follow-up

Internal repair backlog. Documentation changes do not fix the runtime. Preserve current behavior in references until a reviewed framework change establishes a new contract. Each entry separates evidence from interpretation; suspected design problems are not automatically confirmed bugs.

| ID | Issue and user impact | Evidence | Status / acceptance target |
| --- | --- | --- | --- |
| CSS-01 | `skin = null` also skips the same class's `css()`, surprising an author who wants no file but inline styling. | IHtmlComponent style-collection trace and component contract probe. | Design review requested. Decide whether suppression covers both sources; add an explicit regression case for the chosen behavior before changing it. |
| CSS-02 | Light-DOM installation deduplicates by namespace, so a conventional sheet can suppress the class's later inline sheet. | `verify-dom-modes.mjs`, light-root evidence in `dom-modes-verification.json`. | Reproduced limitation; review as defect. Preserve intended sheet ordering without duplicate installation on reconnect. |
| TEMPLATE-01 | `%>>` consumes the HTML closing bracket as well as the template delimiter. | `verify-template-language.mjs`, delimiter case. | Reproduced parser defect. Preserve the closing HTML bracket and existing supported expressions. |
| TEMPLATE-02 | Dynamic declarative markup is processed before the `declarative = false` override branch. | `verify-component-contracts.mjs`, declarative branch checks. | Reproduced precedence; intended semantics need review before a compatibility change. |
| BOOT-01 | String `"false"` remains truthy for several boolean-looking boot controls. | Attribute proxy and individual consumer source traces; selected kernel probes. | Configuration design issue. Define per-attribute parsing and preserve documented sandbox behavior. |
| LIFE-01 | Reconnection can accumulate delegated listeners, simulation registrations, and stylesheet work. | Source trace; repeat-attachment coverage remains incomplete. | Suspected lifecycle defect. Reproduce each owned resource separately; do not label all paths proven. |
| LIFE-02 | Lazy observation is not explicitly cleaned up on disconnection; failed connection can skip unobserve. | Source trace in IHtmlComponent. | Suspected cleanup defect; add failure/disconnect reproduction. |
| WORKER-01 | A postMessage/serialization failure can leave managed-job bookkeeping until cleanup. | Thread source trace. | Suspected resource leak; reproduce repeated failures and verify job-map release. |

Signal history replaying every retained event is **owner-confirmed intended behavior**, not a defect. Public examples must tolerate replay; history retention and absence of eviction still need explanation.

No framework files were changed by this documentation pass. Keep reproduction results tied to the source snapshot/runtime hash, and record a repair commit and regression result when an issue is fixed.
