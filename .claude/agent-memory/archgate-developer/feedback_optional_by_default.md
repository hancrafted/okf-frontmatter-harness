---
name: feedback-optional-by-default
description: Han withdraws "mandatory" once it is priced — check whether anyone else mandates the thing before recommending it, and offer opt-in as the way to keep the capability.
metadata:
  type: feedback
---

**Before recommending that anything be mandatory, find out whether any comparable system mandates
it.** Twice in one ticket the honest answer was "nobody does", and both recommendations died.

**Why:** on okf-frontmatter-harness ticket #9 I twice argued for a required thing and was twice
overruled by evidence I should have gathered first.

| I recommended                       | what the survey found                                                                                                                                                                                                                 | outcome                      |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| a **mandatory** `types:` vocabulary | every surveyed system that retrofits governance onto _existing_ markdown makes its vocabulary optional; only tools that _author_ the content (Decap, Contentful) mandate one, because declaration necessarily precedes the first file | withdrawn                    |
| a **mandatory** per-type `purpose`  | across ten ecosystems, **zero** formats require per-value prose; the strongest language anywhere is a `SHOULD` with a self-evidence escape (GraphQL, VS Code). Two mandate a short _label_, never a sentence                          | withdrawn; he chose optional |

Docusaurus carries the reason in a source comment — `// Retro-compatible behavior: existing sites do
not yet have tags.yml` — and its lead maintainer overruled a fail-by-default proposal outright. The
axis that decides it is **who authors the content first**, and it is not a taste question.

**How to apply:**

1. **"Mandatory" is a claim about the world, so check the world.** The question to research is not
   "is this a good idea" but "does anyone require this, and what happened to them". Same discipline
   as [[feedback-design-decisions-need-precedent]], aimed specifically at requiredness.
2. **Offer opt-in as the move that keeps the capability.** It is what resolved both cases — an
   optional `types:` still closes the vocabulary for repos that want it, without making the harness
   stricter than the interface by default. See [[feedback-challenge-the-interface]] for why that also
   dissolves a would-be divergence.
3. **Optional prose only gets written if something renders it.** A census of SchemaStore found
   per-value annotations on **1.22%** of enum sites, while GitHub's GraphQL schema describes
   1,301 of 1,301 — the difference is whether the prose appears in the primary reading surface. So
   when he accepts an optional field, make sure some output actually prints it, or it will sit empty.
4. **Watch for "master data".** It is his framing for canonical reference data — a list of records
   the project owns rather than a constant inside the tool — and it carries real consequences he
   expects you to follow through: records over bare scalars, duplicates detectable, and room for the
   record to gain fields later without a breaking change. Reaching for it unprompted, when designing
   anything enumerable, will land. Pairs with [[feedback-explicit-over-inherited]].
