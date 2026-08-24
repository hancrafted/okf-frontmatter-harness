---
name: feedback-verify-mechanism-before-policy
description: Verify the mechanism before asserting anything about it — a policy, a tool's behaviour, or a build's state. Received advice about a tool is a claim to probe, not a fact.
metadata:
  type: feedback
---

Before recommending a _policy_ about a tool (pin it, gate it, configure it this way), verify the **mechanism** the policy rests on. Han reliably probes the mechanism, and when the probe contradicts the framing, the recommendation collapses.

**Why:** twice in one ticket (okf-frontmatter-harness #5, archgate version pinning) my recommendation was wrong because I had asserted a mechanism without checking it:

1. I recommended "drop the caret, exact-pin `archgate`". He asked _"can we pin a version range to be more flexible?"_ — checking revealed that for a `0.x` version npm's caret **already** means `>=0.55.0 <0.56.0`. The caret was never the problem; the absence of any comparison against the running binary was. My recommendation would have been churn.
2. I framed pinning as an npm-packaging question. He asked _"can't we execute it from node_modules or npx?"_ — the package turns out to ship **no binary at all** (36K, four files, no `optionalDependencies`), just a shim over a global unversioned cache. That reframed the whole ticket: the declared version cannot pin the binary, so the answer had to become an assertion, not a pin.

3. Later, in #6, I reported "`npm run verify` is red on `main`, and it isn't mine" after stashing my edit and re-running _inside a worktree_. That test proves only that my edit was not the cause; I never checked out `main`. `knip` fails in a worktree and passes on `main`, so the report was a false alarm that cost Han attention on a non-problem. The wording "pre-existing on `main`" asserted a place I had not looked.

4. In #12 the mechanism check **worked, and it is worth keeping the shape.** Han relayed advice he had been given — _"the `files` property does not matter for archgate, it's just metadata"_ — which had shaped GEN-001's frontmatter. Reading the Zod schema out of the 0.55.0 binary showed `files` is the **only** scope key and `paths` is not in the schema at all, and a before/after probe measured scope collapsing from 58 files to 3. The same probe then caught that Han's _own_ reframing ("GEN-001's job is only `paths:` ⇒ symlink") did not survive either, because a lone symlink deletion is exactly what the narrowed scope stops waking. Both the received advice and the fresh framing were wrong in the same direction, and one probe caught both.

**Received advice about a tool is a claim, not a fact — including advice Han relays.** He is not asserting it; he is telling you what he was told, and he expects it checked. Probing it is never treated as second-guessing him.

**How to apply:** when about to recommend a rule about a dependency's versioning, resolution, or config, first read the actual shipped artifact — the shim/bin source, the manifest's `files`/`bin`/`optionalDependencies`, the resolution order — and _run the probe_ rather than reasoning from how such tools usually work. Both of his questions were answerable in one tool call each; neither should have needed asking. He engages well with a proven negative ("I tested `HOME` relocation, it works, here's why I still advise against it") — a verified rejected alternative is worth more to him than an unexamined recommendation.

Corollary from instance 3, which generalises past dependencies: **name the place you actually tested, not the place you are extrapolating to.** "Fails in this worktree" and "fails on `main`" are different claims, and only one of them was checked. The same applies to "the tool does X" when the probe ran under one flag, and "the spec says X" when only one section was read. State the scope of the evidence in the sentence that carries the claim. See [[feedback-design-decisions-need-precedent]] and [[feedback-prefer-documented-signals]].
