---
name: feedback-design-decisions-need-precedent
description: Han wants design recommendations backed by researched industry precedent, not intuition — and that research must be adversarially refuted, and must start with the interface the project implements.
metadata:
  type: feedback
---

When recommending a design decision, back it with **researched precedent from real, widely-adopted systems** rather than reasoning from first principles. Quote the actual docs.

**Why:** During the OKF harness wayfinder, I recommended an ordered-cascade precedence model on intuition. Han's reply was "do an online research and see how other systems do it" and he named the analogy himself (Gmail/Outlook filter rules). The research then produced a far stronger answer than the intuition had — it showed _no_ widely-adopted system ranks glob patterns by specificity, and that Traefik's attempt is a documented failure. That evidence changed the recommendation's confidence from a preference into a settled decision.

**How to apply:** For any non-obvious architectural choice — precedence models, config schemas, versioning strategies, naming conventions — dispatch a research subagent to survey how established tools solved it _before_ presenting a recommendation. Present the evidence table alongside the recommendation so he can check the reasoning. He engages with evidence and will overrule his own first instinct when the evidence is good: he initially proposed specificity-based precedence and accepted the cascade once the survey landed.

Corollary: he separates "find the facts" from "make the decision" cleanly. Facts are the agent's job (he never wants to be asked something lookup-able); decisions are his. See [[project-okf-frontmatter-harness]].

## Unrefuted research is not evidence — measured

**Never put a single-source finding to him as evidence. Run an adversarial pass first and present what
survived.** On ticket #10 I ran five research sweeps and then a refuter pass over each: **4 of the 5
were refuted, and 3 of the refutations changed the answer.** The unrefuted versions were fluent,
quoted, and wrong in ways that would have shipped:

| the sweep said                                                                                  | the refutation                                                                                                                                                                                               |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `index.md` + `frontmatter: forbidden` would break 6 in 10 real repos — "the uninstall scenario" | only **3 of 14** generators fence a file _literally_ named `index.md`; 60.7% did not replicate (47.4% on another slice); and the population was wrong, since governance is opt-in by path. The rule shipped. |
| "require `description`"                                                                         | its own two strongest findings argued the opposite, and the recommendation rested on the one number the report itself disowned                                                                               |
| RFC 7320 is the normative source                                                                | obsoleted by **RFC 8820**, whose carve-out _endorses_ the design it was cited against                                                                                                                        |

The failure mode is specific: a lone researcher writes a headline its own body does not support, and
quotes get silently abridged at the fence. Two refuters per finding, one attacking sources and one
attacking reasoning, caught different things every time — the source auditor found abridged quotes,
the reasoning auditor found the wrong population. Cheap relative to putting a wrong decision to him.

## Survey the interface before surveying the field

**When the project implements an interface, read that interface's own vocabulary and examples before
researching how anyone else does it.** On #10 I surveyed sixteen documentation systems for what to
call a how-to document, established that bare `guide` is used by zero of them, and recommended a
house word — having never opened §4.1 (Frontmatter) of the spec sitting vendored in the repo, which
**publishes its own example type values** including `Playbook` and `Reference`, both of which fitted
the files exactly. Adopting the interface's words beat inventing one, and it turned a divergence into
a conformance. This is the same instinct as [[feedback-challenge-the-interface]] item 4 (check the
reference implementation, not just the spec text) pointed the other way: also check the spec's own
_examples_, not just the clause that binds. Cheapest possible source, and I searched past it.
