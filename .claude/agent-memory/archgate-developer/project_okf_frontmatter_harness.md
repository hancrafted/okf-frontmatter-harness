---
name: project-okf-frontmatter-harness
description: Why okf-frontmatter-harness exists — a publishable OKF v0.2 governance harness for agentic markdown repos — and the scoping decisions behind its wayfinder map.
metadata:
  type: project
---

`okf-frontmatter-harness` implements **Google's Open Knowledge Format v0.2 as an interface**: OKF defines the frontmatter vocabulary, the harness provides configurable deterministic checks (archgate ADRs + `.rules.ts`) for the fields OKF proposes, staying permissive toward everything else.

**Why:** Agentic projects generate a lot of markdown (CONTEXT.md, AGENTS.md, ADRs, skills) with no governance. Han wants agents to self-govern frontmatter at authoring time via ADRs loaded through `.claude/rules`, with `archgate check` as the deterministic backstop.

**The northstar is npm/npx distribution** — `npx` into any repo, bootstrap archgate, copy ADRs and rules — plus publishing the ADRs to [awesome-adrs](https://github.com/archgate/awesome-adrs) as an ADR-Pack. Both are deliberately **out of scope** of the first wayfinder map (2026-08-22), which targets a self-hosted working harness in this repo first. But portability still constrains every in-scope decision: "every decision must survive being copied into a foreign repo unchanged."

**How to apply:** The wayfinder map is the live source of truth for this effort — read it before assuming anything about state, since it holds the settled decisions, the fog, and the out-of-scope rulings. Do not treat the npm/ADR-Pack work as available scope; it returns only as a fresh effort. Han defers big design questions deliberately rather than settling them hastily (he pushed the config-schema grill into its own blocked ticket), so resist pressure to resolve downstream design early. See [[feedback-design-decisions-need-precedent]].
