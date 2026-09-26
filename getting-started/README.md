# Getting Started section

The Cocoon shell lives in src/lab/GettingStarted. It uses the same shared interactive tokens and shell recipes as the showcase and simulation. The landing page lazy-loads its iframe immediately below the hero.

Edit the example in examples/src/components/HelloWorld/index.{js,html,css}. All three steps share this one component triad. The three hosting pages are examples/01-component.html, 02-importmap.html, and 03-application.html. ExampleFiles loads the selected page as index.html in the source viewer and ZIP. page.css is the host backdrop in steps 1 and 2, separate from the glass component skin. In step 3 those styles live in src/applications/HelloApplication/index.css, automatically adopted into the document. That step omits page.css and its HTML link.

The preview uses that same page in srcdoc, resolving its base to examples/ and the packaged vendor script to the site's runtime. No demo logic is injected into the example. Downloads contain a local copy of the runtime and license, so they run offline through a local HTTP server.

Step 1 disables import-map loading and uses automatic component discovery. Step 2 adds .importmap while retaining discovery; the namespace alias is used explicitly by the Application import in step 3. Step 3 disables sandbox discovery and connects the hosting page to applications.HelloApplication.

The bundled kernel includes a narrow fix: data-import-maps="false" is honored as false instead of a truthy attribute string (source and minified runtime). Keep this behavior when updating the vendor runtime.

Step 3 adds the WelcomePanel triad. HelloApplication imports both components and opens WelcomePanel from the host page's Continue button. WelcomePanel uses a native dialog for modal focus, Escape and close behavior. application.importmap is exposed as .importmap in step 3's source viewer and ZIP; the preview registers that file's content before startup so step 2 can retain its smaller map.
