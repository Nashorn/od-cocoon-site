# Cocoon website

Marketing website for [Cocoon](https://github.com/Nashorn/od-cocoon/tree/8.6.0), a standards-first framework for native web applications.

## Local preview

```sh
python3 -m http.server 4173 --directory public
```

Then open <http://localhost:4173>.

## Deployment

Render deploys the contents of `public/` as a static site whenever a commit is pushed to `main`. The service configuration lives in `render.yaml`.
