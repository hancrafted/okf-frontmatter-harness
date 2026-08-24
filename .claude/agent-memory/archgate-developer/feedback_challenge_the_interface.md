---
name: feedback-challenge-the-interface
description: Han overrules a spec that blocks a real need, but stays conformant when divergence buys only convenience — the test is what the clause costs, not how much he likes it.
metadata:
  type: feedback
---

**Read this with its counterweight at the bottom.** The rule is not "Han diverges"; it is that he
prices each clause. A clause that blocks a real workflow gets overruled and named. A clause that
merely inconveniences the design gets obeyed, and he will reverse his own proposal to obey it.

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

## The counterweight: conformance is his tiebreaker

**When divergence buys only convenience, he stays conformant — and will reverse his own proposal to
do it.** On ticket #9 he proposed making the config's `types:` list mandatory, with a good argument
(one canonical vocabulary makes casing and plural drift fail deterministically). Surfacing what it
cost — OKF names _"defining a fixed taxonomy of concept types"_ a Non-goal, §4.1 (Frontmatter) says
type values are _"not registered centrally"_, and §11 (Conformance) says consumers _"MUST NOT reject
a bundle because of … Unknown `type` values"_ — got the reply **"go back to your original proposal B
so we stay OKF conformant."**

The distinction against #8, where he overruled §8 (Index files):

|                         | #8 — diverged                                                                          | #9 — conformed                                          |
| ----------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| what the clause blocked | a generated index recording that it was generated: a real workflow with no alternative | nothing; the drift it prevents is catchable another way |
| cost of obeying         | a capability disappears                                                                | slightly weaker default                                 |
| what he did             | permitted frontmatter, named the divergence, filed upstream                            | withdrew his own proposal                               |

**How to apply:** when a spec clause is in the way, do not lead with "we could diverge". State what
obeying actually costs, in one line, and let the size of that cost carry the recommendation. And
note the shape of the win: making the check **opt-in** kept conformance _and_ kept the capability —
a repo that declares `types:` chooses to be stricter about its own files, which is house policy and
never a divergence at all. Reach for opt-in before divergence; see
[[feedback-optional-by-default]].
