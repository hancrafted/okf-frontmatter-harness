---
name: feedback-challenge-the-interface
description: Han will overrule a spec the project claims to implement when the spec blocks a real need — offer the divergence option, name it, and file it upstream rather than assuming the interface is fixed.
metadata:
  type: feedback
---

When a spec the project treats as an **interface** blocks something the project genuinely needs,
Han diverges from the spec. Put that option on the table instead of treating the interface as a
fixed constraint you design around.

**Why:** on okf-frontmatter-harness ticket #8 I built an entire recommendation on OKF §8 (Index
files)'s rule that _"index files contain no frontmatter"_, and framed non-compliance as the failure
mode to avoid. Han's reply was _"Can you reason why the index.md should contain no frontmatter? AI
authored or nightly jobs updating stale index should leave a trace"_ — and he was right: §8 forbids
frontmatter on the very files §8 itself says producers MAY **generate**, so §5.2 (Trust: `generated`
and `verified`) is unusable exactly where machine authorship is likeliest. That is a defect in the
spec, not a constraint to satisfy. My recommendation reversed completely, and the resulting model
was simpler — no reserved-filename concept in the harness at all.

**How to apply:**

1. **Before recommending compliance, ask what the spec's rule costs.** If a clause blocks a real
   workflow, say so and offer divergence as a named option. Being an implementer of an interface
   does not make its every clause correct; [[project-okf-frontmatter-harness]] frames OKF as an
   interface, not an authority.
2. **A divergence must be named, not absorbed.** Same instinct as
   [[feedback-name-the-boundary]] — record it in the ADR beside the divergences already accepted
   (`type`-as-string from #6), and record divergences pointing _both_ ways honestly. #8 ended up
   permitting frontmatter where §8 forbids it _and_ forbidding the one key §8 allows.
3. **Offer to file it upstream.** He chose "record it and file it" over "record it" when asked.
   Frame the filing as a question about the interaction of two sections, not a feature request.
   **Note the tooling limit:** `gh issue create --repo <third-party-org>/<repo>` is blocked by the
   permission classifier, so draft the issue, preserve it as a comment on the wayfinder ticket, and
   hand the filing to Han.
4. **Check the reference implementation, not just the spec text.** For #8 the two disagreed, and the
   disagreement was the whole finding: all 29 `index.md` files in OKF's reference bundles obey §8,
   while its single `log.md` contradicts §9 (Log files)'s own example. That split is what justified
   giving the two filenames _different_ default rules. See
   [[feedback-verify-mechanism-before-policy]].
