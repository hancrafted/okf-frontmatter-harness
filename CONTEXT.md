# okf-frontmatter-harness

A governance harness for agentic markdown repos. It implements Google's Open Knowledge
Format v0.2 as an interface: OKF names the frontmatter vocabulary, the harness supplies
configurable deterministic checks for the fields OKF proposes and stays permissive
toward everything else.

## Language

### Decision records

This repo keeps two kinds of decision record. They are **not** interchangeable, and the
distinction is load-bearing: one is machine-enforced, the other is not.

**ADR**: A decision record under `.archgate/adrs/`, governed by `GEN-001` and enforced by
`archgate check`. `GEN-001` is the source of truth for the shape it must take — frontmatter,
sections, and filename. Unqualified "ADR" always means this.
_Avoid_: archgate ADR, governed ADR, real ADR

**Design ADR**: A decision record under `docs/adr/`, produced by the Matt Pocock
engineering skills. Free-form prose, sequentially numbered `NNNN-slug.md`, outside
archgate's governance. It records reasoning; it constrains nothing.
_Avoid_: Pocock ADR, lightweight ADR, informal ADR, draft ADR

**Rule**: A deterministic check in an ADR's companion `.rules.ts`, tied to the numbered
decision it enforces by a `📜 Rule:` marker in the ADR body. A Design ADR has no rules.
_Avoid_: check, lint, validator

**Briefing**: The condensed form of an ADR that archgate loads into agent context, as
opposed to the full ADR body a human reads.
_Avoid_: summary, digest

### The harness

**Harness**: This repo, considered as the thing a foreign repo adopts. Every decision here
is constrained by having to survive being copied into a foreign repo unchanged.
_Avoid_: framework, tool, plugin

**OKF**: Google's Open Knowledge Format, v0.2. Treated as an interface the harness
implements, never as a spec the harness owns.
_Avoid_: the spec, the standard

**Domain**: An archgate grouping that scopes an ADR to a set of paths. Must be a built-in
domain or one registered in `.archgate/config.json`.
_Avoid_: area, category, scope

### What the harness checks

**Governed file**: A file matched by at least one path rule. Files nothing matches are
invisible to the harness — it never reports on them. Governance is opt-in by path.
_Avoid_: tracked file, included file, covered file

**Floor**: The OKF requirements the harness enforces on every Governed file without
exception. Not configurable, not relaxable, not narrowable. A repo that switches a Floor
check off is no longer implementing OKF.
_Avoid_: baseline, defaults, required checks, core rules

**Configurable check**: A check a repo turns on, off, or narrows through path rules. It
carries the harness's taste, not OKF's requirements. Everything outside the Floor is one.
_Avoid_: optional rule, soft rule, warning

**Actor**: An identity recorded in frontmatter, written `<producer>/<version>`,
`human:<id>`, or `process:<id>`. Consumers derive trust from the `human:` prefix, so the
form is load-bearing rather than cosmetic. The harness checks an Actor's form, never
whether the identity it names is the true author.
_Avoid_: author, owner, signer
