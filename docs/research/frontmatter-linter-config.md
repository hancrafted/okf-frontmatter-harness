# How Existing Frontmatter-Schema Linters Shape Their Config

Research question ([#3](https://github.com/hancrafted/okf-frontmatter-harness/issues/3)):
before settling the `okf-config.yml` shape, gather precedent from tools that already solve
"declare a schema for markdown frontmatter, scoped by path".

For each tool: (1) how a schema binds to files; (2) the constraint vocabulary; (3) whether
required/optional is per-field or per-schema; (4) whether a schema can be _partially_
overridden for a subdirectory; (5) whether config is data or code, and what the maintainers
say about that tradeoff. Then the question that drives the design: **which of these could an
agent, reading the config cold with no ADR loaded, author correct frontmatter from?**

Constraint on relevance: this harness cannot use Zod, Joi or AJV. Rule files may import only
`node:path`, `node:url`, `node:util`, `node:crypto`, enforced by a static scanner. Config must
be data, parsed via `ctx.readYAML()`. Code-based precedent is assessed for what its _shape_
teaches, not for adoption.

> **Provenance.** This ticket was resolved twice concurrently on 2026-08-23. This file merges
> both syntheses; the two resolution comments on #3 are the originals. Per-tool evidence
> (~1,734 lines of quoted primary sources) is in [`parts/`](parts/).

| Evidence                                                           | Tools                                                                     |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| this file, §1                                                      | JSON Schema, `remark-lint-frontmatter-schema`, `vscode-yaml`, SchemaStore |
| [`parts/astro-vitepress.md`](parts/astro-vitepress.md)             | Astro content collections, VitePress                                      |
| [`parts/docusaurus-decap.md`](parts/docusaurus-decap.md)           | Docusaurus, Decap CMS                                                     |
| [`parts/markdownlint-obsidian.md`](parts/markdownlint-obsidian.md) | markdownlint / markdownlint-cli2, Obsidian Linter                         |
| [`parts/ssg-family.md`](parts/ssg-family.md)                       | Hugo, Jekyll, Eleventy                                                    |

---

## Headline: no surveyed tool does what `okf-config.yml` needs to do

Nothing combines declarative data config + path-scoped binding + a constraint vocabulary + a
deeper scope that can relax a shallower one. Two families exist and the harness is neither:

- **Path-attached _schemas_** — remark-lint, `vscode-yaml`, SchemaStore, Astro, Decap. Rich
  vocabulary, **single winner, no merge, relaxation impossible**.
- **Path-attached _settings_** — markdownlint-cli2's directory cascade, Jekyll `defaults`,
  Hugo `cascade`, Eleventy directory data, plus the `.gitattributes`/EditorConfig/ESLint family
  in [`pathrule-precedence.md`](pathrule-precedence.md). Ordered cascade, **merge per key,
  relaxation permitted** — but almost no constraint vocabulary, because a default-setter never
  needs one.

Jekyll has the right file shape and no constraints; Decap the right vocabulary and no cascade;
Eleventy the family's only negative assertion, and it is a JS callback.

**This is a licence to design, not a null result.** The failure modes are consistent, and they
are the expensive part to rediscover.

---

## 1. The JSON Schema family (salvaged from the rate-limited session)

### ⭐ JSON Schema cannot relax an inherited `required`

Not via `allOf`, not via `$ref`, not in any draft:

- Core §10.2: _"Subschema keywords evaluate the instance completely independently — results of
  one subschema MUST NOT impact the results of sibling subschemas."_ Normative `MUST NOT`.
- Core §10.2.1.1: `allOf` is pure conjunction.
- draft-03 `extends` was _also_ conjunctive: a subschema may _"define additional attributes,
  constrain existing attributes, add other constraints"_ — never relax. Removed in draft-04.
- The JSON Schema blog: _"'How do I model an inheritance hierarchy in JSON Schema?' And most
  commonly, the answer is, 'You don't.'… It's a subtractive system — more constraints means
  fewer matches."_

`unevaluatedProperties` rescues additive _property_ extension but does nothing for `required`.
There is no `unevaluatedRequired`, no `notRequired`, no `optional`. Recorded as preference 13.

### `remark-lint-frontmatter-schema` — last match silently wins

Binds `schema-path → [globs]`; on multiple matches **the last entry wins with no merge**
(`index.ts` L249-268 — the loop overwrites and never breaks). Undocumented, untested. It also
surfaces **raw AJV errors**: no `description`, `errorMessage` or `ajv-errors` anywhere in the
implementation, so a schema's `description` never reaches the diagnostic.

### `vscode-yaml` / SchemaStore

`vscode-yaml` publishes its order (modeline > in-file `$schema` > `yaml.schemas` >
SchemaStore), single-winner throughout — better than remark-lint only in being documented.

SchemaStore has **no frontmatter story**: of 1425 entries with 1333 `fileMatch` patterns,
**zero** end in `.md`/`.mdx`/`.markdown`. `schemastore.org/frontmatter.json` 404s. The
`$schema`-in-frontmatter convention also **conflicts with the spec**, where `$schema` names a
_dialect_ and _"MUST be a URI"_ — not a file path.

---

## 2. Cross-tool comparison

| Tool                  | Binding                                                    | Required granularity                         | Relax inherited?                                                      | Data or code                   |
| --------------------- | ---------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------ |
| JSON Schema           | `$ref`/`allOf` composition                                 | per-schema `required` array                  | **No** — structurally impossible                                      | data                           |
| remark-lint-fm-schema | schema → globs; last match wins                            | per-schema                                   | **No** — no merge at all                                              | data                           |
| vscode-yaml           | published order, single winner                             | per-schema                                   | **No**                                                                | data                           |
| Astro collections     | collection name → `glob()`; flat namespace, one level deep | per-field (`.optional()`)                    | **Yes** — `.partial({f: true})`, but Zod's API, undocumented by Astro | code                           |
| VitePress             | frontmatter defaults cascade (`stackView`)                 | n/a — no constraints                         | n/a                                                                   | code                           |
| Docusaurus            | hardcoded per content plugin                               | per-field (Joi)                              | **No** — not user-configurable at all                                 | code, not user-editable        |
| Decap CMS             | `folder:` / `files:` per collection                        | per-field, **`required` defaults to `true`** | **No** — restate the whole collection                                 | data                           |
| markdownlint-cli2     | per-directory config files + `extends`                     | n/a (rule toggles)                           | **Yes** — child `"MD013": false` kills a parent rule                  | data                           |
| Obsidian Linter       | no path scoping                                            | n/a                                          | n/a                                                                   | UI state                       |
| Hugo `cascade`        | `_target` page matchers                                    | not expressible                              | undocumented; **first writer wins**                                   | data                           |
| Jekyll `defaults`     | `scope: {path, type}`, path is a **prefix**                | not expressible                              | no delete mechanism                                                   | data                           |
| Eleventy dir data     | directory co-location; total order                         | only via `eleventyDataSchema`                | **Yes** — `override:` prefix                                          | JSON data; schemas are JS only |

---

## 3. Six findings

### 3.1 Relaxation is decided by the composition mechanism, not the vocabulary

Three families, and only the third is both declarative and relaxing:

| Mechanism                                       | Can relax?         | Examples                                                                                    |
| ----------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------- |
| **Document-merge of constraint sets**           | **No**             | JSON Schema `allOf`, remark-lint, `vscode-yaml`, Eleventy schemas                           |
| **Functional composition on a value**           | Yes                | Zod `.partial({f: true})` — performs exactly the required→optional flip JSON Schema forbids |
| **Key-wise merge with an explicit unset token** | Yes, declaratively | `.gitattributes` `-attr`, markdownlint-cli2 `"MD013": false`, Eleventy `override:`          |

The harness is in the third family. **This makes preference 5's _say nothing_ token a
structural requirement, not an ergonomic nicety** — and it means declarative YAML costs
nothing in relaxation. Merging documents is not conjunction.

### 3.2 Length-as-specificity has now failed twice in production

Traefik is already recorded in [`pathrule-precedence.md`](pathrule-precedence.md). **Jekyll is
worse, because its docs deny it**: they promise _"a more specific path"_ wins, while
`has_precedence?` compares `new_path.length`, the byte length of the scope string
(`frontmatter_defaults.rb:179-192`). `path: "documents"` (9) beats `path: "a/b/c"` (5).

Preference 5 is now corroborated by **failure evidence**, not merely absence of precedent.

### 3.3 Not one tool carries intent to the point of failure

| Tool         | Stores a reason?                                             | Reaches the author?                                                                            |
| ------------ | ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| remark-lint  | schema `description`                                         | No — raw AJV output                                                                            |
| markdownlint | `Rationale:` in every doc                                    | No — prose in docs, not a field on the rule                                                    |
| Astro        | `.describe()` exists                                         | No — used in no shipped example; error is `Too small: expected string to have >=40 characters` |
| Docusaurus   | 7 hand-written `.messages()`                                 | Partly — beside `// TODO how can we make this emit a custom error message :'(`                 |
| Decap        | `hint`, rendered below the control, **turns red on failure** | Yes — and still misses                                                                         |

Decap alone delivers it, and still misses: `hint` is validated only as `{type: 'string'}` and
the mandatory key list is `required: ['name']`, so **nothing checks a hint exists**.

**Four-for-four that `intent:` must be mandatory, not optional — optional is exactly what
Decap tried.** And it must be echoed verbatim in the violation message. This is the survey's
clearest free win (→ [#9](https://github.com/hancrafted/okf-frontmatter-harness/issues/9)).

### 3.4 Overlapping scopes are what actually break these tools

- **Astro**: one file in two collections yields **two independently validated entries, no
  diagnostic** — undocumented, zero issues in four years.
- **remark-lint**: last match silently wins.
- **markdownlint-cli2**: two config families with **opposite semantics chosen by filename**;
  a stray `.markdownlint.json` silently discards the merged cascade. Plus two path-scoping
  mechanisms with contradictory precedence (directory cascade = deepest-wins-merging;
  `overrides[].filter` = first-match-wins).
- **VitePress**: two divergent merge paths, one honouring `null` and one ignoring it.
- **Hugo**: first-writer-wins, including earlier-element-in-array — the inverse of
  `.gitattributes`.
- **Eleventy alone avoids the class**, because directory ancestry is a **total order with no
  overlap possible** — which is exactly why `override:` works there.

The harness permits arbitrary overlapping selectors, so it inherits this hazard by design.
**Decide once, in the ADR, what `null` means and what arrays do.**

### 3.5 Two tools already ship the "what governs this path?" resolver

- `git check-attr <path>` — resolves by path string **with no file needed**, and distinguishes
  `unset` from absent.
- VitePress `reportConfigLayers` — prints the ordered layers that applied to a page
  (~15 dependency-free lines).

Given §3.4, **a cascade that cannot explain itself is one users misread.** Given a path, print
the ordered rules that matched and the final merged constraint. Cheap, and the
highest-leverage self-teaching feature in the survey.

### 3.6 The strongest argument for code does not transfer

Astro RFC 0027 rejected a YAML schema format because Zod _"takes the maintenance burden off of
Astro's shoulders"_ — two of three reasons are Astro-internal, and the harness cannot use
libraries in `.rules.ts` anyway. The same RFC predicted users would _"stick to simple
`string()`, `number()`, `boolean()`"_ — roughly what YAML expresses natively — and Astro must
project Zod back down to JSON Schema for editors (`unrepresentable: 'any'`), losing
`.refine()`/`.transform()`.

**Docusaurus shows where the code path ends**: hardcoded Joi, `allowUnknown: true` forced, no
front matter hook in plugin options. An author can add any key but never constrain, require or
relax one, and the tracker has _no_ request for a configurable schema — only "please add my
field to your enum". **Decap is the counter-proof that data scales.**

---

## 4. Direct answer: which config is self-teaching?

**Only Decap CMS**, and for a structural reason: a collection is a **positive, closed
enumeration of every legal key**, with labels. Every other config is a _partial constraint
list_, where absence is ambiguous between "not allowed" and "not governed".

Caveats: the vocabulary is presentational rather than semantic (`widget: image`, `collapsed`,
`summary` do not bear on file validity); `hint` is optional; it describes a _form_, not a
_file_; and validation is **browser-only React component code** — there is no lint/validate
CLI in the 40-package monorepo, so a committed file never passes through it.

**The property to steal is positive enumeration + co-located intent, both free in YAML.**
Astro fails the test with full type information and zero intent, which shows type richness is
not the axis that matters.

| Tool                          | Verdict                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------ |
| **Decap CMS**                 | **Best in survey** — positive, closed, labelled enumeration                    |
| Eleventy `eleventyDataSchema` | Genuinely self-teaching, but executable JS — ruled out here                    |
| Astro                         | Shape yes, intent no — `min(40)` never says why 40                             |
| Jekyll                        | One file suffices, but "which default wins" is unguessable (§3.2)              |
| Hugo                          | Requires resolving matchers across every ancestor `_index.md` plus site config |
| markdownlint                  | Rationale exists in docs, unreachable from a failing run                       |
| Docusaurus                    | No config surface exists to read                                               |
| remark-lint / JSON Schema     | Constraint only; `description` never reaches the diagnostic                    |

---

## 5. Actionable for the build

- **Match on path segments, not prefixes.** Jekyll's `path_is_subpath?` is
  `path.start_with?(parent_path)` (`frontmatter_defaults.rb:136-138`), so a rule scoped to
  `docs/log` silently captures `docs/logging/`.
- **Specify merge depth explicitly.** markdownlint-cli2 merges exactly two levels and replaces
  a rule's parameter object atomically. The harness's `docs/` → `docs/logs/` per-key relax is
  **one level deeper than it merges** — `{...parent, ...child}` will not do.
- **Steal `combine: "merge" | "replace"` as a _required_ key** at the declaration site — it
  puts the merge decision at authorship rather than leaving an agent to infer it.
- **`"default": false` is established prior art for default-ignore** (→ preference 3).
  markdownlint has exactly the key and defaults it the wrong way: _"When no configuration
  object is passed or the optional `default` setting is not present, all rules are enabled."_
  Keep the key, flip the default.
- **Consider required-by-default** (→ [#7](https://github.com/hancrafted/okf-frontmatter-harness/issues/7)).
  Decap's `field.get('required', true)` makes the config state its _complete_ obligation set
  and makes **relaxation the common operation** — the exact cascade motion needed.
- **Say in the ADR that the harness reports and never rewrites.** Obsidian Linter, the
  closest-named tool, is a formatter with no violation type in its API that silently rewrites.
- **Settle YAML coercion before writing the type vocabulary.** Docusaurus needed a Joi
  extension so `tag: 2021` and `date: 2019-01-01` did not fail "must be a string". A
  hand-rolled checker over `ctx.readYAML()` hits the same wall.
- **Interop landmine: Hugo reserves `type`** (_"you cannot create a custom field named
  `type`"_) — and OKF's one mandatory field is `type`. Any Hugo-based repo adopting this
  harness collides on the single field OKF requires.

---

## 6. Not established

Stated rather than inferred:

- Whether a Hugo descendant can _clear_ an inherited cascaded value — undocumented, untested
  upstream.
- Eleventy's deeper-schema-replaces-shallower behaviour is **source-derived only**.
- markdownlint-cli2's `noInlineConfig` being re-openable in a nested config is **inferred, not
  confirmed**.

## 7. What this closes and what it opens

**Closes.** "Just use JSON Schema" (preference 13). "Copy an existing tool's config wholesale"
— nothing has both halves. "Data costs us relaxation" — it does not.

**Opens, for [#7](https://github.com/hancrafted/okf-frontmatter-harness/issues/7) and
[#9](https://github.com/hancrafted/okf-frontmatter-harness/issues/9).** Whether `required`
defaults true (Decap) or false. What `null` and arrays do on merge. Whether the matcher is
segment-aware glob or prefix. Whether `combine:` is explicit per rule. Whether the §3.5
explainer ships in v1.
