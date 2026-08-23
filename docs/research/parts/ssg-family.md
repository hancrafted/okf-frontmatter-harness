# SSG family: path-scoped frontmatter defaults (Hugo, Jekyll, Eleventy)

Slice of research ticket #3. How three static-site generators attach frontmatter values to
files by path, what they can assert, and how overlapping rules resolve. Companion to
`docs/research/pathrule-precedence.md` (generic path-rule precedence); that ground is not
re-surveyed. Every load-bearing claim is quoted from a primary source — the vendor's own docs
markdown, or the implementation. Where a fact could not be established from a primary source,
that is stated rather than inferred. Fetched 2026-08-23 from each repo's default branch.

---

## Hugo

### Archetypes are not validation

The ticket is named for archetypes; the honest finding is that they have nothing to do with
constraining frontmatter.

> `description: An archetype is a template for new content.` —
> `gohugoio/hugoDocs:content/en/content-management/archetypes.md:3`
>
> "The `hugo new content` command creates a new file in the `content` directory, using an
> archetype as a template." — `archetypes.md:13`
>
> "remember that Hugo evaluates these once—at the time of content creation" —
> `archetypes.md:122`

Binding is by **content type**, resolved once at file-creation time, as a first-match-wins
single winner — not a merge:

> "Hugo looks for archetypes in the `archetypes` directory in the root of your project, falling
> back to the `archetypes` directory in themes or installed modules. An archetype for a
> specific content type takes precedence over the default archetype." — `archetypes.md:45`.
> Order: `archetypes/posts.md`, `themes/my-theme/archetypes/posts.md`, `archetypes/default.md`,
> `themes/my-theme/archetypes/default.md` (`archetypes.md:55-58`). "If none of these exists,
> Hugo uses a built-in default archetype." — `archetypes.md:60`

**Does Hugo validate front matter at all?** No primary source found that describes schema
validation. Searching `content/en/content-management/front-matter.md` for validation vocabulary
turns up exactly two constraint-shaped statements, neither path-scoped: date parseability (the
"Dates" section), and a global reserved-name rule — the only _negative_ assertion anywhere in
Hugo's frontmatter story:

> "The field names below are reserved. For example, you cannot create a custom field named
> `type`. Create custom fields under the `params` key." — `front-matter.md:39`

No `required`, no type assertion, no enum, no per-directory schema. I could not establish that
Hugo fails a build for a missing or malformed (non-date) field.

### Cascade — the real relative of `okf-config.yml`

**Binding.** Two entry points, same semantics: a `cascade` block in a _branch_ page's front
matter, or top-level `cascade` in the site config.

> "`cascade`: (`map`) A map (or array of maps) of front matter keys whose values are passed
> down to the page's descendants unless overwritten by self or a closer ancestor's cascade." —
> `front-matter.md:47-48`
>
> "The `target` key accepts a page matcher to limit cascaded values to a subset of pages. If a
> target is not specified, values cascade to all descendant pages." — `front-matter.md:233`
> (config variant: "If a target is omitted, values cascade to all pages." —
> `configuration/cascade.md:28`)
>
> "A _page matcher_ filters pages by logical path, page kind, environment, or site. Specify
> filtering criteria using any combination of the following keywords." —
> `hugoDocs:content/en/_common/configuration/page-matcher.md:5`

| keyword       | value                                                 | example                |
| ------------- | ----------------------------------------------------- | ---------------------- |
| `path`        | glob on logical path                                  | `{/books,/books/**}`   |
| `kind`        | glob on page kind                                     | `{taxonomy,term}`      |
| `environment` | glob on build environment                             | `{staging,production}` |
| `sites`       | sites matrix (language/version/role), new in v0.153.0 |                        |
| `lang`        | **deprecated** 0.153.0 in favour of `sites`           |                        |

— `_common/configuration/page-matcher.md:7-22`. The selector key itself churned: `_target` →
`target` in v0.156.0 ("The `_target` alias for `target` is deprecated and will be removed in a
future release" — `configuration/cascade.md:60`).

**Precedence.** The glossary states the whole rule in one sentence:

> "Hugo does not cascade a value if the descendant already defines the field, or if a closer
> ancestor branch or an earlier element in a cascade array has already set a value for the same
> field." — `hugoDocs:content/en/quick-reference/glossary/cascade.md:6`

Three-part ordering, all **first-writer-wins**: self beats everything; closer ancestor beats
farther; **earlier** array element beats later. That last point is the opposite of the
last-match-wins convention the ADR rejected for `remark-lint-frontmatter-schema`, and the
opposite of `.gitattributes` / Prettier `overrides` in the companion doc. The implementation
confirms a **per-key presence check** — not a merge, not a replace:

```go
// Cascade defined on itself has higher priority than inherited ones.
allCascades := hiter.Concat(ps.m.cascadeCompiled.All(), cascades.All())
for v := range allCascades {
    if !v.Target.Match(ps.Kind(), ps.Path(), ps.s.Conf.Environment(), ps.s.siteVector) { continue }
    for kk, vv := range v.Params {
        if _, found := ps.m.pageConfig.Params[kk]; !found { ps.m.pageConfig.Params[kk] = vv }
    }
```

— `gohugoio/hugo:hugolib/page__meta.go:557-569`. `Params` is seeded from the page's own
frontmatter immediately above (`page__meta.go:542-547`), which is why self always wins;
closer-ancestor priority comes from the tree walk prepending each branch's cascade as it
descends — `cascades = cascades.Prepend(pms.getCascade())`
(`hugolib/content_map_page_assembler.go:237`).

**Partial override / relaxation.** A descendant can _replace_ an inherited value by defining
the field. Whether it can **clear** one is **not documented**. The guard is key _presence_, not
truthiness, so an explicit YAML null (`color:`) should suppress the cascade if the decoder
retains the nil-valued key — but there is no such case in `hugolib/cascade_test.go` (600 lines;
grep for `null|nil|empty|unset|clear` returns only unrelated `qt.IsNil` assertions at lines
318-328) and no doc statement. **Unverified.** There is no way to _remove_ a cascade entry from
a descendant — no `!` form, no `unset`. Relaxation can only shadow a value, never drop a rule.

**Vocabulary.** Values only. A `cascade.params` block is arbitrary frontmatter data: no
predicate language, no `required`, no type, **no negative assertion**.

**Data vs code.** Data — TOML/YAML/JSON maps plus glob strings; no user code runs. (Archetypes
are Go templates, i.e. code, but run at authoring time only.)

---

## Jekyll — `_config.yml` `defaults:`

Structurally the closest thing to `okf-config.yml` in this survey: a **YAML array of
path-scoped rule objects in a single site-level config file**.

### Binding

> "The `defaults` key holds an array of scope/values pairs that define what defaults should be
> set for a particular file path, and optionally, a file type in that path." —
> `jekyll/jekyll:docs/_docs/configuration/front-matter-defaults.md:12`
>
> "The different types that are available to you are `pages`, `posts`, `drafts` or any
> collection in your site. While `type` is optional, you must specify a value for `path` when
> creating a `scope/values` pair." — `front-matter-defaults.md:50`

Canonical shape (`front-matter-defaults.md:39-47`): `defaults: [{scope: {path: "", type:
"posts"}, values: {layout: "default"}}]`, where `path: ""` carries the comment "an empty string
here means all files in the project".

**`scope.path` is a prefix, not a glob** — unless it contains a literal `*`:

`rel_scope_path.include?("*") ? glob_scope(...) : path_is_subpath?(sanitized_path,
strip_collections_dir(rel_scope_path))`, and `path_is_subpath?(path, parent_path)` is
`path.start_with?(parent_path)` — `jekyll/jekyll:lib/jekyll/frontmatter_defaults.rb:111-115,
136-138` (condensed from the original `if`/`else` and 3-line `def`). The method is named `path_is_subpath?` but is a bare string prefix test with
**no separator check**: `path: "projects"` also matches `projects-archive/foo.md`. Glob support
arrived later (3.7.0) and is documented as slow:

> "It is also possible to use glob patterns (currently limited to patterns that contain `*`)
> when matching defaults." — `front-matter-defaults.md:94`
>
> "Please note that globbing a path is known to have a negative effect on performance and is
> currently not optimized, especially on Windows." — `front-matter-defaults.md:112-115`

No negation, no exclude, no `!` form: a scope selects, never deselects.

### Vocabulary

None. `values:` is an opaque map of frontmatter keys to literal values: "This can be done with
any value that you would set in the page or post front matter"
(`front-matter-defaults.md:123`). **No predicate, no type, no `required`, no negative
assertion.** The only validation in the whole code path is a shape check on the config itself
(`set.is_a?(Hash) && set["values"].is_a?(Hash)` — `frontmatter_defaults.rb:169`) and a
date-parseability check whose message describes the _config_, not the page: `"An invalid date
format was found in a front-matter default set"` (`frontmatter_defaults.rb:40-49`).

### Precedence — documented vs implemented

The documented rule is **specificity, not order**:

> "Jekyll will apply all of the configuration settings you specify in the `defaults` section of
> your `_config.yml` file. You can choose to override settings from other scope/values pair by
> specifying a more specific path for the scope." — `front-matter-defaults.md:121`

The implementation defines "more specific" as the **byte length of the scope path string**:

```ruby
def has_precedence?(old_scope, new_scope)
  return true if old_scope.nil?
  new_path = sanitize_path(new_scope["path"])
  old_path = sanitize_path(old_scope["path"])
  if new_path.length != old_path.length
    new_path.length >= old_path.length
  elsif new_scope.key?("type") then true
  else !old_scope.key? "type"
  end
end
```

— `frontmatter_defaults.rb:179-192`

| situation                                      | winner            | why                                                |
| ---------------------------------------------- | ----------------- | -------------------------------------------------- |
| `path: "a/b/c"` (5) vs `path: "documents"` (9) | `documents`       | longer _string_, not deeper path                   |
| equal-length paths, one has `type:`            | the typed one     | `frontmatter_defaults.rb:187-188`                  |
| equal length, both typed or both untyped       | later declaration | `has_precedence?` returns true for the newer scope |

So neither pure specificity nor pure order: **string-length specificity with declaration order
as tiebreak**. A deeper but textually shorter path loses.

### Merge granularity — per key, deep

```ruby
matching_sets(path, type).each do |set|
  if has_precedence?(old_scope, set["scope"])
    defaults = Utils.deep_merge_hashes(defaults, set["values"]); old_scope = set["scope"]
  else
    defaults = Utils.deep_merge_hashes(set["values"], defaults)   # existing wins
  end
end
```

— `frontmatter_defaults.rb:81-88` (two statements joined onto one line). Merging is at the **leaf** — `deep_merge_hashes` recurses
into nested hashes (`lib/jekyll/utils.rb:28-30, 41-47`) — and the argument order flips so the
higher-precedence set's values persist. This is the same "ordered cascade merging at the leaf"
shape `okf-config.yml` needs, but merging _values_, not constraints.

### Page frontmatter overrides defaults

> "Finally, if you set defaults in the site configuration ... you can override those settings
> in a post or page file. All you need to do is specify the settings in the post or page front
> matter." — `front-matter-defaults.md:125`
>
> "The `projects/foo_project.md` would have the `layout` set to `foobar` instead of `project`
> and the `author` set to `John Smith` instead of `Mr. Hyde` when the site is built." —
> `front-matter-defaults.md:151-153`

Confirmed by reader ordering: `merge_defaults; read_content(**opts); read_post_data`
(`lib/jekyll/document.rb:306-308`), where `merge_defaults` (`document.rb:477-480`) calls
`frontmatter_defaults.all(...)` and `read_content` (`document.rb:482-490`) then deep-merges the
file's own front matter on top via `merge_data!` (`document.rb:77`).

### Partial override / relaxation, data vs code

A narrower default can **change** an inherited value, never **remove** one:
`deep_merge_hashes!` only writes keys, never deletes. Setting a key to `nil` in a narrower
scope merges `nil` in as a value rather than erasing the key; I found no primary-source
statement or test covering the nil case, so **unverified**. The whole mechanism is pure data —
YAML in `_config.yml`, no Ruby written by the author.

---

## Eleventy — directory data files + `eleventyDataSchema`

### Binding

No central config. Rules bind by **file naming convention and co-location**; the path scope is
implicit in where the file sits.

> "For example, consider a template located at `posts/subdir/my-first-blog-post.md`. Eleventy
> will look for data in the following places (starting with highest priority, local data keys
> override global data):" — `11ty/11ty-website:src/docs/data-template-dir.md:15`

| tier                       | file                                                 | scope             |
| -------------------------- | ---------------------------------------------------- | ----------------- |
| Template Data File         | `posts/subdir/my-first-blog-post.11tydata.{js,json}` | that one template |
| Directory Data File        | `posts/subdir/subdir.11tydata.{js,json}`             | `posts/subdir/*`  |
| Parent Directory Data File | `posts/posts.11tydata.{js,json}`                     | `posts/**/*`      |
| Global Data Files          | `_data/*.{js,json}`                                  | all templates     |

— `data-template-dir.md:17-31`; "The name of the data file must match either the post or the
directory it resides within." (`data-template-dir.md:47`)

No glob, no pattern, no selector expression: the directory _is_ the selector, so two rules of
equal specificity can never overlap — ancestry is a total order. The full priority list,
highest to lowest: "1. Computed Data 2. Front Matter Data in a Template 3. Template Data Files 4. Directory Data Files (and ascending Parent Directories) 5. Front Matter Data in Layouts 6.
Configuration API Global Data 7. Global Data Files"
(`11ty/11ty-website:src/_includes/datasources.md:3-9`). `getLocalDataPaths` builds the list
nearest-first then `return unique(paths).reverse()`
(`11ty/eleventy:src/Data/TemplateData.js:692`), so `combineLocalData` merges shallowest→deepest
and the deepest wins (`TemplateData.js:437-486`).

### Vocabulary and merge granularity

Ordinary data files carry values only, no predicates. Merging is deep, at the leaf, with a
documented **array-concatenation** rule: "Eleventy does a deep merge to combine Object literals
and Arrays" (`src/docs/data-cascade.md:60`), implemented as `if (Array.isArray(target) &&
Array.isArray(source)) { return target.concat(source); }`
(`11ty/eleventy-utils:utils/src/Merge.js:36-38`); objects recurse (`Merge.js:40-50`),
everything else (`number, string, class instance, etc`) takes the higher-priority value
(`Merge.js:52-53`).

### Partial override / relaxation — the `override:` prefix

Eleventy is the only member of the family with a first-class opt-out of inheritance.

> "Use the `override:` prefix on any data key to opt-out of deep-merge behavior for specific
> values or nested values." — `src/docs/data-cascade.md:64`
>
> ```markdown
> # Instead of merging the array, this creates an empty set
>
> override:tags: []
> ```
>
> — `src/docs/data-cascade.md:76-81` (front-matter fences elided)
>
> "Even though normally the `posts/firstpost.md` file would inherit the `posts` tag from the
> directory data file (per normal data cascade rules), we can override the `tags` value to be
> an empty array to opt-out of Array merge behavior." — `src/docs/data-cascade.md:83`

Mechanism: the prefixed key does not collide with the inherited key during the recursive walk
(`target[key]` is looked up under the _prefixed_ name and is absent), and the result is written
back under the cleaned name — `let overrideKey = cleanKey(key, override); target[overrideKey] =
getMergedItem(target[key], source[key], prefixes);` (`Merge.js:43-46`). A genuine relaxation
primitive, but it relaxes a _value_, not a _rule_.

### The one negative assertion in the family: `eleventyDataSchema`

> "Use the special `eleventyDataSchema` data property to validate data in your Data Cascade.
> You can set this anywhere in your Data Cascade (front matter, directory data file, global
> data, etc)." — `11ty/11ty-website:src/docs/data-validate.md:9`
> (<https://www.11ty.dev/docs/data-validate/>, added in v3.0.0-alpha.7)
>
> "You can use any schema or validation library to achieve this. In this example, we're using
> `zod`." — `data-validate.md:11`

The documented example is a directory data file, i.e. **path-scoped validation**:

```js
// blog/blog.11tydata.js
export default {
  eleventyDataSchema: function (data) {
    let result = z.object({ draft: z.optional(z.boolean()) }).safeParse(data);
    if (result.error) {
      throw new Error(z.prettifyError(result.error));
    }
  },
};
```

— `data-validate.md:20-32`

Enforcement is a build-breaking throw during template mapping: `await
dataSchemaCallback(pageEntry.data)` in a `try`/`catch` that rethrows as
``new BaseError(`Error in the data schema for: ${map.inputPath} (via ...)`, e)``
(`11ty/eleventy:src/TemplateMap.js:346-373`).

Because it is an arbitrary callback it **can** express negative assertions (`if ("legacyField"
in data) throw ...`) and required-ness (`z.string()` without `.optional()`) — which nothing
else in this family can. The cost: it is **code, not data**. The tests at
`11ty/eleventy:test/CoreTest.js:1212-1286` show both hand-written type checks and `zod`,
requiring a JS runtime and a third-party dep.

**Schemas do not compose.** `eleventyDataSchema` is an ordinary data key, so it rides the same
cascade: a function is neither plain object nor array, so `Merge` returns the higher-priority
`source` (`Merge.js:52-53`), and the runner reads a single value via
`ResolveConfigurationData.getValue(pageEntry.data, this.config.keys.dataSchema)`
(`TemplateMap.js:354-357`). A `blog/drafts/` schema therefore **replaces** the `blog/` schema
rather than adding to it — the `vscode-yaml` single-winner failure mode the ADR already
rejected. This is read from the source: **no doc statement and no test covers two schemas at
different cascade levels**, so treat as source-derived, not vendor-confirmed.

Naming note: on Eleventy `main` (v4.0.0-alpha) the key is being renamed to
`buildawesomeDataSchema` (`src/defaultConfig.js:96`), with `eleventyDataSchema` kept as an alias
(`test/ResolveConfigurationDataTest.js:9`).

**Data vs code.** Mixed, and the split falls exactly on the constraint boundary.
`*.11tydata.json` is data and can only set values; `*.11tydata.js` is code. Validation is
available **only** in the code form.

---

## Implications for the harness

| dimension               | Hugo `cascade`                                                  | Jekyll `defaults`                                                               | Eleventy dir data                               |
| ----------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------- |
| binding                 | page matcher: glob on `path` + `kind` + `environment` + `sites` | `scope: {path, type}`; path is a **prefix**, glob only if it contains `*`       | filename/co-location; directory is the selector |
| central file?           | yes (site config) **or** distributed (branch front matter)      | yes, `_config.yml` only                                                         | no — always distributed                         |
| overlap possible?       | yes                                                             | yes                                                                             | no (ancestry is a total order)                  |
| precedence              | self > closer ancestor > **earlier** array element              | longer scope-path **string**; tie → typed beats untyped, then later declaration | nearer file wins                                |
| merge unit              | per key, **first writer wins**                                  | per key, deep; higher-precedence value persists                                 | per key, deep; arrays **concatenate**           |
| relax / clear inherited | undocumented; source suggests any present key suffices          | no delete; nil merges as a value                                                | **yes** — `override:` prefix                    |
| required/optional       | not expressible                                                 | not expressible                                                                 | only via `eleventyDataSchema`                   |
| negative assertion      | **no**                                                          | **no**                                                                          | **yes**, but only as JS                         |
| data or code            | data                                                            | data                                                                            | JSON data, or JS code (schemas are code-only)   |

### Defaults vs constraints

All three are **default-setters**. Hugo and Jekyll cannot express a single negative assertion
anywhere; the closest thing in the survey is Hugo's global reserved-name list
(`front-matter.md:39`), a fixed language rule no config author can write. Eleventy's
`eleventyDataSchema` is the sole exception and escapes to arbitrary JavaScript to get there.
Three consequences:

1. **A default-setter never needs an error message, so none of these designed
   one.** Jekyll's only diagnostic quotes the _config_ set, not the offending
   page (`frontmatter_defaults.rb:46`). Eleventy's names the input path and the
   config key that supplied the schema and nests the user's error as `cause`
   (`TemplateMap.js:365-368`) — the only violation report in the family, and
   worth copying: locate the file, name the rule that fired, preserve the
   underlying message.
2. **First-writer-wins is wrong for constraints.** Hugo's rule is correct for
   defaults (nearest author knows best) and inverts badly for constraints: under
   it a leaf rule could never _tighten_ what a root rule set. The harness's
   ordered cascade merging at the leaf, deepest last, is the Jekyll `all()` shape
   (`frontmatter_defaults.rb:78-90`), not the Hugo shape.
3. **Relaxation exists as a primitive only where inheritance is a total order.**
   Eleventy affords `override:` precisely because there is one ancestor chain and
   no ambiguity about what is being overridden. Hugo and Jekyll permit arbitrary
   overlapping selectors and offer no clearing mechanism at all. Keeping
   overlapping globs _and_ wanting relaxation is something none of the three
   does — the closest precedent stays `.gitattributes`' `-attr` (see
   `docs/research/pathrule-precedence.md`), not this family.

### Could an agent read the config cold and author correct frontmatter?

|                   | verdict                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Hugo cascade      | **Partly.** The agent learns which keys exist and their inherited values, nothing about required-ness, types, or allowed values. Determining what applies to `content/docs/x.md` means resolving glob-matched page matchers across every ancestor `_index.md` plus site config in first-wins order — not readable from any one file. |
| Jekyll `defaults` | **Partly, and one file suffices** — `_config.yml` holds the whole rule set. But "which default wins" is unguessable from the docs: an agent reasoning by path depth rather than path **string length** gets it wrong, and prefix-not-segment matching means it cannot reliably tell which rules even apply.                          |
| Eleventy          | **No for values, potentially yes for constraints.** Values scatter across N directory data files with no index. But a zod `eleventyDataSchema` is genuinely self-teaching — types, required-ness and forbidden fields in one readable place. It is also executable code, which the harness has ruled out.                            |

**Jekyll has the right file shape, Eleventy has the right vocabulary, neither has
both.** `okf-config.yml` wants Jekyll's single declarative YAML rule list carrying Eleventy's
schema expressiveness — a combination that does not exist in this family, so there is no
precedent to copy wholesale and none that contradicts the design either. Two concrete cautions:

- **Do not define specificity by string length.** Jekyll's `has_precedence?`
  (`frontmatter_defaults.rb:185-186`) is the cautionary tale: docs promise "a more
  specific path", code delivers `String#length`. A declared-order cascade an agent
  can read top-to-bottom is strictly more legible than any specificity metric in
  this survey.
- **Match on path segments, not prefixes.** `path_is_subpath?` is
  `path.start_with?(parent_path)` (`frontmatter_defaults.rb:136-138`), so
  `docs/log` silently captures `docs/logging/`. Any harness matcher must be
  segment-aware.
