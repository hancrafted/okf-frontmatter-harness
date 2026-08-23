---
name: project-wayfinder-concurrency
description: Han runs wayfinder tickets in parallel sessions on the okf-frontmatter-harness map — assignee claims do not prevent duplicate resolution, so re-check ticket state before posting.
metadata:
  type: project
---

Han runs **multiple wayfinder sessions concurrently** against the map in `okf-frontmatter-harness`. On 2026-08-23, ticket #3 was resolved twice within three minutes by two independent sessions that had both claimed it and both independently chose the same four-slice decomposition.

**Why:** the wayfinder skill anticipates this ("the user may run unblocked tickets in parallel, so expect other sessions to be editing the tracker concurrently"), but the claim mechanism is advisory — assigning yourself does not lock anything, and a session that started earlier never sees the later claim.

**How to apply:**

- **Re-read the ticket state immediately before posting a resolution**, not just at claim time. `gh issue view <n> --json state,comments` costs nothing.
- **Never `cat >` a research deliverable without checking whether it already exists.** I overwrote a concurrent session's synthesis file this way; only its issue comment preserved the content. Prefer checking `ls`/timestamps first, and merge rather than replace.
- **Expect duplicate Decisions-so-far entries on the map** and dedupe into one merged line.
- Losing work is recoverable _only_ because wayfinder posts the answer as an issue comment before touching files. That ordering is a safety property — keep it: comment first, then write files.
- **A session can die mid-ticket having already committed code but never posted the resolution.** On 2026-08-23 ticket #5 was claimed, its code fix committed (`9bafe64`), and then the session terminated — leaving an open, assigned ticket with zero comments and the work invisible on the tracker. **Before starting a claimed-but-unresolved ticket, run `git log` and check the working tree**: half the ticket may already be done, and re-deciding it wastes the session. Conversely, an assignee is not evidence that anything happened.

See [[project-okf-frontmatter-harness]] and [[feedback-design-decisions-need-precedent]].
