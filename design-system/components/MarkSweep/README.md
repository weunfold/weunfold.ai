# MarkSweep

A live switch between the three hypotheses, kept until one is chosen: buttons for A, C and D, and a Sweep button that cycles them every 2.4 s with a slow turn and fade.

- Provide `children` as a function of the variant to sweep anything: `h(MarkSweep, { stageWidth: 760, stageHeight: 460 }, function (v) { return h(Lockup, { variant: v }); })`. Without it, it sweeps the bare mark at `size`.
- Provide `stageWidth` and `stageHeight` when sweeping something larger than the mark; the layers stack inside that box.
- Use `initial` to choose the first one shown (default `circles`), `auto` to start sweeping, `onChange(variant)` to hear the choice.
- Motion respects reduced-motion settings. Use it for reviews, decks and the site while the decision is open; once a mark is chosen, set it as `WeUnfold.DEFAULT` and stop using the sweep in public pieces.
