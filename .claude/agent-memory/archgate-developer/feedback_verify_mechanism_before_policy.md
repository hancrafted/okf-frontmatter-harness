---
name: feedback-verify-mechanism-before-policy
description: Han challenges the underlying mechanism before accepting a policy recommendation — verify how the tool actually works before proposing rules about it, because his challenges have twice overturned my recommendation.
metadata:
  type: feedback
---

Before recommending a _policy_ about a tool (pin it, gate it, configure it this way), verify the **mechanism** the policy rests on. Han reliably probes the mechanism, and when the probe contradicts the framing, the recommendation collapses.

**Why:** twice in one ticket (okf-frontmatter-harness #5, archgate version pinning) my recommendation was wrong because I had asserted a mechanism without checking it:

1. I recommended "drop the caret, exact-pin `archgate`". He asked _"can we pin a version range to be more flexible?"_ — checking revealed that for a `0.x` version npm's caret **already** means `>=0.55.0 <0.56.0`. The caret was never the problem; the absence of any comparison against the running binary was. My recommendation would have been churn.
2. I framed pinning as an npm-packaging question. He asked _"can't we execute it from node_modules or npx?"_ — the package turns out to ship **no binary at all** (36K, four files, no `optionalDependencies`), just a shim over a global unversioned cache. That reframed the whole ticket: the declared version cannot pin the binary, so the answer had to become an assertion, not a pin.

**How to apply:** when about to recommend a rule about a dependency's versioning, resolution, or config, first read the actual shipped artifact — the shim/bin source, the manifest's `files`/`bin`/`optionalDependencies`, the resolution order — and _run the probe_ rather than reasoning from how such tools usually work. Both of his questions were answerable in one tool call each; neither should have needed asking. He engages well with a proven negative ("I tested `HOME` relocation, it works, here's why I still advise against it") — a verified rejected alternative is worth more to him than an unexamined recommendation. See [[feedback-design-decisions-need-precedent]] and [[feedback-prefer-documented-signals]].
