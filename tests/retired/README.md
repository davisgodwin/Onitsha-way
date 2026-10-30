# Retired tests (v0.40)

These tested features removed in v0.40, when the game moved to open-ended life simulation:

- `missions30.test.mjs`, `missions30.cjs`: the scripted "Find Your Friend" mission (removed).
- `story.mjs`, `story-outcomes.mjs`: the 4-chapter "Story & careers" arc and its endings (retired). Custody, bail,
  chases and EFCC investigations still exist and are covered by `tests/e2e/life40.mjs`.
- `careers.mjs`: choosing a career at character creation and career-board contracts (replaced by occupations:
  apply at a workplace, work shifts, ranks).

They are kept for reference and are not run.
