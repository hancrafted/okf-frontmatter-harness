---
name: feedback-dogfood-on-real-files
description: Han will create real files so a shipped rule fires on one — a file that exercises a rule has a consumer, so don't call it ceremony or push it to a test fixture.
metadata:
  type: feedback
---

**When a shipped rule would otherwise match nothing, Han creates a real file to exercise it.** Offer
that option before offering a mocked fixture, and do not label such a file ceremony.

**Why:** on okf-frontmatter-harness ticket #10 (the default ruleset) I counted that three of the six
shipped rules matched zero files in this repo, and recommended covering two of them from
`.rules.test.ts` fixtures — arguing an `index.md` added only to be checked would be ceremony, since
nothing reads it and #8 had ruled the harness can never generate or require one. He overruled it and
named exact paths: `docs/research/index.md`, plus a log file. He had already pushed the same way on
the type vocabulary — _"the list should serve as dogfood"_.

He was right, and my ceremony call was wrong on its own terms: with nine research documents an index
earns its place, and §8 (Index files) says entries carry each file's `description`, which is exactly
the mechanism the harness governs. The file also turned out to exercise **more** than the rule it was
created for — first-match ordering on a real file, and the Floor's one permitted escape — neither of
which a fixture proves.

**How to apply:**

1. **Read this as the boundary of [[feedback-no-ceremony-without-consumer]], not a contradiction.**
   The consumer test still holds; a file that makes a shipped rule fire simply _has_ a consumer —
   the rule, and `archgate check` going green over it. Ask "does anything read this?" and count the
   governance mechanism as a reader.
2. **Fixtures cover what a real file cannot reach, not the other way round.** He asked for fixture
   configs in the same session, so the split he wants is: real files prove the shipped rules work,
   fixtures reach the config-validation and membership paths no real file can. Propose both, and say
   which does which.
3. **A green check over nothing is what he is guarding against.** When recommending a scope, count
   how many files each rule actually matches and say so unprompted — the count is what moved him.
   Same instinct as [[feedback-verify-mechanism-before-policy]]: verify the rule fires somewhere
   before claiming it is proven.
4. **"Dogfood in v1" is his scoping phrase.** It narrows a decision to what demonstrates the thing
   works, and it is a scope _narrowing_, not a licence to skip. On the same ticket it cut ADR
   governance from all of `.archgate/adrs/**` down to `.archgate/adrs/OKF-*.md`.
