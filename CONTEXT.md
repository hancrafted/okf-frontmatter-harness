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

**OKF**: Google's Open Knowledge Format. Treated as an interface the harness
implements, never as a spec the harness owns. Its version label is **not** a contract
boundary: OKF changes normative content in place under a fixed label, and publishes no
tags or releases. So the interface the harness implements is named by the Pinned
revision, never by the string `0.2`.
_Avoid_: the spec, the standard, OKF v0.2 (as an identifier)

**Pinned revision**: The exact OKF text the harness's constraints were derived from,
vendored byte-identical at `docs/okf/SPEC-v0.2.md`. That file _is_ the pin — git
content-addresses it, so no checksum is recorded anywhere else and nothing verifies it.
_Avoid_: the spec version, v0.2, the snapshot

**Upstream**: OKF's live `main` branch, which moves without warning and without a version
bump. Never the thing the harness implements.
_Avoid_: the latest spec, canonical OKF

**Drift**: Upstream differing from the Pinned revision. A fact, not an error — nobody
caused it, and nothing in this repo reports it. (Scoped to this pair; unrelated to the
generic sense used of `rules.d.ts` or duplicated config.)
_Avoid_: staleness, violation, non-conformance

**Reconciliation**: The deliberate act of moving the pin — replacing the Pinned revision,
reading the diff, and adjusting the ADRs and rules it touches. Always manual, always a
reviewable change.
_Avoid_: upgrading, bumping, syncing

**Domain**: An archgate grouping label carried by an ADR, used to group ADRs and the findings
they raise. It does not decide which files the ADR governs — `files:` does. Must be a built-in
domain or one registered in `.archgate/config.json`.
_Avoid_: area, category, scope

### What the harness checks

**Governed file**: A file matched by at least one path rule. Files nothing matches are
invisible to the harness — it never reports on them. Governance is opt-in by path.
_Avoid_: tracked file, included file, covered file

**Floor**: The OKF requirements the harness enforces on every Governed file. **Not relaxable
through the config** — there is no key that switches a Floor check off, and a repo that
switched one off would no longer be implementing OKF. The config admits exactly one
exception, and it is forced rather than chosen: a rule declaring a path frontmatter-free
displaces the Floor, because a file cannot both carry no frontmatter and carry a required
field.

Unrelaxability is a property of the **config vocabulary**, not a guarantee about a run.
archgate's own file-level suppression comment sits outside the config and silences any rule
of any ADR, the Floor included, leaving the build green even under `--strict`. That escape
belongs to archgate rather than to this harness, and nothing here can close it.

One Floor check is **conditional and narrowable**, and it is the only one: the membership
test against a Type vocabulary fires only where a repo has declared one, and a path rule may
narrow it to a subset. That check is house policy rather than an OKF requirement, which is
why it is the Floor's single tunable; every other Floor check is unconditional. Narrowing an
allowlist is strengthening, so unrelaxability is untouched.
_Avoid_: baseline, defaults, required checks, core rules

**Reserved filename**: OKF's term for `index.md` and `log.md`, which §3.1 (Reserved
filenames) excludes from being concept documents. **The harness has no such concept.** They
are ordinary markdown — a Governed file when a path rule matches one, invisible when none
does. What keeps the harness OKF-conformant is the default ruleset it ships, not a name list
inside it.
_Avoid_: special file, exempt file, non-concept file

**Configurable check**: A check a repo turns on, off, or narrows through path rules. It
carries the harness's taste, not OKF's requirements. Everything outside the Floor is one.
_Avoid_: optional rule, soft rule, warning

**Type vocabulary**: A repo's canonical set of document kinds, maintained as master data —
a list of records the repo owns, not a constant inside the harness. Declaring one is
optional: a repo that declares none gets no membership check, only the Floor's requirement
that `type` be present and non-empty. Declaring one closes the set, which is stricter than
OKF — §4.1 (Frontmatter) leaves type values unregistered and §11 (Conformance) forbids a
_consumer_ rejecting over them — so closing it is always the repo's choice about its own
files, never the harness's about someone else's.
_Avoid_: type list, enum, taxonomy, allowlist

**Known shape**: The shape OKF gives a key it defines — `tags` is a list of strings,
`sources` is a list, `generated` is a mapping. Built into the harness because it belongs to
the interface rather than to a repo's taste, and never written in the config. Not a
constraint and never fires alone: it decides what a constraint the config _did_ write means,
and rejects a config whose constraint contradicts it. For a key OKF does not define, there
is no Known shape and the constraint implies its own.
_Avoid_: type, shape assertion, field type

**Actor**: An identity recorded in frontmatter, written `<producer>/<version>`,
`human:<id>`, or `process:<id>`. Consumers derive trust from the `human:` prefix, so the
form is load-bearing rather than cosmetic. The harness checks an Actor's form, never
whether the identity it names is the true author.
_Avoid_: author, owner, signer
