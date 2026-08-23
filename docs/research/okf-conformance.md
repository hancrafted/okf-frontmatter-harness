# OKF v0.2 Conformance: What the Spec Requires vs What It Merely Recommends

Research question: the harness implements OKF as an _interface_, so it must know exactly
where the specification ends and house policy begins. Specifically:

1. Does OKF v0.2 ship a **reference validator, linter, JSON Schema, or conformance suite**?
   If so, what does it enforce versus merely document?
2. What is the **requirement floor** — is non-empty `type` really the only OKF-defined
   requirement on a concept's frontmatter?
3. What is the **`type` value convention**, and does anything normative constrain casing?
4. How are `index.md` / `log.md` handled by real tooling?
5. Is `okf_version` used in practice, and does anything read it?
6. Any **v0.3** signal — issues, discussions, roadmap, field renames under consideration?

All evidence below is from primary sources: the specification text, first-party source code,
committed reference bundles, and the upstream issue tracker. Every load-bearing claim is
quoted. Where a fact could not be established from a primary source, this document says so.

---

## 0. Source provenance — read this first

**OKF has moved.** The specification is no longer maintained in
`GoogleCloudPlatform/knowledge-catalog`. That repo's `okf/README.md` now opens with:

> **OKF now lives in its own repository:
> [GoogleCloudPlatform/open-knowledge-format](https://github.com/GoogleCloudPlatform/open-knowledge-format).**
>
> That repository is the canonical home of the specification, the reference agent, and the
> sample bundles. Please read the spec, file issues, and open pull requests there.
>
> **Stop using the copy under `okf/` in this repository.** It is a frozen snapshot, no
> longer maintained, and anything built against it will drift out of date.

The new repo was created 2026-08-11 and made public on/around 2026-08-21 (PR #324 noted at
review time that it was "currently **private**, so the link in this notice will 404").

**The good news — the text we pinned is the canonical text.** All three copies of `SPEC.md`
are byte-identical (1006 lines, `sha256 26aa5da029278939f914e578107242d9607d4f2dc5fe153272b82f9ed1030101`):

| Copy                                                               | Status    |
| ------------------------------------------------------------------ | --------- |
| Local working copy used for this research (`/tmp/okfspec/SPEC.md`) | identical |
| `knowledge-catalog@HEAD` → `okf/SPEC.md` (frozen snapshot)         | identical |
| `open-knowledge-format@HEAD` → `SPEC.md` (canonical)               | identical |

**But "v0.2" is a moving target.** `SPEC.md` has only four commits, and the most recent one
changed _normative_ v0.2 content in place, with no version bump:

| Commit     | Date       | Change                                                                     |
| ---------- | ---------- | -------------------------------------------------------------------------- |
| `ee67a5ca` | 2026-06-12 | Import reference enrichment agent (v0.1)                                   |
| `780fe9d3` | 2026-07-24 | Migrate format and tooling to OKF v0.2 (#227)                              |
| `3fcbb9f8` | 2026-07-24 | Update SPEC.md                                                             |
| `62432a09` | 2026-08-21 | "make every timestamp an ISO 8601 datetime with an explicit offset" (#323) |

That last commit is a breaking change to producers wearing a non-breaking label. Before it,
`stale_after: 2026-09-23` was the spec's own example; after it, the example reads
`stale_after: 2026-09-23T00:00:00Z` and §5 gained:

> Every timestamp-valued key in OKF is an ISO 8601 datetime with an explicit UTC offset, for
> example `2026-06-30T14:00:00Z`.

The same commit converted `last_modified` from documented `YYYY-MM-DD` to a datetime, and
`usage_window` from a "date range" to a "datetime range".

> **Implication for the harness.** "Pin v0.2" cannot mean pinning the _string_ `0.2`. A
> bundle written against v0.2-as-of-July is non-conformant against v0.2-as-of-August under
> the identical version string. Standing preference 9 should be read as pinning a **SPEC.md
> content hash**, and the ADR should record the hash above alongside the version.

---

## 1. Summary — the answers

| Question                                                        | Answer                                                                                           |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Reference validator / linter / JSON Schema / conformance suite? | **No. None exists**, in either repo.                                                             |
| Closest first-party artifact                                    | `OKFDocument.validate()` — checks exactly one thing: `type` is present and truthy.               |
| Requirement floor on a concept's frontmatter                    | **Non-empty `type`, and nothing else.** Confirmed by spec text _and_ by reference code.          |
| …but is that the whole conformance story?                       | **No** — see §3.2. Three clauses, not one; reserved files carry their own MUSTs.                 |
| Does anything normatively constrain `type` casing?              | **No. Zero casing language in the entire spec.**                                                 |
| What do real bundles do?                                        | **100% space-separated Title Case** (54/54 occurrences).                                         |
| Is the kebab-case evidence real?                                | **No — red herring.** It is a different tool's format (see §5.4).                                |
| Is `type: adr` conformant?                                      | **Yes, unambiguously.** §11 forbids rejecting unknown `type` values.                             |
| Should the harness ship a `checkCase` gate on `type`?           | **No** — archgate's schemes cannot even express the OKF convention (§5.6).                       |
| `index.md` handling                                             | Generated by tooling; never validated.                                                           |
| `log.md` handling                                               | **Not handled at all** by any first-party code. Its frontmatter rule is disputed and unresolved. |
| `okf_version` in practice                                       | **Never used.** Zero occurrences outside the spec; nothing reads it.                             |
| v0.3 signal                                                     | No branch, no milestone, no roadmap. Community proposals only, **zero maintainer replies**.      |

---

## 2. Is there a reference validator? — No

**Neither repo contains a validator, linter, JSON Schema, or conformance test suite.**
`git ls-files` filtered for `schema|valid|conform|lint` across the canonical repo returns
nothing. The only console entry point declared in `pyproject.toml` is:

```toml
[project.scripts]
reference-agent = "reference_agent.cli:main"
```

— a _generator_, not a checker. There is no `okf validate`, no `okf lint`, no `.json` schema.

### 2.1 The one first-party conformance artifact

`src/reference_agent/bundle/document.py` is the entire OKF "validator". It is 133 lines, and
the conformance logic is four lines:

```python
# OKF v0.2 §11: `type` is the only always-required frontmatter key.
REQUIRED_FRONTMATTER_KEYS = ("type",)
```

```python
def validate(self) -> None:
    missing = [k for k in REQUIRED_FRONTMATTER_KEYS if not self.frontmatter.get(k)]
    if missing:
        raise OKFDocumentError(
            f"Missing required frontmatter keys: {', '.join(missing)}"
        )
```

Note `not self.frontmatter.get(k)` — this rejects both a _missing_ `type` and an _empty_
one, matching §11's "non-empty `type` field" precisely. It checks nothing else: no casing,
no enum of legal type values, no `title`/`description`/`resource`/`tags`, no link checking.

The accompanying test states the floor as a named assertion:

```python
def test_validate_accepts_type_only():
    # OKF v0.2 §11: `type` is the only always-required key.
    OKFDocument(frontmatter={"type": "X"}).validate()
```

`validate()` is called from exactly one place — `write_concept_doc()` in
`tools/bundle_tools.py`, i.e. on the _write_ path of the generating agent. Nothing validates
a bundle on read. The viewer (`viewer/generator.py`) and the index builder
(`bundle/index.py`) both parse documents and **swallow errors**:

```python
def _load_doc(path: Path) -> OKFDocument | None:
    try:
        return OKFDocument.parse(path.read_text(encoding="utf-8"))
    except Exception:
        return None
```

That is §11's "consumers MUST NOT reject" posture implemented literally.

### 2.2 Third-party validators exist, but are not normative

Two community tools surfaced, both explicitly non-first-party:

- **`okft`** — `pip install okft`, announced in
  [knowledge-catalog#196](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/196)
  (2026-07-14). Author's description: "`okft lint` — spec-conformance checks (frontmatter,
  `type`, reserved files) plus hygiene warnings… Broken links are warnings, not errors, per
  the spec's tolerance requirement." **Targets OKF v0.1**, and predates the v0.2 migration
  (2026-07-24).
- **`okf-skills`** — mentioned by its author in
  [knowledge-catalog#286](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/286):
  "Our validator (okf-skills, mine, disclosure) warns on `acme_retail/log.md` itself: '§9
  log.md should contain no frontmatter'."

Neither has maintainer endorsement. **The harness must not treat either as the interface.**

---

## 3. The requirement floor

### 3.1 The direct answer to the ticket's spec-reading question

**Confirmed: there is no OKF-defined requirement on a concept's frontmatter beyond a
non-empty `type`.** The ticket's reading of §4.1 versus §11 is correct.

§4.1 is unambiguous, and says so in its own words:

> `type` is the only always-required key; a concept carrying just `type` is fully conformant
> (§11).

The §4.1 "**Recommended:**" heading covering `title`, `description`, `resource`, `tags`
carries **no RFC 2119 keyword at all** — it is a bare English heading, not a `SHOULD`. And
§11 closes the door explicitly:

> Consumers SHOULD treat all other constraints as soft guidance. In particular, consumers
> MUST NOT reject a bundle because of:
>
> - Missing optional frontmatter fields.
> - Unknown `type` values.
> - Unknown additional frontmatter keys.
> - Broken cross-links.
> - Missing `index.md` files.

Reinforced at §4.1: "Producers MAY include any additional keys. Consumers SHOULD preserve
unknown keys when round-tripping and MUST NOT reject documents with unrecognized fields."

And the reference agent's own prompt (`prompts/reference_instruction.md`) tells its model:

> Only `type` is strictly required; the rest are strongly recommended.

### 3.2 …but conformance has three clauses, not one

The floor is correct for _a concept's frontmatter keys_. It is **not** the whole of §11. The
harness should not conflate the two. §11 verbatim:

> A bundle is **conformant** with OKF v0.2 if:
>
> 1. Every non-reserved `.md` file in the tree contains a parseable YAML frontmatter block.
> 2. Every frontmatter block contains a non-empty `type` field.
> 3. Every reserved filename (`index.md`, `log.md`) follows the structure in §8 and §9
>    respectively when present.

Two obligations here are easy to miss:

- **Clause 1 is a parseability requirement.** A concept with a malformed or unterminated
  frontmatter block is non-conformant _even if a `type` is visible in it_. This is a real,
  checkable requirement distinct from clause 2.
- **Clause 3 pulls in the reserved-file structure rules**, which contain their own MUSTs:
  - §8: "Index files contain no frontmatter, with one exception: a bundle-root `index.md`
    MAY carry an `okf_version` key (§12)."
  - §9: "Date headings MUST use ISO 8601 `YYYY-MM-DD` form."
  - §3.1: reserved filenames "MUST NOT be used for concept documents".

### 3.3 Complete inventory of every MUST / REQUIRED in the spec

The entire specification contains **16** lines carrying `MUST` or `REQUIRED`. Exhaustively:

**Unconditional producer obligations** (these are the real floor):

| §   | Line    | Obligation                                                  |
| --- | ------- | ----------------------------------------------------------- |
| 3.1 | 137     | Reserved filenames "MUST NOT be used for concept documents" |
| 4.1 | 165     | `type: <Type name>` — `# REQUIRED`                          |
| 11  | 740–744 | The three conformance clauses above                         |

**Conditional producer obligations** — these bind _only if you opt into the optional family_:

| §    | Line | Obligation                                                                                 |
| ---- | ---- | ------------------------------------------------------------------------------------------ |
| 5.1  | 305  | "`resource`: REQUIRED within an entry" — only if you write `sources`                       |
| 5.2  | 377  | "`generated.by`: REQUIRED within `generated`" — only if you write `generated`              |
| 7    | 501  | "producers MUST use it [the `human:` prefix] for hand-authored or human-confirmed content" |
| 9    | 550  | "Date headings MUST use ISO 8601 `YYYY-MM-DD` form" — only if a `log.md` exists            |
| 10.2 | 590  | "`runtime`: REQUIRED for this type" — only for `type: Attested Computation`                |
| 10.4 | 662  | An agent "MAY only supply _values_ for the declared `parameters`"                          |

**Consumer obligations** — every remaining MUST is a constraint on _readers_, and every one
of them is a prohibition against rejecting:

| §        | Line     | Obligation                                                    |
| -------- | -------- | ------------------------------------------------------------- |
| 4.1      | 183      | Consumers "MUST tolerate unknown types gracefully"            |
| 4.1      | 206      | "MUST NOT reject documents with unrecognized fields"          |
| 5.2 / 11 | 395, 749 | "MUST treat a bare `verified` mapping as a one-element list"  |
| 5.3 / 11 | 409, 750 | "MUST NOT reject a concept for missing any optional family"   |
| 6.1      | 464      | "Consumers MUST tolerate broken links"                        |
| 11       | 756      | "MUST NOT reject a bundle because of" the five listed reasons |

> **Reading.** OKF is almost entirely a _consumer-restraint_ specification. Of 16 MUSTs, 6
> constrain producers (4 of them conditionally), and 6 forbid consumers from rejecting
> anything. A harness "implementing OKF as an interface" inherits far more obligations to
> _accept_ than to _enforce_.

---

## 4. Is the harness's `type: adr` conformant? — Yes

Unambiguously. §11 lists "Unknown `type` values" among the things a consumer MUST NOT reject
a bundle for, and §4.1 states type values "are **not** registered centrally". `adr` is a
short, descriptive, self-explanatory string. It satisfies every stated constraint.

---

## 5. The `type` casing question

### 5.1 The spec says nothing about casing — literally nothing

A case-insensitive grep of the full 1006-line spec for
`lowercase|uppercase|title case|kebab|snake_case|camel|capitalise|capitalize|casing|case-sensitive|case-insensitive`
returns **zero matches**.

The complete normative guidance on `type` values is:

> - `type`: A short string identifying the kind of concept. Consumers use it for routing,
>   filtering, and presentation. Example values: `BigQuery Table`, `BigQuery Dataset`,
>   `API Endpoint`, `Metric`, `Playbook`, `Reference`, `Attested Computation`.
>
>   Type values are **not** registered centrally. Producers SHOULD pick values that are
>   descriptive and self-explanatory; consumers MUST tolerate unknown types gracefully,
>   typically by treating them as generic concepts.

The only `SHOULD` is "descriptive and self-explanatory". There is no `SHOULD` on form.

### 5.2 What real bundles do — 100% Title Case

Across the four official reference bundles (`acme_retail`, `crypto_bitcoin`, `ga4`,
`stackoverflow`), identical in both repos, all 54 `type:` declarations:

| `type` value           | Count |
| ---------------------- | ----- |
| `BigQuery Table`       | 22    |
| `Reference`            | 20    |
| `Metric`               | 3     |
| `BigQuery Dataset`     | 3     |
| `Policy`               | 2     |
| `Attested Computation` | 2     |
| `Skill`                | 1     |
| `Log`                  | 1     |

**Zero** kebab-case, snake_case, or lowercase values. Note also that `Policy`, `Skill` and
`Log` are types _not_ named anywhere in the spec — producers did invent types, and
consistently matched the Title Case house style when they did.

### 5.3 Why Title Case — the mechanical reason

This is not decorative. `type` is rendered **verbatim as a markdown H1 heading** in generated
index files. From `src/reference_agent/bundle/index.py`:

```python
for typ, title, link, desc in entries:
    grouped[typ or "Other"].append((title, link, desc))

sections: list[str] = []
for typ in sorted(grouped):
    lines = [f"# {typ}", ""]
```

The committed bundles confirm the output — every official `index.md` begins with a heading
that _is_ a type string:

```
okf/bundles/acme_retail/tables/index.md      -> # BigQuery Table
okf/bundles/acme_retail/computations/index.md -> # Attested Computation
okf/bundles/crypto_bitcoin/references/metrics/index.md -> # Reference
okf/bundles/acme_retail/index.md             -> # Subdirectories
```

Two incidental findings from the same code: a falsy `type` falls back to the group `"Other"`,
and subdirectories are grouped under a **pseudo-type `"Subdirectories"`** that never appears
in any frontmatter.

So the convention's driver is presentational: `type: adr` would render as `# adr`. That is a
cosmetic consequence in a _generated index the harness does not generate_ — not a
conformance issue.

### 5.4 The kebab-case evidence is a red herring

Kebab-case `type` values _do_ exist in the knowledge-catalog repo — `bigquery-table`,
`bigquery-dataset`, `document`, `<entryType>`. Every single one is under `toolbox/mdcode/`:

```
toolbox/mdcode/docs/concept.md:480   type: bigquery-dataset
toolbox/mdcode/docs/concept.md:503   type: bigquery-table
toolbox/mdcode/docs/concept.md:602   type: document
toolbox/mdcode/README.md:64          type: bigquery-table
```

**`mdcode` is a different tool with a different format.** Its `type` key belongs to a
Dataplex/Knowledge-Catalog _entry YAML_ document (sibling keys `id`, `resource`,
`aspects`, `labels`, `createTime`), not to OKF frontmatter — and those kebab values are
Dataplex **entry type** identifiers, which are lowercase by Dataplex's own convention. A grep
of `toolbox/mdcode/README.md` for `okf|open knowledge format` returns nothing.

Confirming the separation: mdcode's own _OKF demo_ bundle
(`toolbox/mdcode/demo/okf/catalog/**`) uses Title Case throughout — `BigQuery Table`,
`BigQuery Dataset`, `Reference`.

Also worth noting: nothing normalizes casing on the way out. The canonical repo's
`connectors/gcp-knowledge-catalog.md` documents that `type` is carried verbatim onto a custom
`okf` aspect.

### 5.5 Verdict

Title Case with spaces is a **strong, unanimous, mechanically-motivated de-facto convention
with zero normative force.** The spec constrains casing not at all; §11 affirmatively
protects unknown values. Both statements are true simultaneously, and the harness should
record both.

### 5.6 Recommendation: do **not** ship a `checkCase` gate on `type`

Archgate 0.55 exposes `ctx.checkCase(value, scheme)`, but its scheme set cannot express the
OKF convention. From `.archgate/rules.d.ts`:

```ts
declare type CaseScheme = 'kebab-case' | 'camelCase' | 'PascalCase' | 'snake_case' | 'SCREAMING_SNAKE_CASE';
```

with the documented semantics "Matching is ASCII-only and all-or-nothing."

**None of the five schemes admits a space.** The spec's own canonical example values —
`BigQuery Table`, `API Endpoint`, `Attested Computation` — fail _every_ available scheme. So
a `checkCase` rule on `type` cannot encode "what OKF does"; it can only encode a house rule
that happens to contradict the spec's examples.

Concretely:

- A `checkCase(type, "kebab-case")` rule would be **house policy misrepresented as OKF
  conformance**, and would reject the spec's own worked examples.
- If the repo wants `adr` / `skill` / `log` uniformity — a reasonable want — the right
  mechanism is a **closed allowlist/enum of the handful of types this repo actually uses**,
  labelled explicitly as house policy, not a case scheme. An enum also catches typos
  (`adrs`, `ADR`), which a case scheme does not.
- Whichever is chosen, the ADR must not claim OKF requires it.

---

## 6. `index.md` and `log.md` in practice

### 6.1 `index.md` — generated, never validated

`index.md` is **produced** by first-party tooling, via `regenerate_indexes()` in
`bundle/index.py`, invoked from `runner.py` (`log.info("Regenerating index.md files in %s", …)`).

Observed behaviour, consistent with §8:

- Generated index files carry **no frontmatter**. Verified empirically: none of the 24
  committed `index.md` files in either repo begins with `---`.
- The generator never emits `okf_version`.
- Entries take `title`, `description`, `type` from each sibling's frontmatter. The agent
  prompt reinforces the contract: `description` "is used verbatim in auto-generated
  `index.md` files, so keep it tight and informative."
- No validation happens at any point; unparseable siblings are silently skipped.

§11 additionally guarantees consumers "MUST NOT reject a bundle because of… Missing
`index.md` files."

### 6.2 `log.md` — completely unhandled, and its rules are disputed

**No first-party code touches `log.md`.** A grep for `log\.md|LOG_FILE` across
`src/reference_agent/` returns only `index.md` hits. It is never generated, never validated,
and — importantly — **not skipped** by the index generator, which skips only `index.md`:

```python
if child.name == _INDEX_FILE:
    continue
```

So a regenerated index would list `log.md` as an ordinary entry under whatever `type` it
carries.

**The unresolved discrepancy.** §8's no-frontmatter rule is written only for `index.md`; §9
says nothing about frontmatter and its example shows none. Yet `bundles/acme_retail/log.md`
ships frontmatter in **both** repos:

```yaml
---
type: Log
title: Acme Retail bundle history
---
```

This is [knowledge-catalog#286](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/286)
(2026-08-11), "OKF log.md file can have a frontmatter ?" — **still open, no maintainer
response.** A third-party implementer's comment sharpens exactly why it matters:

> Why it is not cosmetic: §11 makes reserved files a conformance criterion, "follows the
> structure in §8 and §9". And a consumer that inventories concepts by scanning frontmatter
> for `type` (§4.1) picks up a log carrying `type: Log` as a concept of that type, which is
> the outcome §3.1 exists to prevent when it says reserved names must not be used for
> concept documents.

The same commenter notes `acme_retail` is the only one of the four reference bundles that
ships a `log.md` at all, "so the examples do not settle the convention either way."

> **Implication for the harness.** If the harness emits a `log.md`, whether to give it
> frontmatter is **genuinely undetermined by the spec**. Both readings are defensible today.
> The safe posture is to treat `log.md` frontmatter as optional-and-tolerated on read, and to
> avoid asserting a rule about it in an ADR until upstream settles it. Note also that the
> repo's `type: log` convention would collide with the reference bundle's `type: Log` if the
> harness ever consumes an official bundle.

---

## 7. `okf_version` — defined, never used

**Zero occurrences outside the specification itself.** A grep for `okf_version` across the
entire knowledge-catalog repo returns two hits, both in `SPEC.md` (lines 513 and 776). No
bundle declares it; no code emits it; no code reads it.

The complete definition, §12:

> Bundles MAY declare the version they target with `okf_version: "0.2"` in a bundle-root
> `index.md` frontmatter block (the only place frontmatter is permitted in an `index.md`).
> Consumers that do not understand the declared version SHOULD attempt best-effort
> consumption rather than refusing the bundle.

Note the parenthetical is doing double duty: it is the _only_ statement in the spec
permitting frontmatter in an `index.md` at all, and it is a `MAY`.

Two open proposals want to extend it, both unanswered:
[#212](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/212) (an opt-in
`okf_profile` alongside `okf_version`, plus a request to clarify root-index frontmatter keys)
and [#57](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/57)
(`okf_version` on standalone files).

> **Implication.** Emitting `okf_version` is harmless and spec-blessed, but buys nothing
> today — no consumer reads it. Its documentary value for the harness is real, though: it is
> the one spec-sanctioned place to record which version a bundle targets.

---

## 8. v0.3 signal

### 8.1 What is first-party

**There is no v0.3 branch, no milestone, and no roadmap document.** The knowledge-catalog
repo has _zero_ milestones and a generic label set (`bug`, `enhancement`, `question`, …) with
no version or spec labels. The canonical repo has **0 issues** and one discussion
("Welcome to open-knowledge-format Discussions!", 0 comments).

The only first-party forward-looking statement is §12's "Considered and deferred":

> The following are intentionally left to a future revision:
>
> - The full runtime protocol: receipt and verdict wire formats, and the attestation
>   lifecycle around a run.
> - The attester ABI, portability, and sandboxing, likely bundled with future work on serving
>   and Skills.
> - Attestation caching.
> - Semantic-layer templates (Looker, dbt) where the attester comparison shifts from SQL
>   equality to model-and-binding equality.

Every deferred item is in the **attestation/computation** area. **None** touches `type`,
`title`, `description`, `tags`, the reserved filenames, or the conformance floor.

### 8.2 Community proposals — none with maintainer engagement

Of the 186 open issues, the OKF-relevant ones that could affect harness wording:

| Issue                                                                                                                                                                                                                                   | Date       | Proposal                                                                        | Status                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- | -------------------------- |
| [#312](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/312)                                                                                                                                                             | 2026-08-18 | "v0.3 proposal: a Skill concept type with conventional shape + trust defaults"  | Open, no reply             |
| [#146](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/146)                                                                                                                                                             | 2026-06-25 | Rename reserved files: `index.md`→`README.md`, `log.md`→`CHANGELOG.md`          | Open, **0 comments**       |
| [#286](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/286)                                                                                                                                                             | 2026-08-11 | May `log.md` carry frontmatter?                                                 | Open, 1 community reply    |
| [#239](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/239)                                                                                                                                                             | 2026-07-28 | "§12 versus §13: v0.2 calls itself a minor bump while retiring two v0.1 fields" | Open, 0 comments           |
| [#212](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/212)                                                                                                                                                             | 2026-07-20 | `okf_profile` + root-index frontmatter clarification                            | Open, 7 community comments |
| [#148](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/148) / [#183](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/183) / [#195](https://github.com/GoogleCloudPlatform/knowledge-catalog/issues/195) | Jun–Jul    | Typed / confidence-tagged relationship links                                    | Open                       |

Two observations that matter more than any individual proposal:

1. **No maintainer has replied to any of them.** Every comment sampled across #212, #286,
   #43, #239 carries `authorAssociation: NONE`. The OKF issue tracker is currently a
   community monologue.
2. **The backlog is orphaned.** All 186 issues sit on the repo that now says "Stop using the
   copy under `okf/`". The canonical repo has zero issues and no migration has occurred. The
   v0.3 conversation currently has no home.

### 8.3 Assessment of rename risk — low for the harness

- **#312 (`type: Skill`) is the most likely v0.3 content**, since it aligns with §12's
  "future work on serving and Skills". It is _additive_ — a conventional shape for a type
  value, not a field rename. It would not invalidate existing ADR wording. Note it would
  standardise `type: Skill` (Title Case), which the repo's `type: skill` would diverge from.
- **#146 (reserved-file rename) cannot land in 0.3.** §12 defines the boundary itself: "A
  **major** version bump may make breaking changes (renaming required fields, changing
  reserved filenames)." Renaming `index.md`/`log.md` is explicitly a _major_ change, so it is
  a v1.0 concern at the earliest. It also has zero traction (0 comments in two months).
- **No proposal anywhere targets the `type` field, its casing, or the conformance floor.**

**Conclusion: no known-imminent breaking change should alter how the ADRs are worded today.**
The one genuine hazard is not a v0.3 rename at all — it is §0's finding that **v0.2 itself
mutates in place** (PR #323). That is the risk worth writing into the ADR.

---

## 9. What could not be established

- **Whether `log.md` may carry frontmatter.** Genuinely unresolved upstream (#286). The
  reference bundle and at least two independent implementers disagree.
- **Any maintainer position on v0.3 scope or timing.** No maintainer has commented on any OKF
  proposal issue; there is no roadmap, milestone, or public plan.
- **Whether the knowledge-catalog issue backlog will migrate** to the canonical repo. No
  migration activity observed as of 2026-08-22.
- **Whether `okf_version` will ever be read by anything.** No consumer implementation exists
  to check against.

---

## 10. Recommendations for the harness

1. **State the floor exactly, and cite §11's three clauses — not just clause 2.** The harness
   enforces "parseable frontmatter + non-empty `type`". That is provably the OKF floor for
   concept documents. Clause 3 (reserved-file structure) is a real, separate obligation.
2. **Pin a SPEC.md content hash, not the version string.** Record
   `sha256 26aa5da029278939f914e578107242d9607d4f2dc5fe153272b82f9ed1030101`. "v0.2" alone is
   not a stable referent (§0).
3. **Update the canonical source URL** to `GoogleCloudPlatform/open-knowledge-format`. Any ADR
   or doc pointing at `knowledge-catalog` now points at a self-declared frozen snapshot.
4. **Do not add a `checkCase` rule on `type`.** It cannot express the OKF convention and
   would contradict the spec's own examples (§5.6). If uniformity is wanted, use a house-policy
   allowlist and label it as such.
5. **Keep `type: adr` / `skill` / `log`.** Conformant, and protected by §11's "MUST NOT reject…
   Unknown `type` values". Optionally note in the ADR that official bundles use Title Case, so
   any _consumer_ the harness writes must be casing-agnostic.
6. **Anything beyond non-empty `type` that the harness enforces is house policy** and should
   be labelled so — including required `title`/`description`. §4.1's "Recommended" carries no
   RFC 2119 force, and §11 forbids _rejecting_ for their absence. A harness may still require
   them of _its own_ authors; it must not call that OKF conformance.
7. **Inherit the consumer restraint.** If the harness ever reads third-party bundles, §11
   obliges it to tolerate unknown types, unknown keys, broken links, and missing `index.md`.
   That is the larger half of the interface.
