---
name: feedback-no-ceremony-without-consumer
description: Han rejects an artifact nothing reads — and precedent borrowed from a different mechanism class is what makes a recommendation read as overengineered.
metadata:
  type: feedback
---

Before recommending that something be recorded, pinned, or declared, answer **"what reads
this?"** If the answer is nothing, drop it. And when citing precedent, check that the
precedent's **mechanism class** matches what you are proposing — an _enforced_ mechanism is
not evidence for a _documentary_ one.

**Why:** on okf-frontmatter-harness ticket #13 I recommended recording a `sha256` of the OKF
spec, and backed it with npm `integrity`, `go.sum` and Docker `@sha256:` digests. Han replied
_"explain why we need this now, seems overengineered for v1"_ — and he was right twice over.
Every precedent I cited is an **enforced** pin with machinery behind it; I was proposing a
line of ADR prose. Borrowing their authority for a footnote is what made it read as
ceremony. Worse, his own earlier answer had already dissolved the need: once he ruled drift
detection out of scope, **nothing would ever read the hash**, and once he approved vendoring
the spec file, git was already content-addressing it. The recommendation collapsed from
"version string vs hash vs SHA vs date" to "the vendored file is the pin, and no hash is
recorded anywhere."

**How to apply:**

1. **Run the consumer test on every recorded value.** A key in a config file, a hash in an
   ADR, a version assertion — if no code branches on it and no human workflow consumes it,
   it is dead weight. This is the same reasoning that killed `okfVersion:` in the config that
   session, and it is why _a comment is the honest form_ of a fact nothing reads: a comment
   cannot pretend to be read, and a key can.
2. **Check whether an earlier answer already subsumed the question.** Han answers in order,
   and a later question is often already decided by an earlier "OK". Re-derive against the
   answers you already have before defending a round-1 position — see
   [[feedback-grilling-han]].
3. **Precedent must match mechanism class, not just topic.** [[feedback-design-decisions-need-precedent]]
   says bring evidence; this says the evidence must be _of the same kind_. Enforced-vs-documentary,
   generated-vs-hand-written, blocking-vs-advisory. A mismatch reads as overengineering even
   when the underlying call is right.
4. **Name the retreat, don't perform it quietly.** Saying "the analogy was wrong and here is
   why" landed better than softening the recommendation would have. Consistent with
   [[feedback-name-the-boundary]].
