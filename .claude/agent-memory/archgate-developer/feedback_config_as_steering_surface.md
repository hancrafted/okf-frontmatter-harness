---
name: feedback-config-as-steering-surface
description: Han treats a config file as prose an agent will query before writing, not just data a checker reads — so he wants one steering property, used uniformly, to limit staleness.
metadata:
  type: feedback
---

**A config Han designs is meant to be _read by an agent before it acts_, not only consulted by a
checker after. Design every human-readable string in it as an answer to "what should I write here,
and why".**

**Why:** on okf-frontmatter-harness ticket #17 I asked whether the config's `intent:` was a _reason_
(explaining why a rule exists, appended to a violation) or an _instruction_ (telling an agent what to
write). He rejected the split:

> _"My idea is that the config doubles as instruction and also reason. Right now we are more on the
> reason side if the on errors or violations but a natural extension … is then to provide a script or
> MCP … which the agent can query when it is about to update a description field … and hence it's a
> steering mechanism before updating or authoring."_

That named a **future consumer that did not exist yet** and changed what the config's prose is for.
It also produced the decision: **one property, used uniformly**, so a query has one slot to return —
`types[].purpose` was renamed to `intent`, giving the whole config a single steering word.

**How to apply:**

1. **When he adds a prose field, ask what will _render_ it, including things not built yet.** This is
   [[feedback-no-ceremony-without-consumer]] pointed forward rather than backward: a consumer that is
   planned still counts, and naming it is what justifies writing the prose well. #9's own finding is
   the mechanism — coverage tracks whether prose appears in the primary reading surface.
2. **His stated constraint is staleness, not verbosity.** _"This is a string on natural language which
   definitely can become stale. I want to reduce that to keep it more maintainable."_ So the argument
   that wins is "fewer strings to keep fresh", not "fewer characters". Offer consolidation on those
   grounds.
3. **One name across positions beats an accurate name per position.** He accepted `intent` on a type
   record even after I said plainly that `purpose` reads better there. Precedent that landed: GraphQL,
   JSON Schema and OpenAPI put a single `description` on every schema element, and the format that
   gave values their own word (VS Code `enumDescriptions`) sits about half-empty.
4. **Expect the queryable-surface idea to recur.** It is the third time a job has been split into a
   standalone program rather than bolted onto the rules — see [[feedback-explicit-over-inherited]]
   item 4. `RuleContext` has no write and rules run only on `check`, so anything answering a question
   rather than reporting an error cannot be a rule.
