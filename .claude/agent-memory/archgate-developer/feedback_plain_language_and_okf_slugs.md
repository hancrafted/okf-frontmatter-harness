---
name: feedback-plain-language-and-okf-slugs
description: Han wants grilling questions in plain language, and every OKF section reference carried with its title as a slug — never a bare paragraph number.
metadata:
  type: feedback
---

Two standing presentation rules for this project:

1. **Grill in simple terms.** Ask questions in plain language. No stacked jargon, no
   invented shorthand, no compressed abstractions the reader has to unpack before they can
   answer. If a term is genuinely needed, it belongs in `CONTEXT.md` first.
2. **Always name an OKF section, never just number it.** Write `§11 (Conformance)` or
   `§7 (Actor convention)` — never a bare `§11`. This applies everywhere: grilling
   questions, ticket bodies, resolution comments, map notes, ADR prose.

**Why:** asked for during the okf-frontmatter-harness wayfinder (ticket #7, the constraint
vocabulary grill). The map's Notes and early tickets were dense with bare section numbers
(`§7 actor convention`, `§11 clauses`, `§10 Attested Computation`), which forces a reader to
hold a number-to-meaning table in their head. The numbers are also unstable in a spec that
mutates in place — see [[project-okf-frontmatter-harness]] — so a number alone may not even
survive; the title is the durable half of the reference.

**How to apply:** keep a slug map to hand when working this project. Fetch it from the
canonical spec rather than trusting a number seen in an old ticket:
`curl -sL https://raw.githubusercontent.com/GoogleCloudPlatform/open-knowledge-format/main/SPEC.md`
then `grep -nE '^#{1,3} '`. The v0.2 headings pinned at
sha256 `26aa5da0…1030101` are: 1 Motivation, 2 Terminology, 3 Bundle structure,
3.1 Reserved filenames, 4 Concept documents, 4.1 Frontmatter, 4.2 Body,
5 Provenance/trust/lifecycle, 5.1 Provenance: `sources`, 5.2 Trust: `generated` and
`verified`, 5.3 Trust tiers, 5.4 Lifecycle: `status`, 5.5 Lifecycle: `stale_after`,
6 Cross-linking and paths, 6.2 Path-valued fields, 7 Actor convention, 8 Index files,
9 Log files, 10 Attested computations concept, 10.2 Contract fields, 11 Conformance,
12 Versioning, 13 Changes from v0.1.

Pairs with [[feedback-design-decisions-need-precedent]]: evidence tables are welcome, but
the prose around them still has to read plainly.
