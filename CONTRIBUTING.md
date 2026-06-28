# Contributing to OrbitPanel

## Working agreement

- Work **one slice at a time**. Keep the system buildable at every commit.
- For every slice, state up front: objective, changed files, design choice, tests, acceptance criteria.
- Generate complete code, not pseudocode. Never overwrite unrelated files blindly.
- After each slice report: what changed, exact Windows commands to run, test results, manual verification steps, remaining risk, recommended next slice.
- Prefer boring, debuggable solutions over clever abstractions.
- When an external dependency or API could have changed, verify current docs before implementing.

## Quality gates (required before advancing a phase)

- Small, focused commit/PR series — no broad refactor inside a feature phase without a written reason.
- Tests appropriate to the changed boundary (see table below).
- Clear error behavior, not only happy-path.
- Updated docs when data schema, device profile, or config changes.
- Manual real-device validation for any display-transport change.
- No "temporary" credential handling, cookie access, or undocumented provider integrations.

## Test layers

| Layer | Tests |
|---|---|
| Device protocol | golden RGB565 frame fixtures, packet-construction tests, optional manual hardware test |
| Engine | state-machine, reconnect, scheduler, config migration, provider supervision |
| ProbeHost | sensor normalization, missing-source states, snapshot schema validation |
| Studio | widget property validation, layout ops, import/export, undo/redo |
| End-to-end | demo snapshot → renderer → frame hash / screenshot → virtual or physical panel |

## Commits

- Conventional, imperative subject. Reference the slice/phase.
- Co-author trailer on AI-assisted commits.
- One logical change per commit; combine related fixes to avoid redundant CI builds.

## Licensing discipline

- Before merging any upstream code, ensure [NOTICE.md](NOTICE.md) and `LICENSES/` carry the correct attribution.
- Do not claim original authorship of forked code. Preserve upstream copyright headers.

## Definition of done

A task is done when: code complete, tests for its boundary pass, docs updated if contracts changed, and (for transport changes) manual hardware validation recorded.
