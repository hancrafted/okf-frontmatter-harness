# okf-frontmatter-harness

See `CONTEXT.md` for the project glossary. Use its terms verbatim.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles are used verbatim as label strings. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the root and one `docs/adr/`. See `docs/agents/domain.md`.

This repo has **two kinds of decision record**, and they are not interchangeable:

- **`adr`** — archgate-governed. Lives in `.archgate/adrs/`, shaped by `GEN-001`, enforced by
  `archgate check`. Authored with the archgate ADR tooling. Unqualified "ADR" means this one.
- **`design-adr`** — written by the Matt Pocock engineering skills. Lives in `docs/adr/`,
  free-form and ungoverned. Records reasoning; constrains nothing.

`/domain-modeling` and the skills that reach it write `design-adr`s. Never write a `design-adr`
into `.archgate/adrs/` — `GEN-001` requires every file there to match the ADR contract, so an
ungoverned file dropped in that directory is a violation, not a draft. Promoting a `design-adr`
into an `adr` is a deliberate rewrite, not a move.
