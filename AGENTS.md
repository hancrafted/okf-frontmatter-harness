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

## Working in a git worktree

Wayfinder tickets run in parallel worktrees under `.worktrees/`. Two tools mislead there:

- **`archgate session-context` reads the _main_ repo's sessions, not the worktree's.** Inside a
  worktree it silently returns a different session's transcript — often another agent's, mid-flight.
  Read `~/.claude/projects/<worktree-path-key>/*.jsonl` directly instead, and fingerprint the file
  against something you know you said before trusting a word of it.
- **`npm run verify` is not conclusive in a worktree** — `knip` fails there and passes on `main`.
  Stashing and re-running _inside_ the worktree proves only that your own edit is not the cause; it
  does not prove the base branch is broken. Check `main` before reporting a red build.

## Writing a `.rules.ts`

archgate security-scans rule files before executing them, and rejects the whole file on a hit.
Blocked: every import outside `node:path`, `node:url`, `node:util`, `node:crypto` — including
`node:fs`; relative imports of sibling modules, so two ADRs cannot share a helper and must each
carry their own copy; and `.constructor`, which reaches the `Function` constructor. Reach for
`Array.isArray()` or `Object.prototype.toString.call()` instead of `.constructor`.

**Types reach a rule file by triple-slash reference, never by import.** A `/// <reference path=... />`
is a comment, so the scanner cannot object to it; `import type` is still an `import` statement and is
refused. Anything a rule file needs typed must therefore be `declare`d into the global scope — see
`.archgate/rules.d.ts` (archgate-generated, guarded by `git diff --exit-code` in `npm run verify`)
and `.archgate/okf-config.d.ts` (hand-written, not guarded).

**`.archgate/**` is typechecked but deliberately not linted.** `tsconfig.json` includes
`.archgate/**/*.ts`, so `tsc --noEmit` in both verify gates compiles every rule file and its
companion test. `eslint.config.mjs` still ignores the directory: this repo's `complexity: 7` /
`max-lines-per-function: 30` limits produce 16 errors on `GEN-001-adr.rules.ts` alone, and that file
is upstream-owned. Do not "fix" the eslint ignore.

**`.archgate/adrs/` is flat.** `GEN-001 [adr-governed-files]` reports every nested file, so fixtures,
scratch files and subdirectories cannot live there — one directory of fixtures produced 15 violations.
Harness material that is not an ADR bundle goes one level up, in `.archgate/` itself (`fixtures/`,
`okf-config.d.ts`, `fixtures.test.ts`).
