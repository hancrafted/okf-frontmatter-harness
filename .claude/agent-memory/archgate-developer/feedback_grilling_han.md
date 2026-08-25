---
name: feedback-grilling-han
description: When Han restates the mechanism instead of picking one of your lettered options, the options were the wrong shape — re-derive and read the answer back to him.
metadata:
  type: feedback
---

The plain-language half of this lesson lives in [[feedback-plain-language-and-okf-slugs]], which
Han asked for independently in another session — read that one for how to _frame_ a question. This
memory covers how to _read the answer_.

**When his answer restates the mechanism instead of picking one of your options, the options were
wrong-shaped. Re-derive rather than mapping his words onto the nearest letter.**

**Why:** on four questions he answered with a description rather than "A" or "B". Each time it
carried a distinction my options had missed. His Q1 answer ("required keys by OKF cannot have
exceptions") introduced a non-relaxable floor sitting _outside_ the cascade, which no option of
mine had contemplated. His Q12 answer added "the type is always required if the path matches" —
the path-gating that turned out to be the sentence reconciling OKF §11 with opt-in governance, and
the single most load-bearing line in the resolution. Had I filed either as "he picked A", the
decision recorded would have been materially wrong.

**The readback cuts both ways: it also catches when his improvement does not survive the
mechanism.** On #8 he answered a question about permitting one frontmatter key with _"we can just
add one more rule above the index rule because it would match first"_ — ordering rather than
exception grammar, and the right instinct. But any rule placed above is still a _governing_ rule, so
it re-arms the unrelaxable floor and drags in a `type` requirement the file must not have. Reading it
back as a two-row table — what his rule actually yields versus what the other payload yields —
surfaced that half his fix needed to be an exclusion instead, and produced the sharpest line in the
resolution ("governed but type-free is inexpressible"). Do not just capture his restatement; run it
against the mechanism first.

## An option with no content will get picked

**Every lettered option must be concrete enough to implement as written.** On #10 I offered "C —
stretch an existing value to cover them" without naming which value, called it the worst of the
three, and he answered "C". The letter was pickable; the option was empty. Working the mechanism
afterwards showed C had _no_ legal form — a declared `types:` list is a ceiling, so a governed file
must carry a listed value, and "stretch" collapsed into "give a file a value whose stated purpose is
false". I had to go back and re-ask.

Two lessons: an option I am arguing against still needs to be specified properly, because he picks
against my recommendation often enough that a placeholder becomes a decision. And **the mechanism
check belongs before the question, not after the answer** — had I worked the ceiling rule first, C
would never have been on the list.

## He reframes rather than disagreeing — and the reframe is usually better

Twice on #10 he chose the option I argued against, and neither time did he dispute a fact:

- I priced a rule matching zero files as **"the dead-rule cost"**. He took it anyway: _"when ADRs,
  design ADRs are created they should be conformant and governed"_ — a rule that lands **before** its
  first file means nothing is ever retrofitted. Same fact, better frame, and my framing had no answer
  to it.
- I asked which half of the config an adopter inherits and what breaks when they edit it. He retired
  the question: the config's v1 job is to be **a complete enough test surface to build the harness**,
  and its shipped shape stays adjustable. That flipped the deciding criterion from adopter ergonomics
  to coverage, and dissolved a hazard I had spent a table pricing.

**How to apply:** when he takes the option you argued against, do not re-argue it — look for the
reframe, state it back, and re-derive everything downstream of it. Both of these changed later
answers. This is the same shape as _"dogfood in v1"_ in [[feedback-dogfood-on-real-files]]: a short
sentence that rescopes the question rather than answering it.

**How to apply:** when the reply is prose rather than a selection, stop and ask what his sentence
implies that the options did not offer, then reflect it back explicitly as "my reading of your
answer, stated so you can correct it". He corrects that readback when it is off, which is how the
path-gating detail got pinned down. Related: he engages hard with a flagged contradiction — when
his answer conflicted with a standing preference already recorded on the map, surfacing the
conflict outright (rather than silently absorbing it) produced a clean ruling and a rewritten
preference. See [[feedback-name-the-boundary]], [[feedback-challenge-the-interface]] and
[[feedback-design-decisions-need-precedent]].
