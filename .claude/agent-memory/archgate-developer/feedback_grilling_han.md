---
name: feedback-grilling-han
description: How to run a grilling round with Han — plain language over jargon, and treat a restated answer as a signal that the offered options were the wrong shape.
metadata:
  type: feedback
---

Two rules for grilling rounds, both learned in okf-frontmatter-harness ticket #6.

**1. Write questions in plain language with concrete examples, not in the vocabulary of the
design.** Han will say "i dont understand, rephrase in simpler terms" and the round is wasted.

**Why:** two of seven questions in round 1 came back unanswered with exactly that reply. The
failed pair were the two most abstract — "does the constraint vocabulary reach inside lists of
mappings" and "verified is polymorphic: normalise, accept both, or mandate one". Both were
answered instantly once rewritten as a snippet of real YAML followed by "so the question is how
deep a rule can point". The content was fine; the framing assumed my own working vocabulary was
shared, when it was vocabulary I had built up in the preceding hour of reading and he had not.

**How to apply:** lead a question with the concrete artifact — the actual YAML, the actual config
line, the two files side by side — then ask what should happen to it. Reserve invented terms for
_after_ he has named the thing. Jargon he coined himself is safe; jargon I coined this session is
not.

**2. When his answer restates the mechanism instead of picking one of your options, the options
were wrong-shaped. Re-derive rather than mapping his words onto the nearest letter.**

**Why:** on four questions he answered with a description rather than "A" or "B". Each time it
carried a distinction my options had missed. His Q1 answer ("required keys by OKF cannot have
exceptions") introduced a non-relaxable floor sitting _outside_ the cascade, which no option of
mine had contemplated. His Q12 answer added "the type is always required if the path matches" —
the path-gating that turned out to be the sentence reconciling OKF §11 with opt-in governance, and
the single most load-bearing line in the resolution. Had I filed either as "he picked A", the
decision recorded would have been materially wrong.

**How to apply:** when the reply is prose rather than a selection, stop and ask what his sentence
implies that the options did not offer, then reflect it back explicitly as "my reading of your
answer, stated so you can correct it". He corrects that readback when it is off, which is how the
path-gating detail got pinned down. Related: he engages hard with a flagged contradiction — when
his answer conflicted with a standing preference already recorded on the map, surfacing the
conflict outright (rather than silently absorbing it) produced a clean ruling and a rewritten
preference. See [[feedback-name-the-boundary]] and [[feedback-design-decisions-need-precedent]].
