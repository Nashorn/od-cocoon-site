# Documentation design preview

Isolated HTML/CSS prototype for visual review, not the production documentation implementation. It borrows the layout structure of https://www.mintlify.com/docs and uses the site's `styles/interactive-tokens.css`, fonts, original Cocoon logo, and original SVG illustrations.

Run `npm run docs:preview` from the repository root, then use the existing static server:

- `/mockups/documentation/` — documentation home
- `/mockups/documentation/#api.component` — interior API reference
- `/mockups/documentation/#api.application` — application setup

Search (Cmd/Ctrl+K), page navigation, contents links and copy controls work against the generated content bundle. The mock's proposed sidebar grouping and introductory cards are visual-review content only; production navigation will need to reconcile that proposal with the manifest. The landing-page Docs and footer Reference links now open this preview. Public `/documentation` routes and the framework runtime remain unchanged. `content.json` is a checked-in generated snapshot so the static deployment works without an ignored local file; regenerate it with `npm run docs:preview` after canonical Markdown changes.

There is no AI assistant in this preview. Fonts use the same Google Fonts families as the landing page. This is a code-native mockup so spacing, typography and responsive behavior can be assessed in a browser, not an image approximation.
