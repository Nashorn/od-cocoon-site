# Privacy review — outstanding operational facts

The public notice is `privacy.html`. Operator confirmed: Jason Smith, an individual
in Florida, USA; jaysmith024@gmail.com. Open-source project for developers, engineers
and companies worldwide. This file is an internal review checklist, not the public notice.

## Information still requiring verification

- Applicable obligations for a Florida individual operating a worldwide site.
- Hosting/access-log purposes, retention, processor terms and locations.
- GA4 property retention, data-sharing settings, enhanced measurement settings,
  applicable Google terms and international transfer arrangements before activation.
- Legal basis for hosting/security processing and any required representatives.

## Site operation

The website is hosted on Render. Loading the site sends network requests to its
hosting infrastructure. Google Fonts is also requested by the landing page and
showcase independently of the Analytics choice. These requests disclose network
information such as the visitor's IP address to the receiving provider. Analytics
rejection does not block those font or hosting requests.

[Complete provider locations, processing purposes, legal bases and retention.]

## Optional analytics

Google Analytics is not currently configured. If enabled, it will load only after
you select Accept analytics. It can process cookie identifiers, page visits,
referrer and browser/device information to produce usage statistics. The exact
collection must be checked against the deployed GA4 property before activation.
The site configuration disables Google signals and advertising personalization.

Selecting Reject analytics does not prevent use of the demo or editor. Cookie
settings in the footer lets you change your choice. Withdrawing consent stops
future Analytics loading and removes matching accessible first-party GA cookies;
it does not automatically delete information previously received by Google.

Read how Google processes information at:
https://policies.google.com/technologies/partner-sites

[Complete GA cookie lifetimes, property retention, sharing and transfer disclosures.]

## Browser storage

- `cocoon.analytics-consent.v1`: local storage records the accept/reject choice
  and its expiry. The site honors a choice for 180 days. Browser storage does not
  automatically expire: an old record may remain until overwritten or cleared.
- `cocoon-lab:<session>`: session storage preserves editor drafts and scene state.
  Normally removed when that browser tab/session ends; browser session restoration
  may preserve it. The editor Reset action removes that session's saved draft.
- `cocoon-showcase-runs-v1`: Cache Storage holds edited example files after Run;
  a service worker serves them locally. Cached runs have no automatic time limit
  and remain until cleared by the visitor or browser. Reset does not clear this cache.

These editor functions are separate from the Analytics choice. Clearing site data
in the browser removes locally stored choices and examples. Download creates the
example ZIP in your browser. The export does not send those files to a server.

## Your rights and contact

[Insert verified operator/contact details and jurisdiction-appropriate access,
correction, erasure, restriction, objection, portability, consent withdrawal and
supervisory-authority complaint information. Explain any applicable limitations.]

## Publication review

This draft documents observed application behavior. It is not a certification of
compliance. Confirm the outstanding facts and obtain jurisdiction-specific review
before representing this as the site's complete privacy notice.
