---
name: feedback-prefer-documented-signals
description: Han prefers a documented mechanism with a weaker guarantee over an undocumented one that catches more — state the reduced promise explicitly rather than implying it.
metadata:
  type: feedback
---

When a check can be built on a documented API or on undocumented behaviour, Han takes the **documented one even when it detects strictly less**. Then the reduced promise gets written down as an accepted gap, not left implied.

**Why:** GEN-001's runtime-entry rule detected symlink-vs-copy by exploiting that archgate's reader threw on symlinks. archgate 0.55 started resolving them, the signature inverted, and every valid symlink was reported as a forbidden copy — a red build blocking all commits. Offered the research's primary recommendation (keep pointer detection via `respectGitignore: false` plus the undocumented glob/readFile asymmetry, with a canary) against the degraded option (content equality only, documented, flag-free), he chose **content equality** — despite it no longer catching a fresh byte-identical copy. The deciding factor was that the stronger option leaned on the _same class_ of undocumented behaviour that had just broken, and would have changed file scanning for every rule in the ADR.

**How to apply:** When ranking options for a check, weight "documented and stable" above "catches more". Present the honest degraded position as a real candidate rather than a fallback. If it is chosen, do three things: reword the rule description so it claims only what it enforces, record the gap in the ADR's Consequences, and add a test asserting the gap-case _passes_ so it stays a deliberate visible choice rather than an untested assumption. Corollary confirmed the same session: he also expects the test double to be corrected when it encoded the broken assumption — a mock that hides an inversion is part of the bug. See [[feedback-design-decisions-need-precedent]] and [[project-okf-frontmatter-harness]].
