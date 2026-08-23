---
name: feedback-name-the-boundary
description: When two tools/systems collide, Han defines a boundary and names both sides rather than making one conform to the other — offer a naming option alongside consolidation options.
metadata:
  type: feedback
---

When two systems collide in this repo, expect Han to **draw a boundary and name both sides**
rather than consolidate one into the other. Offer a "name the distinction" option alongside
any "unify them" options.

**Why:** Presented with three ways to resolve archgate ADRs (`.archgate/adrs/`) colliding with
the Matt Pocock skills' ADRs (`docs/adr/`) — repoint reads, repoint reads+writes, or accept two
homes — Han took none of them. He kept both systems intact and made the distinction lexical:
archgate records stay `adr`, Pocock records become `design-adr`. This is the same move the
project makes at its core, treating OKF v0.2 as an interface it implements while staying
permissive toward everything else (see [[project-okf-frontmatter-harness]]). Consolidation
would have meant one tool's output failing the other's contract; naming let both keep working.

**How to apply:** When presenting options for a conflict between tools, conventions, or
vocabularies, include the disambiguation option explicitly — don't present only structural
merges. Put the resulting vocabulary in `CONTEXT.md` (the glossary) and the operational
consequence in `AGENTS.md`, since that one loads into every agent's context. Verify any claim
those files make about an ADR verbatim against the ADR before writing it; see
[[feedback-verify-mechanism-before-policy]].
