---
name: project-gen001-upstream
description: GEN-001 is a guest in this repo — it came from another archgate repo, governs ADRs universally, and changes made here are meant to be lifted back upstream.
metadata:
  type: project
---

**`.archgate/adrs/GEN-001-adr.md` did not originate here.** Han brought it from another repo,
where it is meant to universally govern archgate ADRs. He works on it locally in
`okf-frontmatter-harness` and extracts the changes upstream later, by hand.

**Why:** stated during wayfinder ticket
[#12](https://github.com/hancrafted/okf-frontmatter-harness/issues/12) (2026-08-24), when a fix to
GEN-001's scope keys raised the question of how far to change it. Nothing in the repo marks the
file as upstream-owned — no comment, no provenance note, no separate remote — so this is not
derivable from the code.

**How to apply:** when editing GEN-001, prefer changes that describe **archgate's own behaviour**
over changes that encode something local to this repo, and say in the resolution which edits are
portable and which are local convention. A local-only rule is still acceptable when it is _inert_
elsewhere rather than harmful — the `paths:` ⇒ `files:` rule in
[#14](https://github.com/hancrafted/okf-frontmatter-harness/issues/14) qualifies, because upstream
archgate ADRs mostly carry no `paths:` at all, so it never fires there. Removing an existing rule
is a heavier act than adding one for the same reason: it changes the contract for repos you cannot
see, which is why Han left §4.4's orphan check undecided rather than dropping it. Related:
[[project-okf-frontmatter-harness]], [[feedback-verify-mechanism-before-policy]].
