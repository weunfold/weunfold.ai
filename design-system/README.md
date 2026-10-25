we unfold is a movement for open intelligence: AI that belongs to humanity, built in the open, by anyone, for everyone. This system holds its mark, its words and its stamp. The mark is still being chosen between three hypotheses; everything here works with all three, and `MarkSweep` switches between them live.

This is the **unfold** design system, extracted from the weunfold landing page so the unfold desktop app and the site share one look. Version 2.

## The story, in short

- **we** is all of us. No company, nation or creed sits inside the name. **unfold** is what potential does when it is given room: a fern, a flower, a shell, a mind.
- **Open Intelligence** is the slogan and a stamp. Any project, company or person can carry it, the way a licence travels with code. It sits beside or below the mark and is never bigger than it.
- The mark had to be something all of humanity already agrees on, so it is taken from nature's own maths: the golden ratio and the Fibonacci numbers of sunflowers, shells and galaxies. It is calculated, never drawn. Sacred geometry is used as construction, not decoration, and three-armed shapes are avoided so nothing reads as one tradition's symbol.
- It began as a sun that is never yellow, went through Fibonacci and Tesla, and was tested where it really lives: at 20 to 40 px on a profile photo.

## The three hypotheses

| | Mark | Hypothesis | Built from |
| --- | --- | --- | --- |
| A | Golden Seeds (`seeds`) | Everything is made of the same pattern. | 55 seeds at the golden angle; each sits in a see-through disc of radius d/φ, so the flower of life appears in the overlaps. |
| C | Golden Circles · Fade (`circles`, default) | Growth in balance. | The eight full circles behind the Fibonacci spiral (radii 1 … 21); the spectrum fades round every ring, each turned 1/φ. |
| D | Fibonacci Swirl (`swirl`) | Many hands, one motion. | Five arms of three compass arcs (radii 13, 21, 34), each r/φ³ thick. |

- Use `Mark`, `Lockup`, `Badge` and `Stamp` with a `variant` while the choice is open; omit it to get `circles`.
- Use `MarkSweep` in reviews, decks and on the site to switch between all three live, applied to anything (pass a function of the variant).
- When one is chosen, set `WeUnfold.DEFAULT` to it and stop showing the others in public pieces.

## Content fundamentals

- Write in plain, warm, direct sentences, first person plural: “we”, never “I” for the movement. Address readers as “you”.
- Write **we unfold** always lowercase, “unfold” in italic where type allows. Write **Open Intelligence** in title case in sentences and OPEN INTELLIGENCE in the tag and stamp.
- No emoji, no hype words, no tradable-token language. Real examples: “Built together, for everyone.” “Open intelligence, for everyone.” “Everything is made of the same pattern.”

## Visual foundations

These come from the landing page (`site/index.html`), which is the source of truth. Values live in `tokens.json`.

- **Grounds.** Dark-first. Night is `ground` #0b0d12 with ivory text. Day is warm sand and ink, **never white**: `ground` #e6d3b3, text #2a1d12 (the white day of v1 is retired). Cards are see-through (`card`) so the particle field shows behind them.
- **Colour.** Text in `text` on any ground; running copy in `text-muted`; labels in `text-faint`. **Gold** (`gold` #d9b45a) is the one UI accent: the line under the section you're in, the current menu item, the *Proposal* state, a featured card on hover. It never goes in the mark and never colours running text. On the day ground gold is 1.35:1 (`gold` #d9b45a on #e6d3b3), so on day it is a ring or a line only, never text. Day `text-faint` is #6e5742 (4.6:1 on the day ground, WCAG AA for small text; the old #866a50 was 3.4:1). The twelve `spectrum-*` hues belong to the mark and the particle field (and data marks such as the arc and capacity palettes), never to text. Status: `status-done` (filled), `status-road` (filled), `status-open` (a ring). Focus is a 2px `focus` blue ring, 3px offset.
- **Type.** Spectral for everything you read: titles light (300) with tight tracking (-0.025em) and one italic word that turns, body 18px/1.6. IBM Plex Mono for everything that labels: uppercase, wide tracking (0.08em for data, 0.16em for buttons, 0.24em for eyebrows, 0.32em for the OPEN INTELLIGENCE tag).
- **Spacing.** Fibonacci only: `space-3` to `space-89`. 13 and 21 are the everyday gaps; sections sit `space-89` apart; side gutter 21px; content max 1280px.
- **Shape.** Square (`radius-none`) for cards, panels, inputs and segmented controls; round (`radius-pill`) for pills, toggles and state chips; circles for dots, the mark and avatars. Borders are 1px `line` hairlines; dashed means *not there yet*. No shadows, no gradients outside the mark and the field.
- **Materials.** The top bar is transparent at rest and becomes `bar` (ground at 82%) with `blur(14px) saturate(120%)` once content scrolls under it.
- **Motion.** Things settle, nothing bounces: 200ms hover, 300ms borders, 450ms for anything that moves (`ease-move` cubic-bezier(0.65, 0, 0.35, 1)), 600ms fades, 650ms page crossfades. Respect reduced motion: no transitions, nothing autoplays, scenes rest on a still frame.
- **Reading.** Long text has its own surface (`.reader`) with night, dawn and paper-day themes, 20px Spectral.
- **Honesty.** Every figure carries its state as a chip: *Proposal* (gold), *Example*, *Not measured yet*, *Sample data*.
- **Clear space and size.** Keep at least the mark's radius divided by φ clear on every side. Smallest mark: 20 px (D: 16 px); below 96 px the components switch to the small cut by themselves.

## Files

| File | What it is |
| --- | --- |
| `tokens.json` | The source: colours (night + day), palettes, reader themes, type, space, radius, border, motion, layout. |
| `tokens.css` | Generated. CSS custom properties; night on `:root`, day on `[data-theme="day"]`, reader themes on `.reader[data-theme]`. |
| `tokens.js` | Generated. ES module: `tokens`, `colors(theme)`, `palettes`. |
| `components.css` | The landing's pure-CSS parts: base type, `.pill` / `.pill.ghost`, `.toggle`, `.seg`, `.state`, `.dot` / `.legend`, `.card`, `.panel`, `.pledge`, `.creases`, `.fold`, `.crumbs`, `.topbar` / `.nav-ind`, `.menu`, `.theme-sw` (a warm sun at night; a `moon` crescent while `data-mode-now="day"`; optional fade-in with `data-reveal` + `.is-shown`), `.field` / `.input`. Class names match the site; the primary pill fills with `--fill` where the landing writes `--ivory` (same colour, themed). |
| `fonts.css` + `fonts/` | Spectral and IBM Plex Mono bundled as woff2 (latin and latin-ext, 232 KB), so apps work offline. SIL OFL 1.1; licences in `fonts/`. |
| `preview.html` | Specimen of everything above. Open it in a browser; add `#day` for the day theme. |
| `assets/Marks/` | The mark files; `mark.svg` is the one in use. |
| `components/` | The v1 React mark components (`Mark`, `MarkSweep`, `Stamp`, `Badge` …) from the claude.ai export. The Stamp still uses the old ringed seal. |

Edit `tokens.json`, then run `node design-system/build.mjs` (`--check` exits 1 if the generated files are stale). No dependencies.

## Use it in another repo (the unfold desktop app)

1. Copy or submodule this folder, or point at it: `../weunfold/design-system`.
2. Load `fonts.css`, then `tokens.css`, then `components.css`. Keep `fonts/` next to `fonts.css`: its paths are relative.
3. Put `data-theme="day"` on `<html>` to switch to day; remove it for night.
4. In JS/TS, `import { colors, palettes } from "./design-system/tokens.js"` for canvas, WebGL or native theming.

The landing's scroll scenes and the three.js particle field are not part of the system; only their palettes are.

## Open Intelligence stamp

- Use `Badge` in READMEs, on sites, in decks and in footers (170 px wide in a footer). Use `Stamp` for the round seal on print, merchandise and pinned to avatars.
- The avatar: a dark band with #OPENINTELLIGENCE wraps the lower edge of a photo, open-to-work style, with the mark in a circle at the left, in colour or white.

## Iconography

- There is no icon set. The mark is the only symbol (the small sun of the night/day switch is the one exception); do not use emoji or pictograms beside it. Use the `Marks` assets where the bundle cannot run.

## Rules

- Open Intelligence is never bigger than the mark or the wordmark.
- Never add yellow to the mark (gold is a UI accent, outside the mark), recolour single seeds, rings or arms, or reorder the colours.
- Never redraw by hand, stretch, outline, add shadows or effects. Anything that cannot be traced back to the formulas is not part of the mark.
