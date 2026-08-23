---
name: feedback-design-decisions-need-precedent
description: Han wants design recommendations backed by researched industry precedent, not intuition — he will ask for the research if you skip it.
metadata:
  type: feedback
---

When recommending a design decision, back it with **researched precedent from real, widely-adopted systems** rather than reasoning from first principles. Quote the actual docs.

**Why:** During the OKF harness wayfinder, I recommended an ordered-cascade precedence model on intuition. Han's reply was "do an online research and see how other systems do it" and he named the analogy himself (Gmail/Outlook filter rules). The research then produced a far stronger answer than the intuition had — it showed _no_ widely-adopted system ranks glob patterns by specificity, and that Traefik's attempt is a documented failure. That evidence changed the recommendation's confidence from a preference into a settled decision.

**How to apply:** For any non-obvious architectural choice — precedence models, config schemas, versioning strategies, naming conventions — dispatch a research subagent to survey how established tools solved it _before_ presenting a recommendation. Present the evidence table alongside the recommendation so he can check the reasoning. He engages with evidence and will overrule his own first instinct when the evidence is good: he initially proposed specificity-based precedence and accepted the cascade once the survey landed.

Corollary: he separates "find the facts" from "make the decision" cleanly. Facts are the agent's job (he never wants to be asked something lookup-able); decisions are his. See [[project-okf-frontmatter-harness]].
