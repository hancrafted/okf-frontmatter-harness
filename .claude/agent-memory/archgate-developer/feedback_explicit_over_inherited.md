---
name: feedback-explicit-over-inherited
description: Han trades duplication for explicitness — he rejects inheritance and implicit merging in config design, and wants a mechanism explained in worked examples before he will lock it.
metadata:
  type: feedback
---

When designing anything composable, Han will **trade duplication for explicitness**. Offer the
isolated, self-contained option even when it is more verbose, and never present implicit
inheritance as the only sensible default.

His own words during the okf-frontmatter-harness constraint-vocabulary grill (ticket #7):
_"in general i don't like inherit, each rule should ideally be isolated enough if possible or
explicit as possible. I'd rather have duplicating exclude as we have AI now doing the
maintenance of this config."_

**Why:** two things drive it. The config is agent-maintained, so the usual cost of duplication
(tedious hand-editing) is largely gone, while the cost of implicitness — needing to run a
resolver in your head to know what applies — is paid by every reader forever. He overturned
a _researched, already-settled_ standing preference (an ordered cascade merging at the leaf)
to get it, and the simpler model then dissolved four open design questions at once.

**How to apply:**

1. **Put the explicit option on the table by default.** When the dominant industry pattern is
   a merging cascade, say so honestly — then still offer single-winner. On #7 the survey found
   _every_ widely-adopted file-config merges per key, and he chose the minority model anyway,
   correctly.
2. **Expect him to improve the model, not just pick from it.** Told "single winner, last match
   wins", he came back with first-match top-down by analogy to Angular routing — better than
   the recommendation, because it matches the single-winner family's own convention and makes
   a fallback rule readable. He reasons from familiar developer models; see
   [[feedback-design-decisions-need-precedent]] for the same move with Gmail filter rules.
   [[feedback-grilling-han]] covers how to _read_ such an answer when it arrives instead of a
   letter — this memory is only about which options to offer in the first place.
3. **Explain the mechanism in worked examples before asking him to commit.** _"give me detail
   explaination here on merging/overwrite in simple examples. I don't want to lock a decision
   i dont understand."_ A before/after table over one concrete config, showing what each option
   actually resolves to, is what unblocked it. Do that unprompted for any composition,
   precedence or merge decision. Pairs with [[feedback-plain-language-and-okf-slugs]].
4. **Watch for the second mechanism.** He splits work off rather than bolting it on — the
   dead-rule audit became a separate npm script _because_ "it works in isolation". Suggesting
   a config section split or a cache layer got declined; suggesting an isolated script did not.

Corollary on scope: he is comfortable accepting a known, named cost (duplication drift here)
provided the mitigation is written down and deferred honestly rather than designed away. Same
shape as the accepted gap in [[feedback-prefer-documented-signals]].
