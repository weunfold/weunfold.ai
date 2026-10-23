# we unfold — Open Intelligence

The home of the Open Intelligence movement: a scroll-driven manifesto, its charter, and the movement's first initiative.

**Live preview:** https://weunfold.github.io/ · **Version 0.4** (manifesto Draft 0.4)

This is a preview, not a launch. Proposals, examples and sample data are labelled as such on every page. Nothing on the site collects money, issues tokens or records signatures.

## What's here

| Path | What it is |
| --- | --- |
| `site/` | The published site. `index.html` is the immersive manifesto; `initiatives/` holds the initiative pages; `manifesto.html` / `manifesto.md` / `llms.txt` are the plain and machine-readable versions. |
| `content/manifesto.md` | The one source of the manifesto and charter text. |
| `content/partials/` | The shared top bar, footer and initiatives canvas, stamped into every page. |
| `tools/build.mjs` | Builds the reader text, the plain manifesto, the llms files and the SHA-256 fingerprint from `content/`, and stamps the shared partials. No dependencies. |
| `tools/bump.mjs` | Moves the version one step (0.4 → 0.5). |
| `design-system/` | Tokens, components and the mark files. |

## Run it

```bash
node tools/build.mjs && npx serve site
```

`node tools/build.mjs --check` exits 1 when a generated file is out of date; the deploy runs it before publishing.

## Versions

One number covers the site and the manifesto until v1.0.

- Work happens on branches and lands in `dev` (the default branch) through pull requests.
- Each merged pull request bumps the version (0.5, 0.6, 0.7…), tags it (`v0.5`…), rebuilds and deploys to GitHub Pages.
- Pushes to `dev` without a pull request deploy at the current version.
- v1.0 is set by hand at launch, when the manifesto's fingerprint is anchored.
