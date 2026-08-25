# Canonical Key Order: What Real Tools Enforce, and Why

Research question ([#14](https://github.com/hancrafted/okf-frontmatter-harness/issues/14) item 2):
`GEN-001` enforces `type → id → title → domain → rules → paths` as a **prefix**; any additional
key may follow, unordered. `files` currently rides in that free tail. Once #14 makes `files`
mandatory, does it join the enforced prefix — and if so, where?

The complication that makes it worth researching: the keys have **different consumers**.
`files` is archgate's own schema key (`{id, title, domain, rules, files?, respectGitignore?}`);
`paths` is Claude Code's read-trigger; `type` is read by neither and exists for the `GEN-003`
cross-file convention. "Order by consumer" is therefore a candidate organizing principle, and
the shipped order does not follow it.

Probed 2026-08-25. Every claim is quoted from official docs, spec text, shipped source, a
changelog, or a maintainer's own words in an issue thread. Behavioural claims marked
**[executed]** were reproduced against a real binary; the version is given. Every finding is
tagged **documented** or **source-only**, because this harness prefers documented signals.

---

## Direct answers

**Q1 — Do real systems enforce a canonical key order at all?** Yes, but far fewer than the
folklore suggests, and the most-cited example is not real. Genuine custom-order enforcers:
`sort-package-json` (~3.3M downloads/week), `ansible-lint`'s `key-order` (on by default),
`cargo-sort` (on by default), `composer normalize`, `toml-sort --sort-first`, kustomize's two
independent order lists, Obsidian Linter's `yaml-key-sort`, `eslint-plugin-perfectionist`,
`eslint-plugin-yml`/`-jsonc`, and the JAR manifest **spec**. Alphabetical-only: `yamllint
key-ordering`, ESLint `sort-keys` (formally frozen), `taplo`, `kube-linter sorted-keys` (off by
default). **Hard nulls: npm's own `package.json` docs, Kubernetes, GitHub Actions, Helm, the
Cargo book, PEP 621, the TOML spec, every static-site generator checked (Astro, Jekyll, Hugo,
Eleventy, Docusaurus, VitePress), Prettier, JSON Schema, `remark-lint` (including
`remark-lint-frontmatter-schema`), and `markdownlint`.** The famous
`apiVersion → kind → metadata → spec` is **not a rule at all** — §3.1 refutes it three ways.
Terraform is the instructive middle case: a canonical order **documented normatively by the
vendor** that the vendor's own formatter deliberately does not enforce and the official linter
removed on principle (§3.4).

**Q2 — Does anything ship "ordered prefix + free tail"?** Yes — nine independent
implementations across six ecosystems, and one of them is a **specification** rather than a tool: the JAR manifest
mandates `Manifest-Version` first and then states that the order of everything else "is not
significant". A genuinely _free_ (unsorted) tail ships in `cargo-sort` (documented, appearance
order), `ansible-lint` (documented, an explicit free _middle_), `eslint-plugin-perfectionist`
(documented, `unknown` group marked `unsorted`), and Obsidian Linter (documented by worked
example, on frontmatter specifically). A _sorted_ tail ships in `sort-package-json`,
`toml-sort --sort-first`, and `composer normalize`. **`sort-package-json` — my prime suspect —
is the sorted kind, not the free kind**, and I was initially wrong to call that undocumented:
see §2.6 for the correction. **Optional-key position is precedented and routine** — it falls out
of this design rather than being a separate feature (§2.4), and HashiCorp states it in prose
("**If present**, the `count` or `for_each` meta-argument… **If required**, a `lifecycle`
block"). **Prefix _contiguity_ is not precedented anywhere** — that would be an invention.

**Q3 — Is there a documented rationale for the order when consumers differ?** **No system
anywhere orders keys by which consumer reads them.** In the highest-traffic tool it was
_proposed and declined_ as "a fuzzy classification system", and the concrete harm named in that
thread is precisely the `files`/`paths` split-pair failure. Three real documented rationales
exist, none of them consumer-based: `ansible-lint`'s **named bug class** (§3.2), HashiCorp's
**meta-arguments-first** category order (§3.4), and `composer normalize`'s **derive the order
from the schema's own property order** (§3.5) — the only mechanically-principled one in the
survey. The documented answer to "many consumers, one file" is **namespacing** (PEP 518's
`[tool.*]`), not ordering.

**Q4 — What does changing an enforced order cost?** In `sort-package-json`: an order change has
**never once** been released as a breaking change in ten years. Key additions ship as `feat:`
minors, order corrections as `fix:` patches, with no migration notes. Three ordering rules have
been reverted across the survey — two in `sort-package-json` because a consumer turned out to be
order-_sensitive_, and one in `tflint` because the maintainers judged the order to be "personal
opinions". Black is the only tool that treats canonical-form churn as a first-class cost, via a
calendar-year stability guarantee. **Adding a key to an enforced order is cheap and reversible;
it is not a one-way door.** At `n = 1` ADR it is nearly free. The expensive mistake is not
_changing_ an order — it is enforcing a position you cannot justify, which is what got reverted
in every case above.

---

## 0. The floor: mapping key order is not data

Every finding below sits on top of one fact, and it is normative.

**YAML 1.2.2 §3.2.1** — <https://yaml.org/spec/1.2.2/>:

> The content of a _mapping_ node is an unordered set of _key/value_ node _pairs_, with the
> restriction that each of the keys is unique.

**YAML 1.2.2 §3.2.2.1, "Mapping Key Order"** — the operative text:

> In the representation model, mapping keys do not have an order. To serialize a mapping, it is
> necessary to impose an ordering on its keys. This order is a **serialization detail** and
> **should not be used** when composing the representation graph (and hence for the preservation
> of application data). **In every case where node order is significant, a sequence must be
> used.**

**RFC 8259 §1 (JSON)** — <https://www.rfc-editor.org/rfc/rfc8259.txt>:

> An object is an unordered collection of zero or more name/value pairs [...]

and §4, the interoperability note:

> JSON parsing libraries have been observed to differ as to whether or not they make the
> ordering of object members visible to calling software. Implementations whose behavior does
> not depend on member ordering will be interoperable [...]

**JSON Schema 2020-12 Core §4.2.2** — <https://json-schema.org/draft/2020-12/json-schema-core>:

> Implied in this definition is that arrays must be the same length, objects must have the same
> number of members, **properties in objects are unordered** [...]

Three consequences follow, and all three are load-bearing for this ticket.

**(a) No consumer can legitimately depend on order, so "order by consumer" has no technical
foothold.** It could only ever be an argument about human legibility.

**(b) Any order-checking tool must bypass its own parser.** This is observable across every
implementation: `ansible-lint` uses `ruamel.yaml`'s `CommentedMap`; `kube-linter` parses raw
YAML with `goccy/go-yaml` under the comment `// Parse the raw YAML to preserve key order`;
kustomize uses `kyaml` rather than a decoded struct; `sort-package-json` operates on the JSON
text. **This harness already does the same thing, out of necessity**: `ctx.readYAML()` returns
`frontmatter: Record<string, YamlValue> | null` (`.archgate/rules.d.ts`, `ReadYamlResult`), which has no order,
so `GEN-001-adr.rules.ts` regexes the raw block instead:

```ts
const actual = fm
  .split(/\r?\n/)
  .map((l) => l.match(/^([a-z]+)[ \t]*:/)?.[1])
  .filter((k): k is string => k !== undefined && FIELD_ORDER.includes(k));
```

**(c) A schema language can only express order if its data model is ordered.** JSON Schema
cannot, structurally — the order is gone before any keyword sees the instance. XML Schema can,
because XML element content _is_ a sequence. W3C XML Schema Primer,
<https://www.w3.org/TR/xmlschema-0/>: `xsd:sequence` means "the elements must appear in the same
sequence (order) in which they are declared", `xsd:all` means "All the elements in the group may
appear once or not at all, and they may appear in **any order**". Order-expressibility follows
the data model, not the schema language's ambition.

`yamllint`'s maintainer draws exactly this line to justify why key ordering is _in scope_ for a
linter at all — <https://github.com/adrienverge/yamllint/issues/454>, adrienverge (owner):

> I'm not very favorable to such a change, because yamllint aims to lint the _form_, not the
> _content_: — Ensuring a given order for **keys** of a mapping is about _form_, because YAML
> mapping keys do not have an order, per the YAML specification. Expecting an alphabetical
> sorting of keys is just about style → what a linter does.

Note what this licenses and what it does not. Key order is admitted **because** it is pure
style. Enforcing it as a _conformance_ property, rather than a style property, is a stronger
claim than any source below supports.

---

## 1. Who actually enforces a canonical key order

| System                                               | Enforces?                     | Order                                           | Mode                               | Documented?                           |
| ---------------------------------------------------- | ----------------------------- | ----------------------------------------------- | ---------------------------------- | ------------------------------------- |
| JAR manifest spec                                    | **Yes** — first key only      | `Manifest-Version` first, rest free             | spec requirement                   | **documented**, with rationale        |
| `sort-package-json`                                  | **Yes**                       | 111-key custom list + sorted tail               | fixer (+ `--check`)                | **documented** (§2.6) except `_` rule |
| `ansible-lint key-order`                             | **Yes**                       | `name` / free / `block,rescue,always`           | rejector (+ `--fix`)               | **documented**, incl. `## Reasoning`  |
| `cargo-sort`                                         | **Yes** — tables              | 8-table list + appearance-order tail            | fixer (+ `--check`)                | **documented** (README + config)      |
| `composer normalize`                                 | **Yes**                       | **derived from the JSON Schema** + `ksort` tail | fixer                              | **documented**                        |
| `toml-sort --sort-first`                             | **Yes**                       | user list (no default) + alpha tail             | fixer                              | list documented; tail **source-only** |
| Terraform style guide                                | **Yes**, normatively          | meta-args / free / `lifecycle`,`depends_on`     | **doc only — nothing enforces it** | **documented**, with "if present"     |
| kustomize `kyaml` `fieldSortOrder`                   | **Yes**                       | flat key list, lexicographic tail               | library formatter                  | **source-only**                       |
| kustomize `kustomization.yaml`                       | **Yes**                       | total order, closed set                         | placement policy for new keys      | **source-only**                       |
| Obsidian Linter `yaml-key-sort`                      | **Yes**                       | user priority list + free tail                  | fixer                              | **documented** by worked example      |
| `eslint-plugin-perfectionist`                        | **Yes**                       | `groups` + `unknown` bucket                     | rejector                           | **documented**                        |
| `eslint-plugin-yml` / `-jsonc` `sort-keys`           | **Yes**                       | custom `order` array                            | rejector                           | list documented; tail **source-only** |
| `yamllint key-ordering`                              | alphabetical only             | Unicode codepoint, or `locale`                  | rejector                           | **documented**                        |
| ESLint `sort-keys`                                   | alphabetical only             | `asc`/`desc`, `natural`                         | rejector                           | **documented**, `frozen: true`        |
| `kube-linter sorted-keys`                            | alphabetical only             | off by default                                  | rejector                           | **documented**                        |
| `taplo`                                              | alphabetical only             | `reorder_keys`, default off                     | fixer                              | **documented**                        |
| npm `package.json` docs                              | **no**                        | —                                               | —                                  | null                                  |
| Kubernetes                                           | **no** (§3.1)                 | —                                               | —                                  | null                                  |
| GitHub Actions                                       | **no**                        | —                                               | —                                  | null                                  |
| Helm `Chart.yaml` / `helm lint` / `ct`               | **no**                        | —                                               | —                                  | null                                  |
| `terraform fmt` / `tflint`                           | **no** — declined (§3.4)      | —                                               | —                                  | **documented** decline                |
| Cargo book / PEP 621 / TOML spec                     | **no**                        | —                                               | —                                  | null                                  |
| Astro, Jekyll, Hugo, Eleventy, Docusaurus, VitePress | **no**                        | —                                               | —                                  | structural null                       |
| Prettier                                             | **no**, by policy             | —                                               | —                                  | **documented** decline                |
| JSON Schema                                          | **cannot**                    | —                                               | —                                  | structural null                       |
| `remark-lint` (all rules)                            | **no**                        | —                                               | —                                  | null                                  |
| `markdownlint`                                       | **no** frontmatter order rule | —                                               | —                                  | null                                  |
| Debian control files                                 | **no** field-order rule       | —                                               | —                                  | null                                  |

### 1.1 `sort-package-json` — the biggest one, and it is a formatter

~3,297,520 downloads in the last week (npm registry API, 2026-08-25). It exports a 111-entry
`sortOrder`, fully listed in the README under "What is the order this package defaults to?"
The list's provenance is **documented**:

> It sorts using the well-known keys of a package.json. [...] **The initial order was derived
> from the [package.json docs](https://docs.npmjs.com/files/package.json) with a few extras
> added for good measure.**
> — README, "PFAQ: How does it sort?"

Adversarial check on that provenance: npm's own reference
(<https://docs.npmjs.com/cli/v11/configuring-npm/package-json>) **states no order at all** — no
sentence in it mentions order, ordering, or field sequence. Its _heading_ order also disagrees
with `sort-package-json`: npm presents `files` tenth (right after `funding`, before `exports`
and `main`), whereas `sort-package-json` puts it at index 43. So "derived from the docs" is
loose, and even the two most authoritative sources on `package.json` disagree about where a key
named `files` belongs. Neither is normative.

### 1.2 Alphabetical-only tools, and why they will stay that way

`yamllint`'s `key-ordering` docstring (which _is_ the doc page) —
<https://github.com/adrienverge/yamllint/blob/master/yamllint/rules/key_ordering.py>:

> Use this rule to enforce **alphabetical** ordering of keys in mappings. The sorting order uses
> the Unicode code point number as a default. [...] This can be changed by setting the global
> `locale` option.

Its entire option surface is `CONF = {'ignored-keys': [str]}` plus the global `locale`. **There
is no way to supply a key list.** Adversarial check: no request for a custom canonical order has
ever been filed — searched the tracker for `key-ordering`, "custom order", "specific order",
"sort order", "key order", plus PRs and Discussions. **Null result: do not claim a maintainer
refused custom orders; nobody asked.** `ignored-keys` is the _inverse_ of what this ticket needs
— it exempts a key from ordering wherever it sits.

ESLint `sort-keys` is `asc`/`desc` with `natural`/`caseSensitive` modifiers, and is formally
closed to change. `lib/rules/sort-keys.js` carries `frozen: true`, which the rules index legend
defines (<https://eslint.org/docs/latest/rules/>):

> ❄️ Frozen — This rule is currently frozen and is not accepting feature requests.

aladdin-add (member) closing a `sort-keys` request,
<https://github.com/eslint/eslint/issues/17347>:

> As stated in the README, we actually aren't making any further updates to rules that enforce
> stylistic preferences. If you have a strong preference for such a change, you can always copy
> the existing rule into a custom rule and make it behave the way you want.

### 1.3 The structural nulls

**JSON Schema cannot express key order, and its maintainers say so.** `propertyOrder` appears in
neither the 2020-12 Core nor the Validation spec (searched mechanically). It is a vendor
extension owned by JSON Editor, whose README admits the gap
(<https://github.com/json-editor/json-editor>):

> **There is no way to specify property ordering in JSON Schema** (although this may change in
> v5 of the spec). JSON Editor introduces a new keyword `propertyOrder` for this purpose. The
> default property order if unspecified is 1000. Properties with the same order will use normal
> JSON key ordering.

The proposal was redirected out of the spec twice. handrews (contributor),
<https://github.com/json-schema-org/json-schema-spec/issues/571>:

> property ordering is less about annotating with data (like a description) or an interaction
> hint [...] and more about **how to display things**, so it really does belong in the other
> repository with the UI vocab proposal.

It moved to <https://github.com/json-schema-org/json-schema-vocabularies/issues/7>, where a
concrete `"propertiesOrder": ["title", "$comment", ".*", "foo", "bar"]` — note: _exactly_ the
ordered-prefix-with-free-slot shape — drew this from gregsdennis (member):

> are you looking for the schema to _validate_ that the properties are in the right order?
> **That's not something that can be guaranteed, especially interoperably.** The parsers in some
> languages aren't even deterministic in property order from reading the same file multiple times.

**Therefore `remark-lint-frontmatter-schema` cannot enforce order, and this is structural, not
unimplemented.** Its README is silent on ordering (zero matches for `order`, `sort`, `sequenc`
across 655 lines) and its capability claim is "all you can get with JSON Schema"
(<https://github.com/JulianCataldo/remark-lint-frontmatter-schema>). Its `package.json` pins
`ajv` fed by `yaml` — frontmatter is a plain object before validation begins. The wider
`remark-lint` rule set has ordering rules only for definitions, directive attributes, and MDX
JSX attributes; **none for frontmatter**.

**Prettier declines all reordering, by policy.** Option philosophy,
<https://prettier.io/docs/option-philosophy>:

> Prettier has a few options because of history. **But we won't add more of them.** [...] Option
> requests aren't accepted anymore.

lydell closing the object-key-sorting request (which cross-references ten prior duplicates),
<https://github.com/prettier/prettier/issues/3926>:

> Prettier attempts to be a 100% "safe" tool – you should always be able to run it without
> worrying that it might break your code. [...] I'm going to close this since I doubt it is
> going to be part of Prettier.

**`markdownlint` has no frontmatter key-order rule.** Its four frontmatter-aware rules (MD001,
MD022, MD025, MD041) all concern the `title` property's interaction with heading hierarchy.
Worth noting for shape, though: **MD043 `required-headings` is the closest analogue in a
markdown linter** — a required sequence with explicit wildcard slots, where `"*"` means "zero or
more unspecified headings", `"+"` means "one or more", `"?"` means "exactly one"
(<https://github.com/DavidAnson/markdownlint/blob/main/doc/Rules.md>). It is a _rejector_, and
it does express "required items in order, arbitrary content between" — but it has no token for
an _optional named_ item, so "if present, must sit here" is not expressible there either.

**Debian control files: null.** <https://www.debian.org/doc/debian-policy/ch-controlfields.html>
states "The ordering of the stanzas in control files is significant" — **stanzas**, not fields.
No field-order requirement within a stanza, and no rationale, because there is no rule.

**Every static-site generator: null, and structurally so.** Astro (Zod), Jekyll, Hugo, Eleventy,
Docusaurus (Joi) and VitePress were each checked; none states anything about frontmatter key
order in either direction. The reason is the parse layer, and it shows up in the implementations:
Astro runs one `safeParseAsync(data, …)` on an already-parsed object and, to report an error
_location_, has to go hunt the key in the raw text (`getYAMLErrorLine(entry._internal?.rawData,
…)`); Docusaurus, on a validation failure, prints `Yaml.dump(frontMatter)` — re-serialising the
parsed object, because your key order is already gone. Zod's own API reference does not contain
the string "order" at all; `$ZodObject` iterates the **schema's** keys and does named lookups
into the input. The only positional rules any of them state are about the _block_ ("must be the
first thing in the file" — Jekyll; "must be at the top of the Markdown file" — VitePress).

**`Cargo.toml`, `pyproject.toml`, and the TOML spec: null.** The Cargo book presents manifest
sections as an unordered list and states no requirement (its "The first section in a
`Cargo.toml` is `[package]`" is descriptive of the examples). PEP 621 specifies required-vs-
optional _content_ only — "The only keys required to be statically defined are: `name`" — and
never addresses position. TOML v1.0.0 settles it at the format level
(<https://toml.io/en/v1.0.0>): "Key/value pairs within tables are **not guaranteed to be in any
specific order**." Its only ordering language is non-normative and about grouping tables
("Defining tables out-of-order is discouraged"). This is why `cargo-sort` had to invent its own
list (§2.3) — there was nothing to adopt.

One caveat for any harness that enforces order: **a CMS round-trip will silently rewrite it.**
Decap CMS's `formats/yaml.ts` sorts frontmatter on `toFile()` by keys derived from the
collection's configured `fields` array, while `fromFile()` is a plain `doc.toJSON()` — order
imposed on write, discarded on read, never validated.

---

## 2. The "ordered prefix + free tail" pattern, and optional-key position

Before the evidence, a distinction the sources force, which is worth naming in the domain model
because the three are **not interchangeable**:

- **normal form** — a total order; every input maps to one unique output. (kustomize
  `FormatFilter`, `kube-linter sorted-keys`, `sort-package-json`.)
- **acceptance predicate** — a partial order; many orders are clean, no unique output is
  defined. (`ansible-lint key-order`, `eslint-plugin-yml`, **and `GEN-001` today**.)
- **placement policy** — existing order preserved verbatim; the canonical order is consulted
  only when inserting a new key. (kustomize's `kustomization.yaml` writer.)

`GEN-001` is an acceptance predicate, and `FIELD_ORDER` is not a normal form. Confirmed from
source: the `present`/`actual` comparison builds `present` by filtering `FIELD_ORDER` and `actual`
by filtering the raw lines to keys **in `FIELD_ORDER`**, then compares. Any key outside the list
is invisible to the check, so `type, id, description, title, domain, rules` passes today. The
rule enforces **relative order among the six known keys**, not contiguity.

### 2.1 The JAR manifest: the exact shape, at spec level, with a documented rationale

This is the strongest single precedent found. JAR File Specification, "Notes on Manifest and
Signature Files" — verified against both the Java 8 and the current JDK 21 text
(<https://docs.oracle.com/en/java/javase/21/docs/specs/jar/jar.html>):

> **Manifest-Version and Signature-Version must be first, and in exactly that case (so that
> they can be recognized easily as magic strings). Other than that, the order of attributes
> within a main section is not significant.**

Read that carefully. It is a one-key ordered prefix, an explicitly free tail, and a stated
reason — and the reason is **recognisability as a magic string**, i.e. a human or a cheap scanner
can identify the document from its first line. That is the closest documented analogue to
`GEN-001`'s existing justification for `type` leading ("`type` leads because it is the universal
field `GEN-003` owns", `GEN-001-adr.md:34`). Note what the JAR rationale is _not_: it is not a
parsing requirement. The spec says the rest of the parse does not care.

The individual-section rule is separate and stricter — "Each section must start with an
attribute with the name as `Name`" — with **no stated reason**.

### 2.2 `ansible-lint key-order`: a free _middle_, enforced by default

Rule doc <https://ansible.readthedocs.io/projects/lint/rules/key-order/>, source
<https://github.com/ansible/ansible-lint/blob/main/src/ansiblelint/rules/key_order.py>. The
entire canonical order is:

```python
SORTER_TASKS = (
    "name",
    # "__module__",
    # "action",
    # "args",
    None,  # <-- None include all modules that not using action and *
    # "when",
    # "notify",
    # "tags",
    "block",
    "rescue",
    "always",
)
```

`None` is a **wildcard bucket**. The commented-out entries are keys that were considered and
deliberately left out (§3.2). The doc states the same in prose:

> - `name` must always be the first key for plays, tasks and handlers
> - on tasks, the `block`, `rescue` and `always` keys must be the last keys, as this would avoid
>   accidental miss-indentation errors between the last task and the parent level.

**The free middle is documented in effect but emergent in mechanism.** Unlisted keys all receive
the `None` index, so they compare equal, and the rule sorts with
`sorted(keys, key=functools.cmp_to_key(task_property_sorter))`. Python guarantees `sorted` is
stable (<https://docs.python.org/3/library/functions.html#sorted>), so equal-comparing keys keep
their input order and **any order of middle keys is accepted**. Two files with `when` before
`become` and `become` before `when` are both clean.

**It is on by default.** `key-order` sits in the `basic` profile, and profile filtering only
engages when `--profile` is passed (`if profile_name and not (...)` in `rules/__init__.py`); its
tags are `["formatting"]`, not `opt-in`.

### 2.3 `cargo-sort` and `composer normalize`: two more documented cases, one with a free tail

**`cargo-sort` is the second genuinely free tail, and it is documented twice.** It ships a
canonical _table_ order, on by default —
<https://github.com/DevinR528/cargo-sort/blob/main/src/fmt.rs>:

```rust
pub(crate) const DEF_TABLE_ORDER: &[&str] = &[
    "package", "workspace", "lib", "bin", "features",
    "dependencies", "build-dependencies", "dev-dependencies",
];
```

README, in the `--order` flag description **and** again in the documented default config block:

> **-o or --order** — Specify an ordering of tables. All nested tables will be sorted and appear
> after the specified table. **Any unspecified table will be after specified.**

> `# The user specified ordering of tables in a document.`
> `# All unspecified tables will come after these.`

The mechanism confirms a genuinely unsorted tail — `src/sort.rs` pushes each unlisted table onto
the tail of the ordering vector **as it is encountered**, so unknown tables come out in their
original relative order, not alphabetically:

```rust
if !matcher.heading.contains(&item_key) && target_tables.is_empty() {
    if !ordering.contains(&head.to_owned()) && !ordering.is_empty() {
        ordering.push(head.to_owned());
    }
    continue;
}
```

Two precision notes. (i) `cargo-sort` has **no canonical _key_ order at all** — only a canonical
_table_ order; key sorting is alphabetical and applies to just `[dependencies]`,
`[dev-dependencies]`, `[build-dependencies]` and their `workspace` equivalents. `[package]`'s
inner keys are never reordered. (ii) **The README contradicts the source** on one point: its
worked example comments "Tables are ordered by their appearance so … unless `--order` is
specified", which is false on the default path, because `Config::default()` supplies a non-empty
`table_order` and so `sort_by_ordering` is always taken. The example's output happens to match
the default, masking it. (Not reproduced against a binary — no `cargo` available — but the
branch is unambiguous.)

**`composer normalize` derives its canonical order from the schema, which is the only
mechanically-principled derivation in the survey.** `ergebnis/json-normalizer`
(<https://github.com/ergebnis/json-normalizer>) states it in one sentence:

> properties will be **reordered as found in the schema** and **additional properties will be
> ordered by name**.

`src/SchemaNormalizer.php`:

```php
$objectPropertiesThatAreDefinedBySchema = \array_intersect_key(
    \get_object_vars($schema->properties),
    \get_object_vars($data),
);
// ... then whatever is left:
if ($dataShouldBeSorted) { \ksort($additionalProperties); }
```

`array_intersect_key` preserves the **first** array's order, so known keys emerge in
schema-declaration order and only when present. For `composer.json` the canonical order simply
_is_ the property order of `composer-schema.json` — no hand-maintained list to drift. Note the
tail is `ksort`ed, so this is the sorted-tail family, not the free-tail one.

### 2.4 Optional-key position — precedented, and it falls out of the design

`ansible-lint` checks only the keys present:

```python
keys = [str(key) for key in raw_task if not key.startswith("_")]
sorted_keys = sorted(keys, key=functools.cmp_to_key(task_property_sorter))
if keys != sorted_keys:
```

So an absent `block` cannot be flagged, but a present `block` must follow every middle key. That
is exactly "if present, it must sit here", shipped and documented.

**`ansible-lint` deliberately splits presence from position into two different rules.** "`name`
must be present" is `name[missing]` / `name[play]`
(<https://github.com/ansible/ansible-lint/blob/main/src/ansiblelint/rules/name.md>); "`name`
must be first" is `key-order`. No single rule expresses "required key at required position" —
it is composed. That separation is directly applicable to #14, which is fundamentally a
_presence_ rule.

`eslint-plugin-perfectionist`'s `sort-objects` expresses the whole target shape, and every
mechanism is documented (<https://perfectionist.dev/rules/sort-objects>):

> ##### The `unknown` group — Members that don't fit into any group specified in the `groups`
>
> option will be placed in the `unknown` group. If the `unknown` group is not specified in the
> `groups` option, it will automatically be added to the end of the list.

> #### Group with overridden settings — You may directly override options for a specific group
>
> [...] `groups: [ 'method', { group: 'multiline-member', type: 'unsorted' } ] // Elements from
this group will not be sorted`

**[executed]** with eslint 10.9.1 / eslint-plugin-perfectionist 5.10.1, one `customGroup` per
key and `groups: ["g-title","g-date","g-tags",{group:"unknown",type:"unsorted"}]`:

| input                                        | result                                                       |
| -------------------------------------------- | ------------------------------------------------------------ |
| `title,date,tags,zeta,alpha` (tail unsorted) | no errors                                                    |
| `date,title,tags` (named keys out of order)  | `Expected "title" (g-title) to come before "date" (g-date).` |
| `title,zeta,date,tags` (unknown interleaved) | `Expected "date" (g-date) to come before "zeta" (unknown).`  |
| `title,tags,zeta` (optional `date` absent)   | no errors                                                    |

Caveat that limits its transferability: perfectionist has **no YAML surface** — all 24 rules are
ESTree/TS-AST. It proves the shape is nameable and buildable; it cannot lint frontmatter.

`eslint-plugin-yml`'s `yml/sort-keys` _does_ work on real YAML with a custom `order` array, and
also enforces optional-key position — but **it cannot express the free tail**. Its order types
are only `asc | desc | ignore` (<https://ota-meshi.github.io/eslint-plugin-yml/rules/sort-keys.html>);
there is no `unsorted`. Unlisted-key behaviour is **source-only** — in `src/rules/sort-keys.ts`,
`ignore: (data) => { const order = parsedOrder.find(...); return !order || order.ignore; }`
treats an unmatched key exactly like an explicitly ignored one, dropping it from comparisons.
**[executed]** with eslint-plugin-yml 3.8.1: with `order: ["title","date","tags"]`, an unknown
key first, interleaved, or trailing all pass; adding a trailing catch-all
`{keyPattern: ".*", order: {type: "asc"}}` pins unknowns to the tail **but simultaneously forces
them alphabetical**, and switching that catch-all to `ignore` releases both constraints
together. The two halves are coupled.

**Two more instances, where the property is a side effect of a presence guard rather than a
feature.** `sort-package-json` emits a listed key only under
`if (has(object, key))` (`sort-object-keys/index.js`), and `composer normalize` only under
`array_intersect_key` — so in both, _every_ canonical key is optional-but-position-pinned. And
HashiCorp states it in prose, which makes it the clearest documented articulation of the
constraint found anywhere (<https://developer.hashicorp.com/terraform/language/style>):

> 1. **If present**, The `count` or `for_each` meta-argument. 2. Resource-specific non-block
>    parameters. 3. Resource-specific block parameters. 4. **If required**, a `lifecycle` block.
> 2. **If required**, the `depends_on` parameter.

Note that this is also the ordered-prefix shape with a free middle _and_ a pinned suffix — the
same three-zone design as `ansible-lint`, arrived at independently. §3.4 covers why nothing
enforces it.

### 2.5 Obsidian Linter: the shape, on frontmatter, documented by example

Rule `yaml-key-sort` (<https://platers.github.io/obsidian-linter/settings/yaml-rules/>):

> Sorts the YAML keys based on the order and priority specified. **Note: may remove blank lines
> as well. Only works on non-nested keys.**

> - YAML Key Priority Sort Order: The order in which to sort keys with one on each line where it
>   sorts in the order found in the list
> - Priority Keys at Start of YAML: [...] placed at the start of the YAML frontmatter — Default: `true`
> - YAML Sort Order for Other Keys: [...] — Default: `None`
>   - `None`: No sorting other than what is in the YAML Key Priority Sort Order text area

The shipped docs contain the worked example that settles the tail: priority order
`date type language`, other keys `None`, input `language, type, tags, keywords, status, date`
→ output `date, type, language, tags, keywords, status`. **The tail keeps its original relative
order.** Confirmed in `src/rules/yaml-key-sort.ts`, which early-returns with the leftover
document rendered as-is for `'None'`. Three caveats: it is a **fixer**, not a checker (there is
no "is this already canonical?" mode); top level only; and because it never reports, the
optional-key-position question does not arise.

### 2.6 `sort-package-json` is _not_ this shape — a corrected claim

This was my prime suspect and it does not hold up. `index.js`:

```js
sortOrder = [...sortOrder, ...defaultSortOrder, ...publicKeys.sort(), ...privateKeys.sort()];
```

**[executed]** against `sort-package-json@4.0.0`:

```
input   { zzzCustom, _privateA, aaaCustom, version, _privateZ, mmmCustom, name, description }
default ["name","version","description","aaaCustom","mmmCustom","zzzCustom","_privateA","_privateZ"]
case    { apple, Zebra, banana, name } -> ["name","Zebra","apple","banana"]
```

So the tail is **codepoint-sorted, not free**, and `_`-prefixed keys are segregated last. The
generic primitive is `sort-object-keys`, whose one line is the whole pattern —
`const objectKeys = [...(keys ?? []), ...Object.keys(object).sort(sortFn)]` — i.e. listed keys
in list order, then **everything else sorted**.

**Documentation status — I got this wrong on the first pass, and the correction matters.** The
shipped README documents exactly one adjacent fact —

> **Notice**: fields not in this array, will still sort by `defaultSortOrder`

— which covers only the `...defaultSortOrder` fallback for a _custom_ `sortOrder`. On that
evidence I concluded the tail was undocumented. **It is not.** The behaviour is stated in
`defaultRules.md`, a separate file linked from the README's PFAQ
(<https://github.com/keithamus/sort-package-json/blob/main/defaultRules.md>), in its first two
lines:

> `package.json` fields are sorted by the order they are listed below. **The default key sort
> order is alphabetical.**
>
> _Note: when a specific key order is used, **any other keys will be sorted in the end of the
> object**_

So the sorted tail is **documented**. Two smaller gaps remain genuinely source-only, verified by
grepping both `README.md` and `defaultRules.md` and by `git log -S` over the README:

- **The `_`-prefix rule** — that underscore-prefixed keys are segregated _after_ the sorted
  public tail — appears in neither file. It has been undocumented since PR #102 (Dec 2019).
- **"Alphabetical" is imprecise**: the sort is `Array#sort()`, i.e. **codepoint** order, so
  `Zebra` precedes `apple` (**[executed]** above). A reader taking "alphabetical" at face value
  would predict the opposite.

Why I missed it: `defaultRules.md` is **not shipped in the npm tarball**. `sort-package-json@4.0.0`
contains eight files (`LICENSE README.md cli.js index.cjs index.d.ts index.js package.json
reporter.js`), so the README's `./defaultRules.md` link is dead for anyone reading the installed
package and resolves only on GitHub/npmjs.com. Worth recording as a general lesson: _"absent from
the published artifact" is not the same as "undocumented"_ — check the repo as well as the
tarball.

The rationale for `_`-last _is_ on the record, in the PR body
(<https://github.com/keithamus/sort-package-json/pull/102>):

> npm offical package `read-package-json` and popular package `read-pkg` [...] add some private
> keys to json, like `_id`. This PR make those private keys always at bottom. so we can easy
> read -> sort -> write

Worth noting: that is the one place in this survey where position _is_ assigned by consumer —
keys injected by a different tool are segregated to the bottom. It is a two-bucket
first-party/machine-injected split, not a per-consumer ordering, and it lives in a PR body, not
in any doc.

### 2.7 Null result: nothing enforces prefix _contiguity_

No tool found requires that the ordered keys be **adjacent** — i.e. that no tail key may
interleave between two prefix keys. `ansible-lint` cannot express it (a middle key by definition
sits between `name` and `block`). `eslint-plugin-yml` explicitly permits interleaving
(**[executed]**: `title,zeta,date,tags` passes). `perfectionist` forbids it only as a side
effect of the `unknown` group being _positioned_ in `groups`. `GEN-001` does not enforce it
today. Requiring contiguity would be an invention.

---

## 3. Ordering principle when consumers differ

### 3.1 The Kubernetes rationale does not exist — hypothesis refuted

`apiVersion → kind → metadata → spec` was the case most likely to have a documented
deserialization rationale. It has none, and the folk explanation is wrong. Three independent
refutations:

**(a) The normative doc never mentions order, and lists the keys the other way round.** The
Kubernetes API conventions doc
(<https://github.com/kubernetes/community/blob/master/contributors/devel/sig-architecture/api-conventions.md>)
was grepped for `key order`, `field order`, `alphabetical`, `first field`, `must be first`,
`appear first` — one hit, about controller operations. What it does say:

> All JSON objects returned by an API MUST have the following fields:
>
> - kind: a string that identifies the schema this object should have
> - apiVersion: a string that identifies the version of the schema the object should have
>
> **These fields are required for proper decoding of the object.**

"Required for proper decoding" is a claim about **presence**, not position — and the doc itself
lists `kind` before `apiVersion`, as does its own worked example. `TypeMeta` in
`apimachinery/pkg/apis/meta/v1/types.go` also declares `Kind` first, both fields `+optional`.

**(b) The decoder is two-pass, so position is structurally irrelevant.**
`SimpleMetaFactory.Interpret` (`apimachinery/pkg/runtime/serializer/json/meta.go`) does a full
`json.Unmarshal` of the entire document into a two-field struct, discarding the rest — there is
no streaming short-circuit. And `Serializer.Decode` runs `yaml.YAMLToJSON(data)` _before_
`Interpret`, which routes through `map[string]interface{}`, destroying YAML key order outright.

**(c) [executed] `kubectl v1.36.1` accepts a fully inverted manifest without comment.** Input
`spec / metadata / kind / apiVersion`; `kubectl label --local -f reversed.yaml foo=bar -o yaml`
accepted it, no warning, and re-emitted the conventional order.

**And the "convention" is an accident.** `apiVersion → kind → metadata → spec → status` is
**strictly alphabetical** (a < k < m < sp < st), and `kubectl -o yaml` output order is
alphabetical for an incidental reason: `kubernetes-sigs/yaml` marshals via
`struct → JSON → map[string]interface{} → yaml.v2`, and that last step sorts map keys. The
one-line proof, **[executed]**: `kubectl create secret generic ... -o yaml` emits `apiVersion,
**data**, kind, metadata` — `data` interleaved between `apiVersion` and `kind`, breaking the
"convention" silently. The same command with `-o json` emits `kind` first, following Go struct
order. Nobody ever justified this order because nobody ever chose it.

For completeness: `kubernetes/website`'s style guide has no manifest field-order rule, and
`kubectl-neat` does not reorder.

### 3.2 `ansible-lint` has the only good documented rationale, and it is a bug class

The rule doc has a `## Reasoning` section — the single best primary source found for this
question (<https://ansible.readthedocs.io/projects/lint/rules/key-order/>):

> Making decisions about the optimal order of keys for ansible tasks or plays is no easy task,
> as we had a huge number of combinations to consider. This is also the reason why we started
> with a minimal sorting rule (name to be the first), and aimed to **gradually add more fields
> later, and only when we find the proofs that one approach is likely better than the other.**

> ### Why I no longer can put `when` after a `block`?
>
> Try to remember that in real life, `block/rescue/always` have the habit to grow due to the
> number of tasks they host inside, making them exceed what a single screen. This would move the
> `when` task further away from the rest of the task properties. **A `when` from the last task
> inside the block can easily be confused as being at the block level, or the reverse.** When
> tasks are moved from one location to another, there is a real risk of moving the block level
> when with it.

The originating issue is explicit that no technical argument exists
(<https://github.com/ansible/ansible-lint/issues/578>):

> Putting name of the task as first attribute should be verified, **even if Ansible would allow
> mentioning `name:` at any point because it is a dictionary key.** [...] **Yes both do execute
> the same way**, but from the maintenance point of view, the first one clearly wins.

**And the middle was left free on purpose.** PR #2222 proposed a configurable total order
(`default` / `enhanced` / `everything`) and was **closed, never merged**. PR #2454 superseded it
— "refactor key ordering to allow us to sort all keys" — i.e. they **built the machinery for a
total order and shipped it 80% empty**. Why is on the record: PR #2454 links two discussions
opened specifically to settle the middle keys, and both deadlocked.
<https://github.com/ansible/ansible-lint/discussions/2455> on `when` vs loops —
`tumbl3w33d`: "it certainly makes a difference with blocks [...] the condition of a block tends
to get overlooked or misindented" vs `cidrblock`: "I prefer after, because the task would read
more like a sentence.... 'Do this, this many times, only if that'".
<https://github.com/ansible/ansible-lint/discussions/2456> on `become*` split the same way.

**The principle, stated by the maintainers' own behaviour:** order a key only where there is a
_falsifiable_ argument — a named bug class, or an uncontested legibility claim. Where the only
available argument was aesthetic preference, leave the key unordered and record the failed
deliberation. The commented-out `SORTER_TASKS` entries are that record, in code.

### 3.3 Ordering by consumer was proposed and declined — in the highest-traffic tool

`sort-package-json` issue #39, "large configs, such as xo should be below dependencies". The
proposal is exactly the consumer-grouping principle, from `forivall`:

> my preference in general is that all of the "official" and generic entries should be above
> sections that are specific to a third party tool, and aren't related to the core parts of a
> package.json. [...] **It definitely is a fuzzy classification system though.**

It was not adopted. The maintainer's counter-principles, both documented in the thread,
keithamus (owner):

> I mostly added these blocks above dependencies because they are **more often hand-edited** than
> the `dependencies`/`devDependencies` fields, and so having them closer to the top means less
> navigating within the file to edit them.

> my intuition was that it made sense to put these configs **next to scripts** also - as
> **script invocation can imply parts of the config**.

Note that the second principle is the _opposite_ of grouping by consumer: it deliberately puts
`scripts` (read by npm) adjacent to `prettier`, `eslintConfig`, `jest` (read by three other
tools), because the key that _invokes_ a tool belongs next to the key that _configures_ it. And
in issue #30 a third principle appears — bulk:

> I'd like to avoid moving _any_ keys above dependencies. Specifically for a few projects I'm
> working on we have config keys that are **very large** and I'd like to leave them _below_
> dependencies.

**The most directly relevant complaint in the whole survey** is `raphinesse` in the same thread,
naming the exact failure mode of an ordered prefix with a free tail:

> I see how people want to have tooling config near `scripts`, but **it does not work very well
> when only _some_ of your tools are recognized keys.** I just had the case where `prettier`
> ended up below `scripts`, while `xo` (also code style related) ended up at the very bottom.
> **That's definitely not desirable for me.**

That is the `files`/`paths` situation precisely: two keys that answer the same question, one
inside the enforced prefix and one in the tail. His conclusion:

> there will always be missing keys. And with all the custom keys, **ordering is a matter of
> preference**.

And the maintainer's reason for a fixed order _at all_ — the strongest documented argument for
canonicalisation in this survey:

> It should be portable and reliable to the point that if I run `npx sort-package-json` on _any_
> folder, **I can predict the result without looking at files other than package.json**.

> Think of it like `gofmt`. It just does what it does - you don't get to pick; but thats a good
> thing because it **alleviates you from _any kind of decision_**.

### 3.4 Terraform: a vendor-documented order that nothing enforces — the cautionary case

HashiCorp normatively documents the argument order quoted in §2.4, with a stated organising
principle: **meta-arguments first and last, resource-specific arguments free in the middle**.

> For blocks that contain both arguments and 'meta-arguments' (as defined by the Terraform
> language semantics), list meta-arguments first and separate them from other arguments with one
> blank line. **Place meta-argument blocks last** and separate them from other blocks with one
> blank line.

That is a real ordering principle — and note that it is _neither_ consumer-based nor
alphabetical. It sorts by **what the key is about**: the language's own control keys bracket the
provider's payload keys.

**Nothing enforces it, and that is deliberate at every layer.** Three levels of evidence:

1. HashiCorp says so on the style page itself: "The `terraform fmt` command formats your
   Terraform configuration to **a subset of the above recommendations**."
2. `terraform fmt` is structurally incapable of it. It runs on `hclwrite`, whose
   `hclwrite/format.go` states the invariant outright: "**Formatting must change only
   whitespace.** Specifically, that means changing the SpacesBefore attribute on a token while
   leaving the other token attributes unchanged." `grep -i "sort\|reorder"` over
   `internal/command/fmt.go` returns nothing.
3. **`tflint` had ordering rules, merged them, then reverted them on principle.** Issue #22
   (<https://github.com/terraform-linters/tflint-ruleset-terraform/issues/22>), maintainer
   `bendrucker`:

   > These are personal opinions. They are not official best practices (i.e. described/mentioned
   > in the Terraform docs), which is the standard I'd recommend for this ruleset. … for TFLint
   > to have its own opinion on what is 'proper' in an official/core ruleset, **is decidedly
   > wrong to me**.

   and maintainer `wata727`: "For now, revert the `terraform_ordered_locals` rule." The official
   ruleset now disclaims the whole category: "This ruleset _does not_ provide configurable rules
   for personal/team style or usage preferences."

Enforcement survived only in `Azure/tflint-ruleset-basic-ext`, whose
`terraform_resource_data_arg_layout` implements the category order as buckets — "The arguments
are split into the following types: **head-meta (for-each/count, provider), attr, block,
tail-meta (lifecycle, depends_on)**" — and **that repository is archived** (confirmed:
`{"archived": true}`).

The lesson for this ticket is uncomfortable and worth stating: a canonical order can be
_documented normatively by the format's own vendor_ and still fail to survive contact with a
linter, because the maintainers judged that enforcing a non-behavioural position exceeded their
mandate. `bendrucker`'s standard — enforce only what the format's own documentation describes —
is the same bar `ansible-lint` set with "proofs that one approach is likely better".

### 3.5 The one principled _derivation_: let the schema define the order

`composer normalize` (§2.3) is the only system in the survey where the canonical order is not
hand-authored at all. It is **the property order of the JSON Schema**, read at runtime:
"properties will be reordered as found in the schema". No list to maintain, no list to drift, no
arbitrary intra-group ordering to justify, and the order automatically follows whatever the
schema authors already decided was a sensible presentation order.

This is worth flagging as the strongest _transferable_ idea in the survey, because this harness
has an equivalent artefact: the ADR frontmatter contract itself. If the enforced order is defined
as "the declaration order of the contract", then adding a key to the contract adds it to the
order for free, and the order needs no independent justification beyond the contract's.

### 3.6 The one place position _is_ a documented signal

kustomize's `kustomization.yaml` writer, in a Go doc comment
(`kustomize/commands/internal/kustfile/kustomizationfile.go`):

> **Deprecated fields are removed from the list, meaning they will drop to the bottom on output
> (if present).**

Position as a deprecation signal — deliberate, reasoned, and **source-only**. Its sibling,
`kyaml/kio/filters/fmtr.go`, documents the ordered-prefix-plus-lexicographic-tail design:

> Fields are ordered using a relative ordering applied to commonly encountered Resource fields.
> All Resources, including non-builtin Resources such as CRDs, share the same field precedence.
> **Fields that do not appear in the explicit ordering are ordered lexicographically.**

No rationale is given anywhere for the ordering _within_ its groups (e.g. `image, command, args,
workingDir, ports, envFrom, env`), which is neither alphabetical nor obviously semantic. And
neither kustomize order is reachable from the CLI most people run: **[executed]**,
`kubectl kustomize` output was strictly alphabetical, not `fieldSortOrder`.

### 3.7 The documented answer to "many consumers, one file" is namespacing, not ordering

PEP 518 (<https://peps.python.org/pep-0518/>):

> The `[tool]` table is where any tool related to your Python project, not just build tools, can
> have users specify configuration data as long as they use a sub-table within `[tool]` [...]
> We need some mechanism to **allocate names within the `tool.*` namespace**, to make sure that
> different projects don't attempt to use the same sub-table and collide.

PEP 518 says nothing at all about ordering. `package.json` does the same thing informally with
`prettier`, `eslintConfig`, `jest` as per-consumer keys. When a format has to serve many
consumers, the mechanism every spec reaches for is a **namespace**, which makes position
irrelevant.

### 3.8 Null result, stated plainly

**No system in this survey orders keys by which consumer reads them.** The candidates were
Kubernetes (no rule at all), GitHub Actions (no rule; and GitHub _does_ document
order-sensitivity where it exists — matrix variable order determines job creation order — which
makes the silence elsewhere meaningful), Helm (no rule anywhere in docs, `helm lint`, or `ct`),
`sort-package-json` (proposed, declined, called "fuzzy"), Cargo/PEP 621 (no rule), and
`ansible-lint` (ordering justified by bug class, not consumer). The only consumer-shaped
position rule found anywhere is `sort-package-json`'s `_`-prefix bucket, which is a two-way
first-party/machine-injected split documented only in a PR body.

---

## 4. What changing an enforced order costs

### 4.1 `sort-package-json`: ten years, never once breaking

Its release history was read in full via the GitHub releases API and grepped for `order`,
`revert`, `breaking`, `move`, `position`. Findings:

- **Adding a key to the canonical order ships as a `feat:` minor.** Every time, for ten years:
  `feat: sort wireit (#402)`, `feat: add svelte to sort order list (#260)`,
  `feat: add support for react-native key (#243)`, `feat: sort prettier field (#121)`, and
  ~25 more. Semantic-release turns `feat:` into a minor bump.
- **Correcting an existing order ships as a `fix:` patch.** `v1.35.1` — "order of dependencies
  (#115)". `v3.6.1` — "stop forcing `exports` `types` to be first (#398)".
- **No ordering change has ever been marked `BREAKING CHANGE`.** The only three breaking
  releases in the whole history are runtime/module-format: v2.0.0 (pure ESM), v3.0.0 (drop
  Node < 20), v4.0.0 (drop Node 20). Verified by grepping every release body.
- **No migration notes exist anywhere.** Downstream users absorb the churn silently at their
  next format run, which for a formatter is a `git diff`, not a build failure.

The README even documents that extension is routine and welcome:

> ### It doesn't sort X?
>
> Cool. Send a PR! It might get denied if it is a specific vendor key of an unpopular project
> [...] If your project has, say, over 100 users, then we'll add it. Sound fair?

### 4.2 Three ordering rules were reverted, for two different reasons

`v2.15.1` reverted "sort pre/post scripts with colon together" (#332/#333). More instructive is
`v3.6.1`, "stop forcing `exports` `types` to be first" (#398), fixing #393. The cause, from
`GeorgeTaveras1231` in the PR that introduced the bug
(<https://github.com/keithamus/sort-package-json/pull/349>):

> This is wrong because `import` and `module-sync` are not equal. [...] **the resolver will use
> `module-sync` if it comes before `import`.** [...] **So this breaks the way the package is
> read.**

And the maintainer's rule, drawn from it (<https://github.com/keithamus/sort-package-json/issues/393>):

> The goal of the project is to simply deterministically sort the package.json. **If some fields
> are order dependant, we shouldn't sort them.**

For YAML frontmatter this risk is nil by §0 — mapping order is not data — which is a point in
favour of enforcing order here, not against it.

**The third revert had a different cause and is the more relevant one.** `tflint` merged
argument-order rules and then removed them, not because they broke anything but because the
maintainers judged an unjustifiable position rule to be out of scope for an official ruleset
(§3.4): "These are personal opinions. They are not official best practices … for TFLint to have
its own opinion on what is 'proper' in an official/core ruleset, is decidedly wrong to me."
Together the three reverts say: the cost is not in _changing_ an order but in **having enforced a
position you could not justify** — one class of failure was semantic (a consumer read the order),
the other was governance (nobody could defend the order).

### 4.3 Black is the only tool that prices canonical-form churn explicitly

<https://black.readthedocs.io/en/stable/the_black_code_style/index.html>:

> If code has been formatted with Black, it will remain unchanged when formatted with the same
> options using any other release **in the same calendar year**.

Style changes are batched to the January release, with `--preview` / `--unstable` as a staging
channel explicitly exempt from the guarantee. This is the mature form of the answer: canonical-
form changes churn every file, so gate them to an announced window and stage them behind a flag.

### 4.4 Two cheaper strategies, both shipped

**Placement policy (kustomize).** `marshal()` emits `mf.originalFields` — the user's own key
order, comments attached — and only _then_ appends canonical-order fields not already present.
`kustomize edit add resource` never reshuffles an existing file. Under this design, changing the
canonical order costs **nothing** for existing files, because they are never renormalised.

**Don't order what you can't justify (`ansible-lint`).** Shipping the total-order machinery 80%
empty means every future addition is a pure extension with no migration, and the cost of having
been wrong is zero. This is the cheapest strategy of all, and it is a deliberate, documented
choice (§3.2).

---

## 5. What this does and does not license

Grounding facts about this repo, so the conclusions are checkable:

- `FIELD_ORDER` is six keys; the rule is an **acceptance predicate** over relative order among
  those six, blind to any other key and to contiguity (`GEN-001-adr.rules.ts`, `FIELD_ORDER` and the `present`/`actual` comparison).
- **There is exactly one ADR.** `.archgate/adrs/` contains only `GEN-001-adr.md`, whose
  frontmatter is `type id title domain rules paths files description`. The migration surface for
  an order change is **one file**.
- `files` landed on 2026-08-24 in commit `5812f8f`, in the tail, immediately after `paths`.
- archgate's own schema is `{id, title, domain, rules, files?, respectGitignore?}` — it knows
  nothing of `type` or `paths`. So the enforced prefix is `{harness key} + {archgate's four
required keys}` with Claude Code's `paths` appended, while archgate's _own_ optional keys
  (`files`, `respectGitignore`) sit in the tail. **The current order is already not
  consumer-grouped**: archgate's `files` is separated from archgate's `id/title/domain/rules`
  by Claude Code's `paths`.

### Licensed — this is adoption, not invention

1. **An ordered prefix with a free tail.** Precedented at **spec** level with a documented
   rationale (JAR manifest, §2.1), in a **default-on rejector** (`ansible-lint`, §2.2), and in a
   **default-on formatter** whose README documents the tail explicitly (`cargo-sort`: "Any
   unspecified table will be after specified", §2.3). `GEN-001`'s existing shape is the
   mainstream shape, and the free-tail half is documented in three independent places.
2. **Enforcing an optional key's position** — "if present, it must sit here". Shipped and
   documented in `ansible-lint` (`block`/`rescue`/`always`), stated in prose by HashiCorp ("If
   present… If required…"), and verified by execution in `perfectionist` and `eslint-plugin-yml`
   (§2.4). Not an invention; in the formatter family it is the _default_ consequence of a
   presence guard.
3. **A leading discriminator key.** `type` first has a documented spec precedent whose stated
   reason is recognisability — "so that they can be recognized easily as magic strings" — which
   is a better articulation of `GEN-001`'s existing rationale than the ADR currently gives.
4. **Adding a key to the enforced order is cheap and reversible.** The largest tool in the
   category does it several times a year as a **minor** version bump with 3.3M weekly dependents
   and no migration notes, and has never once called an order change breaking (§4.1). At `n = 1`
   ADR this is nearly free. **It is not a one-way door**, and #14's framing of it as "the one
   open call" is if anything over-cautious about the _mechanics_.

### Not licensed

5. **Ordering by consumer.** No system does it. It was **proposed and declined** in the
   highest-traffic tool, on the grounds that it is "a fuzzy classification system", and the
   concrete harm named in that thread — a semantic pair split across the prefix/tail boundary —
   _is_ the `files`/`paths` situation (§3.3). Adopting it would be an invention, and one with a
   documented objection already on file against it.
6. **Any claim of a technical or parsing rationale.** YAML forbids order-dependence outright
   (§0), and the one system everyone cites for this — Kubernetes — turns out to have no rule,
   an order-independent two-pass decoder, and an _alphabetical accident_ for a convention
   (§3.1). Do not repeat that folklore in an ADR.
7. **Prefix contiguity.** Nothing enforces it (§2.7). If a rule change makes `files` part of the
   prefix, it should stay an acceptance predicate over relative order, matching both the current
   rule and every precedent.
8. **Citing `sort-package-json` as precedent for a _free_ tail.** Its tail is codepoint-sorted
   with `_`-keys last — documented as sorted in `defaultRules.md`, though the `_` rule and the
   codepoint collation are not (§2.6). Cite `cargo-sort`, `ansible-lint` or the JAR spec for the
   free tail; cite `sort-package-json` for the canonicalisation rationale and the change-cost
   evidence.
9. **Enforcing a position the ADR cannot defend in one sentence.** This is the failure mode that
   actually cost people something. Terraform's argument order is documented by the format's own
   vendor and still got reverted out of `tflint` as "personal opinions" (§3.4); `ansible-lint`
   left five positions unordered rather than pick between two defensible readings (§3.2). An
   enforced position with no stated reason is the thing every maintainer in this survey removed.

### The bar the best precedent sets, applied

`ansible-lint`'s standard is: order a key only where there is a **falsifiable** argument, and
otherwise leave it in the free zone and record why (§3.2). Applying that here:

- **The presence rule #14 proposes clears the bar easily.** There is a named, reproduced bug
  class — `paths:` without `files:` silently unscopes an ADR to the whole repo, and everything
  passes either way. That is exactly the kind of evidence `ansible-lint` demanded before
  ordering `when`.
- **The position claim does not clear it on current evidence.** No bug arises from `files`
  sitting after `description` rather than after `paths`. Note that `ansible-lint` deliberately
  keeps presence (`name[missing]`) and position (`key-order`) in **separate rules** with
  separate justifications (§2.4); satisfying the presence argument does not carry the position
  argument along with it.
- **If `files` does join the prefix, two principles in the survey would place it, and they
  agree.** _Pair-adjacency_ — `sort-package-json`'s "the invoking key belongs next to its
  config", and the direct fix for raphinesse's split-pair complaint (§3.3) — puts `files`
  immediately after `paths`. So does _keep the required keys contiguous_: `files` becoming
  mandatory makes it the sixth required key, and `paths` is already the boundary between required
  and optional. Both land on `… rules → paths → files`, which is **where it already sits in
  `GEN-001`**. The change would therefore be a no-op for the one existing file and would purely
  add enforcement — the cheapest possible version of this decision, and an argument for doing it
  now while `n = 1` rather than after the ADR set grows.
- **`respectGitignore` should stay in the tail.** No precedent supports ordering a key that
  nothing is required to set, and #14 already scopes it to documentation only.

Two options the survey surfaces that #14 does not consider:

**Shrink the enforced prefix rather than grow it.** `ansible-lint` enforces three zones out of a
possible eight because five positions could not be justified, and documented the deadlock instead
of picking. `GEN-001` enforces six positions and has a stated rationale for exactly one of them
(`type` leads). If the briefing-budget pressure noted in #14 is real, the precedent-backed move
is to keep the enforced set small and _justified_, not to extend it by symmetry.

**Derive the order from the contract instead of restating it.** `composer normalize` is the only
system here whose canonical order is not hand-maintained: it _is_ the property order of the JSON
Schema (§3.5). The analogue is to define `FIELD_ORDER` as the declaration order of the ADR
frontmatter contract — so adding a key to the contract adds it to the order for free, the two
can never drift, and the order inherits the contract's justification rather than needing its own.
Note this only shifts the burden if the contract's own order is itself defensible; it is a
maintenance win, not a justification win. Helm does the analogous thing for its resource
install order — documenting the _existence_ and _effect_ of the order in prose while
delegating the list itself to a pinned source link — which is the pattern to copy if `GEN-001`'s
prose is over budget.

---

## 6. Claims I could not verify

Recorded so nothing above reads as more settled than it is.

1. **`cargo-sort`'s default-path behaviour was not reproduced against a binary** — no `cargo` in
   the probe environment. The `Config::default()` → `sort_by_ordering` branch is unambiguous in
   source, but the README's contradicting comment (§2.3) means the claim rests on source reading
   alone.
2. **`kustomize cfg cat --format` applying `fieldSortOrder` is source-verified only.** The
   registration chain and the `--format` default of `true` were read; no `kustomize` binary was
   available, and `kubectl kustomize` exposes only `build`, which **was** tested and does _not_
   apply it.
3. **No rationale was found for the ordering _within_ kustomize's field groups** (e.g. `image,
command, args, workingDir, ports, envFrom, env`) or within `fieldMarshallingOrder`. It is
   neither alphabetical nor obviously semantic. If a design document exists it is not in the
   repository, the commit messages, or the package docs — so "unjustified" here means "no
   justification located", not "provably arbitrary".
4. **`kubernetes/website` was not searched exhaustively** — only the `content/en/docs/contribute/
style/` tree, which yielded `style-guide.md` and a shortcode JSON.
5. **`yamllint`: no custom-order request has ever been filed.** Searched the tracker for
   `key-ordering`, "custom order", "specific order", "sort order", "key order", plus PRs and
   Discussions. Do **not** cite a maintainer refusal of custom orders — none exists. The
   adjacent `list-ordering` refusal (§0) is a different question.
6. **Debian's `deb822` format was only checked at the Policy Manual level.** Policy specifies no
   intra-stanza field order; I did not read `dpkg`'s parser to confirm it imposes none either.
7. **`eslint-plugin-json-files`' `sort-package-json` rule** was not pinned down — its README
   links out to per-rule docs that were not resolved, so whether it reports or autofixes is
   unconfirmed. It is a wrapper around `sort-package-json` and adds nothing to §2.6 either way.

### Versions probed

`sort-package-json` 4.0.0 and `sort-object-keys` (bundled) — inspected and executed;
`eslint` 10.9.1, `eslint-plugin-yml` 3.8.1, `eslint-plugin-perfectionist` 5.10.1 — executed;
`kubectl` v1.36.1 — executed; `archgate` typings from this repo's `.archgate/rules.d.ts`;
`yamllint`, `ansible-lint`, `cargo-sort`, `toml-sort`, `taplo`, Obsidian Linter, kustomize,
kube-linter, `terraform`, `tflint` — read from `main`/`master` on 2026-08-25.
