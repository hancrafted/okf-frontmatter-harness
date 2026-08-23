# Path-Rule Precedence: How Established Tools Resolve Overlapping Path Rules

Research question: when a YAML config declares a list of rules that select markdown files
by path glob and carry constraints (`description: {required: true, minLength: 40}`), and
**several rules match the same file**, how should they combine? Specifically: may a
later/deeper rule **relax** a constraint an earlier/shallower rule imposed?

Two candidate models:

- **Specificity-based** — deeper/more specific path wins, regardless of declaration order.
- **Ordered cascade** — all matching rules merge in declaration order; later wins.

All evidence below is from primary sources (official specs, vendor docs, upstream source
code, maintainer statements). Every claim is quoted. Where a fact could not be established
from a primary source, this document says so explicitly.

---

## 1. Summary matrix

| System                      | Precedence rule                                          | Merge or replace?                                      | Specificity or order?                     | Can a later rule relax?                                  | Maintainer-acknowledged pain                                                        |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `.gitignore`                | Last matching pattern within a precedence level          | Single boolean decision — replace                      | **Order**                                 | **Yes** — `!` negation is first-class                    | Yes: cannot re-include under an excluded directory                                  |
| GitHub CODEOWNERS           | Last matching pattern                                    | **Replace** (whole owner list)                         | **Order**                                 | N/A (no constraints, just owners)                        | Implicit: the rule is shipped as a comment in the template                          |
| GitLab CODEOWNERS           | Last matching entry, **per section**                     | Replace within section; union across sections          | **Order**                                 | Partly — exclusions are one-way                          | Yes: "After a pattern is excluded, it cannot be included again in the same section" |
| `.gitattributes`            | Later line overrides earlier, **per attribute**          | **Merge per key**                                      | **Order** (plus file-level precedence)    | **Yes** — `-attr` unsets, `!attr` reverts to Unspecified | None documented                                                                     |
| EditorConfig                | Later section wins; closer file wins                     | **Merge per key-value pair**                           | **Order** + directory distance            | **Yes** — `unset`                                        | None documented                                                                     |
| ESLint flat config          | Last matching config object wins on conflict             | **Merge per key**                                      | **Order**                                 | **Yes** — severity can be set to `off`                   | Yes, extensively (about the _old_ system)                                           |
| ESLint eslintrc `overrides` | Last override block has highest precedence               | Merge                                                  | **Order**                                 | Yes                                                      | Yes: "It's confusing even to us."                                                   |
| Prettier `overrides`        | All matching overrides applied in array order            | **Merge per key** (`Object.assign`)                    | **Order**                                 | Yes                                                      | Undocumented behaviour — see §2.7                                                   |
| Renovate `packageRules`     | All rules evaluated serially; last match wins per option | **Merge per key**; some options append                 | **Order**                                 | Yes                                                      | —                                                                                   |
| `tsconfig.json` `extends`   | Latter entry wins                                        | Merge per key; `files`/`include`/`exclude` **replace** | **Order**                                 | Yes                                                      | —                                                                                   |
| `.npmrc`                    | Fixed source precedence                                  | Merge per key                                          | Fixed hierarchy                           | Yes                                                      | —                                                                                   |
| CSS cascade                 | Specificity, **then** order of appearance                | Merge per property                                     | **Specificity, order as tie-break**       | Yes                                                      | Yes: `!important`, `:where()`, cascade layers all exist to escape it                |
| nginx `location`            | Longest prefix; regexes in file order                    | **Replace** (one location wins)                        | Hybrid, **class-ranked**                  | N/A                                                      | —                                                                                   |
| Apache `<Directory>` etc.   | Fixed group order; `<Directory>` shortest-to-longest     | Merge                                                  | **Depth for literals, order for regexes** | Yes                                                      | Yes: "order of merging is important, so be careful!"                                |
| Kubernetes Ingress          | Longest matching path                                    | Replace                                                | **Specificity** (literal paths only)      | N/A                                                      | —                                                                                   |
| Traefik router              | Priority = **length of the rule string**                 | Replace                                                | Specificity-by-length                     | N/A                                                      | **Yes** — documented counterintuitive failure, fix is manual priority               |
| AWS IAM                     | Explicit deny > explicit allow > default deny            | Union / intersection, order-independent                | **Neither**                               | **No, by design**                                        | —                                                                                   |
| OPA Gatekeeper              | All constraints independently enforced                   | Conjunctive                                            | **Neither**                               | **No**                                                   | —                                                                                   |
| Kyverno                     | All policies apply; `match` AND `exclude`                | Conjunctive                                            | **Neither**                               | **No** — needs a separate `PolicyException` object       | Yes: exclusions "must occur in the same rule definition. This may be limiting"      |

**Headline finding:** every widely-adopted _file-scoped configuration_ system in this
survey resolves overlaps by **declaration order with per-key merge**, and every one of them
**permits relaxation**. The systems that forbid relaxation (IAM, OPA, Kyverno) are security
policy engines that abandon ordering entirely in favour of a monotone deny-overrides
lattice. No surveyed file-config system computes specificity over globs.

---

## 2. Evidence by system

### 2.1 `.gitignore` — last matching pattern wins, negation is first-class

Source: [gitignore(5)](https://git-scm.com/docs/gitignore)

**(1) The precedence rule, verbatim:**

> Each line in a `gitignore` file specifies a pattern. When deciding whether to ignore a
> path, Git normally checks `gitignore` patterns from multiple sources, with the following
> order of precedence, from highest to lowest (**within one level of precedence, the last
> matching pattern decides the outcome**):
>
> - Patterns read from the command line for those commands that support them.
> - Patterns read from a `.gitignore` file in the same directory as the path, or in any
>   parent directory (up to the top-level of the working tree), **with patterns in the
>   higher level files being overridden by those in lower level files down to the directory
>   containing the file.**
> - Patterns read from `$GIT_COMMON_DIR/info/exclude`.
> - Patterns read from the file specified by the configuration variable `core.excludesFile`.

Note the two-tier design: **across sources**, a fixed hierarchy (including "deeper file
overrides shallower file"); **within a source**, pure textual order.

**(2) Merge or replace:** neither, strictly — a gitignore decision is a single boolean, so
the last match simply _is_ the answer. There is no per-key merge because there are no keys.

**(3) Specificity or order:** order. Nothing in the spec compares pattern specificity.
`*.log` declared after `logs/important.log` wins over it.

**(4) Can a later rule relax?** Yes — this is the whole point of `!`:

> An optional prefix "`!`" which negates the pattern; any matching file excluded by a
> previous pattern will become included again.

**(5) Documented pain — the canonical one:**

> **It is not possible to re-include a file if a parent directory of that file is excluded.**
> Git doesn't list excluded directories for performance reasons, so any patterns on
> contained files have no effect, no matter where they are defined.

The docs ship the workaround as an example:

```
# exclude everything except directory foo/bar
/*
!/foo
/foo/*
!/foo/bar
```

> note the `/*` - without the slash, the wildcard would also exclude everything within `foo/bar`

**Relevance:** this pain is _not_ a pain of ordered cascade as such. It is a pain of
**pruning** — Git stops descending, so a later rule never gets a chance to fire. A
frontmatter harness that always walks every file has no equivalent problem, because
evaluation is not short-circuited by an earlier decision.

---

### 2.2 GitHub CODEOWNERS — last match wins, and it replaces

Source: [About code owners — GitHub Docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)

**(1) The precedence rule.** GitHub states it as a comment inside the example file itself:

> Order is important; the last matching pattern takes the most precedence.

**(2) Replace, not merge.** Only the owners on the last matching line are assigned; earlier
matches do not accumulate. The docs illustrate this with the `*` default-owner line: a
later `*.js @js-owner` line means that for a PR touching only JS files, only the JS owner
is requested — the global owners are not.

Two additional "replace" behaviours worth noting:

> To match two or more code owners with the same pattern, all the code owners must be on
> the same line.

— otherwise "the pattern matches only the last mentioned code owner".

**(3) Order, definitively — not specificity.** This is the single most-cited case of a
last-match-wins system being mistaken for a most-specific-wins system. It is worth noting
_why_ the confusion is so persistent: CODEOWNERS files are conventionally written
broad-to-narrow, so last-match and most-specific usually agree, and they only diverge in
the cases people get wrong.

**(4) Relax?** Yes, in the only sense available: assigning **no** owner.

> `/apps/github` — changes to apps/github can be made with the approval of any user who has
> write access

An empty owner list on a later, deeper line removes the ownership requirement that an
earlier, broader line imposed. **This is precisely the "deeper rule relaxes shallower rule"
shape, and GitHub implements it with ordering, not specificity.**

**(5) Documented gotchas:**

> CODEOWNERS uses a pattern that follows most of the same rules used in gitignore files.

— but with three exclusions, the first of which matters here:

> Using `!` to negate a pattern doesn't work.

Also:

> Using `[ ]` to define a character range doesn't work.
>
> If any line in your CODEOWNERS file contains invalid syntax, that line will be skipped.

That last one is a real hazard _specific to order-based systems_: a silently skipped line
changes which line is "last", so a syntax error can silently reassign ownership.

Two further notes: `docs/*` matches `docs/getting-started.md` but **not**
`docs/build-app/troubleshooting.md`; and "CODEOWNERS paths are case sensitive, because
GitHub uses a case sensitive file system."

---

### 2.3 GitLab CODEOWNERS — same rule, plus per-section partitioning

Source: [GitLab CODEOWNERS reference](https://docs.gitlab.com/user/project/codeowners/reference/)

GitLab reimplemented the same feature and reached the same conclusion:

> Rules defined later in the file take precedence over earlier rules.
>
> If an entry is duplicated in a section, the last entry is used.

The interesting addition is **sections**, which partition the rule list into independent
namespaces so that "last wins" applies _within_ a namespace and results are then unioned:

> Each section enforces its rules separately.
>
> When a file path matches multiple entries in a section, only the last matching entry in
> that section is used.
>
> When a file path matches entries in multiple sections, the last matching entry in each
> section is used.

Unsectioned rules behave "as if they were another, unnamed section". And:

> entries in sections don't override entries without sections

**Documented gotchas:**

> Exclusions are evaluated in order in their section.
>
> After a pattern is excluded, it cannot be included again in the same section.

With inline comments in their own example reading: "This won't take effect as `*.rb` is
already excluded." Also, on relative paths: "be cautious of unintended matches" — a bare
`README.md` matches at any depth.

**Relevance:** GitLab's section mechanism is the direct precedent for a design where
_different constraint families_ are resolved independently rather than as one flat winner.
If a harness ever needs "path rules" and "type rules" to both contribute, GitLab's answer
was to make them separate ordered lists whose results union — not to build a cross-family
specificity ranking.

---

### 2.4 `.gitattributes` — the closest structural analogue to the harness problem

Source: [gitattributes(5)](https://git-scm.com/docs/gitattributes)

This is the most directly transferable precedent in the entire survey: unlike
`.gitignore`, gitattributes attaches a **bag of typed key/value settings** to a path — which
is exactly what a frontmatter rule does.

**(1)+(2) The precedence rule and the merge granularity, verbatim:**

> When more than one pattern matches the path, a later line overrides an earlier line.
> **This overriding is done per attribute.**

That second sentence is the load-bearing one. Merge is **per key**, not per rule: a later
line that sets only `text` does not clobber a `diff` set by an earlier line.

File-level precedence is a fixed hierarchy, and it is **shallowest-loses**:

> When deciding what attributes are assigned to a path, Git consults `$GIT_DIR/info/attributes`
> file (which has the highest precedence), `.gitattributes` file in the same directory as
> the path in question, and its parent directories up to the toplevel of the work tree (the
> further the directory that contains `.gitattributes` is from the path in question, the
> lower its precedence). Finally global and system-wide files are considered (they have the
> lowest precedence).

**(4) Can a later rule relax?** Yes, and Git designed **three** distinct ways to say so.
There are four attribute states:

> **Set** — The path has the attribute with special value "true" […]
> **Unset** — The path has the attribute with special value "false"; this is specified by
> listing the name of the attribute prefixed with a dash `-` […]
> **Set to a value** — […] listing the name of the attribute followed by an equal sign `=`
> and its value […]
> **Unspecified** — No pattern matches the path, and nothing says if the path has or does
> not have the attribute […]

and an explicit token to return to the third state:

> Sometimes you would need to override a setting of an attribute for a path to `Unspecified`
> state. This can be done by listing the name of the attribute prefixed with an exclamation
> point `!`.

**The worked example from the spec** is worth reproducing because it demonstrates per-key
override across three files:

```
(in $GIT_DIR/info/attributes)
a*	foo !bar -baz

(in .gitattributes)
abc	foo bar baz

(in t/.gitattributes)
ab*	merge=filfre
abc	-foo -bar
*.c	frotz
```

resolving `t/abc` to:

```
foo	set to true
bar	unspecified
baz	set to false
merge	set to string value "filfre"
frotz	unspecified
```

**(5) Pain:** none acknowledged in the docs. This is a ~15-year-old, heavily-used design
with no documented precedence gotchas — a notable data point in favour of the model.

**Design lesson for the harness:** Git distinguishes **"explicitly false"** (`-attr`) from
**"say nothing about it"** (`!attr`). For a frontmatter rule this maps to
`required: false` (positively assert it is optional) versus `required: null` / removing the
key (defer to whatever an earlier rule said). If the harness only offers the former, the
latter becomes unexpressible.

---

### 2.5 EditorConfig — normative "later wins", plus an explicit `unset` keyword

Source: [EditorConfig Specification](https://spec.editorconfig.org/)

**(1) The precedence rule.** The spec states it as a single normative sentence:

> Files are read top to bottom and **the most recent pairs found take precedence**.

Expanded in both dimensions — within a file:

> the pairs defined in the section that comes later in the `.editorconfig` file take
> precedence over pairs defined in the section that comes earlier in the same
> `.editorconfig` file

and across files:

> the pairs from the closer EditorConfig file are read last, so pairs in closer files take
> precedence

The search terminates at `root`:

> The search shall stop if an EditorConfig file is found with the `root` key set to `true`
> in the preamble or when reaching the root filesystem directory.

**(2) Merge, per key-value pair.** The spec is deliberate about granularity: precedence
applies to individual **pairs** that are "read last". Nothing states that a matching section
discards prior settings wholesale. A key set by a distant/earlier section survives unless a
closer/later pair redefines that same key.

**(3) Order.** Two orthogonal orderings (textual position within a file; directory distance
between files), each fully ordered, composed by "read the lower-precedence one first". No
glob specificity is computed anywhere.

Note that EditorConfig's **file** dimension _is_ depth-based — closer wins. But this is
depth of the _config file's own location_, a well-defined integer, not depth of a glob
pattern. That distinction matters (see §3).

**(4) Can a later rule relax?** Yes, and there is a dedicated keyword for the strong form:

> a value of `unset` removes the effect of that pair, even if it has been set before

The illustration given is `indent_size = unset`, which reverts to editor defaults.

**(5) Pain:** none documented in the spec.

---

### 2.6 ESLint flat config — order, explicitly, with the old cascade removed for cause

Source: [Configuration Files](https://eslint.org/docs/latest/use/configure/configuration-files),
[eslintrc (v8)](https://eslint.org/docs/v8.x/use/configure/configuration-files),
[Part 1](https://eslint.org/blog/2022/08/new-config-system-part-1/) and
[Part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/) of Nicholas C. Zakas's
config-system posts.

**(1)+(2) The precedence rule and merge semantics, verbatim from the docs:**

> When more than one configuration object matches a given filename, the configuration
> objects are merged with later objects overriding previous objects when there is a conflict.

Merge is genuine, not replacement:

> both configuration objects are applied, so `languageOptions.globals` are merged to create
> a final result

Zakas states the same rule twice in Part 2:

> ESLint finds all config objects that match the file being linted and merges them together
> in much the same way that eslintrc did.
>
> The only real difference is the merge happens from the top of the array down to the bottom
> instead of using files in a directory structure.
>
> **The last matching config always wins when there is a conflict.**

**(3) Order — and the docs contain no concept of specificity at all.** Array position is
the entire resolution mechanism.

**(4) Can a later rule relax?** Yes; the docs list this as a _primary intended use_:

> **For rule severity adjustment** — When you want to change rule severity
> (`error`/`warn`/`off`) for specific file patterns.

Setting a rule to `off` in a later object for a narrower glob is exactly the
"deeper rule relaxes shallower rule" shape, and it is the sanctioned pattern.

**(5) Maintainer-acknowledged pain.** This is the richest source in the survey, because
ESLint publicly post-mortemed a _directory-cascade + overrides_ system and replaced it with
a flat ordered array. From Part 1:

> Over the years, however, the config system grew into an unwieldy mess.
>
> As time went on, the config cascade continued to cause problems for users.
>
> **No one really understood all of the different permutations around calculating the final
> config for any given file.**
>
> the team was collectively becoming afraid of touching anything to do with the config system.

and, on `extends` nested inside `overrides` — i.e. exactly the compositional complexity that
a specificity/recursion model invites:

> **If you're not sure what exactly that means, you're not alone. It's confusing even to us.**

From Part 2:

> the `overrides` key in eslintrc was the source of a lot of complexity
>
> we wanted to get rid of the directory-based config cascade
>
> Because we wanted to eliminate the config cascade of eslintrc, we had to use glob patterns
> to enable the same type of config overrides.
>
> We used the `overrides` configs as the basis for flat config.

Critically, they did **not** conclude "ordering was the problem". They kept ordering and
kept `overrides` semantics; what they removed was the _implicit, filesystem-derived,
non-local_ part of the cascade:

> flat config actually still has a flat cascade defined directly in your `eslint.config.js` file

**Legacy eslintrc `overrides`, for completeness** (from the v8 docs, which spell out the
ordering rule more bluntly than the flat-config docs do):

> Glob pattern overrides have higher precedence than the regular configuration in the same
> config file.
>
> **Multiple overrides within the same config are applied in order. That is, the last
> override block in a config file always has the highest precedence.**
>
> Nested `overrides` settings are applied only if the glob patterns of both the parent
> config and the child config are matched.

**Flat config's own gotchas**, all of which are worth copying as harness design notes:

> Configuration objects without `files` or `ignores` are automatically applied to any file
> that is matched by any other configuration object.
>
> When `ignores` is used without any other keys (besides `name`) in the configuration object,
> then the patterns act as global ignores. […] This means they apply to every configuration
> object (not only to the configuration object in which it is defined).
>
> Non-global `ignores` patterns can only match file names. A pattern like
> `"dir-to-exclude/"` will not ignore anything.
>
> In general, it's a good idea to always include `files` if you are specifying `ignores`.

That third and fourth quotes are ESLint admitting a real footgun: the _meaning of a key
changes depending on which sibling keys are present_. A harness should avoid any selector
whose semantics flip based on the presence of another field.

---

### 2.7 Prettier `overrides` — undocumented, but the source says accumulate-in-order

Source: docs [Configuration File](https://prettier.io/docs/configuration); implementation
`src/config/resolve-config.js` in [prettier/prettier](https://github.com/prettier/prettier).

**The docs are silent on the question.** The only prose is:

> Overrides let you have different configuration for certain file extensions, folders and
> specific files.
>
> `files` is required for each override, and may be a string or array of strings.
> `excludeFiles` may be optionally provided to exclude files for a given rule […]

There is no "last one wins", no "applied in order", and no statement about conflicting
overrides anywhere on the page. **This is itself a finding: even a very popular tool can
ship this feature without ever documenting the conflict rule** — which strongly suggests the
harness should document its rule explicitly, whichever model it picks.

**The source settles it.** `mergeOverrides` destructures the base options out, then:

```js
const { overrides, ...options } = config || {};
for (const override of overrides) {
  // …if the file matches override.files (and not override.excludeFiles):
  Object.assign(options, override.options);
}
```

There is no `break` or early `return` in the loop. Therefore: **every** matching override is
applied; they accumulate; on a key collision the later array entry wins; keys set only by an
earlier override survive. That is an ordered cascade with per-key merge — the same model as
`.gitattributes`, EditorConfig and ESLint, arrived at independently.

---

### 2.8 Renovate `packageRules` — the best precedent for _multi-dimensional_ selectors

Source: maintainer `secustor` in
[renovatebot/renovate discussion #24163](https://github.com/renovatebot/renovate/discussions/24163)
(answered 2023-08-30), plus [Configuration Options](https://docs.renovatebot.com/configuration-options/).

Renovate is the closest match to the harness's _second selector dimension_ problem, because
a `packageRule` can filter on several **orthogonal** axes at once — `matchFileNames` (a path
glob), `matchPackageNames`, `matchDepTypes`, `matchUpdateTypes`, `matchCurrentVersion`, and
more. Selectors within one rule are ANDed; the question is how _rules_ rank against each
other.

The maintainer's answer, verbatim:

> All PackageRules are getting individually, serially and in the order in which they are
> defined evaluated.
>
> If multiple rules match and set the same config option e.g. `groupName` the last one wins

So: **no cross-dimension specificity ranking exists.** A rule that pins one package by exact
name does not outrank a rule that matches a whole directory glob. Position in the array is
the only tiebreak. Renovate solved the exact "two orthogonal selectors" problem the harness
faces, and chose ordered cascade.

Renovate also demonstrates the **per-option merge-vs-replace** distinction. From the docs,
on mergeable options:

> values inside it will be added to any existing object or array that existed with the same name

and the worked contrast: `labels` is non-mergeable, so a later matching rule replaces the
list wholesale, whereas `addLabels` is the mergeable, append-style companion option. The
schema declares per-option which behaviour applies rather than picking one globally.

**Caveat on sourcing:** the `packageRules` section of the published `configuration-options`
page could not be retrieved (the page is long enough that fetches truncate before reaching
it). The precedence rule above is quoted from the maintainer's answer, not from the manual.
Widely-circulated guidance ("order your `packageRules` in ascending order of importance") is
consistent with it but **was not verified verbatim against the docs** for this report.

---

### 2.9 `tsconfig.json` `extends` and `.npmrc` — fixed hierarchy, latter wins

[TSConfig `extends`](https://www.typescriptlang.org/tsconfig/):

> The configuration from the base file are loaded first, then overridden by those in the
> inheriting config file.
>
> It's worth noting that `files`, `include`, and `exclude` from the inheriting config file
> _overwrite_ those from the base config file, and that circularity between configuration
> files is not allowed.

With multiple bases ([TypeScript 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)):

> Writing this is kind of like extending `c` directly, where `c` extends `b`, and `b`
> extends `a`. **If any fields "conflict", the latter entry wins.**

Two things to steal here. First, TypeScript **flattens** a multi-base list into a linear
chain rather than defining a partial order — the same trick that avoids recursion. Second,
it carves out **replace, not merge** for exactly the three _selector_ arrays
(`files`/`include`/`exclude`), while merging everything else. That is a principled split: the
"what does this apply to" fields replace; the "what settings apply" fields merge.

[npmrc](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc) is the plain fixed-hierarchy
case:

> Each of these files is loaded, and config options are resolved in priority order.

with project → user → global → npm-builtin, highest to lowest. All are loaded; merge is per
key; the more local file wins. Relaxation is unremarkable.

---

## 3. Is "most specific wins" even well-defined for globs?

**Finding: no widely-adopted system defines a specificity ordering over glob patterns.
The systems that rank by "specificity" rank only over _literal path prefixes_, and they
explicitly exclude patterns from that ranking.**

This is the most decisive evidence in the report, and it comes from the two systems most
often cited as "most specific wins".

### 3.1 nginx: literal prefixes get longest-match; regexes get declaration order

Source: [ngx_http_core_module — location](https://nginx.org/en/docs/http/ngx_http_core_module.html#location)

> A location can either be defined by a prefix string, or by a regular expression. […] To
> find location matching a given request, nginx first checks locations defined using the
> prefix strings (prefix locations). **Among them, the location with the longest matching
> prefix is selected and remembered. Then regular expressions are checked, in the order of
> their appearance in the configuration file.** The search of regular expressions terminates
> on the first match, and the corresponding configuration is used. If no match with a
> regular expression is found then the configuration of the prefix location remembered
> earlier is used.

nginx does **not** compute specificity across the two kinds. It assigns the _kinds_
themselves a fixed rank (regex beats prefix), uses longest-match only where "longest" is
meaningful (literal prefixes), and falls back to file order where it is not (regexes). The
two manual overrides exist precisely because even this is not always right:

> If the longest matching prefix location has the "`^~`" modifier then regular expressions
> are not checked.
>
> Also, using the "`=`" modifier it is possible to define an exact match of URI and location.
> If an exact match is found, the search terminates.

Also note nginx **replaces** rather than merges among siblings: exactly one location wins.

### 3.2 Apache: `<Directory>` sorted by depth — _except regular expressions_

Source: [Configuration Sections — How the sections are merged](https://httpd.apache.org/docs/2.4/sections.html)

Apache is the strongest "depth wins" precedent in the survey, and it is instructive exactly
because of what it carves out.

> The configuration sections are applied in a very particular order. Since this can have
> important effects on how configuration directives are interpreted, it is important to
> understand how this works.
>
> The order of merging is:
>
> 1. `<Directory>` (**except regular expressions**) and `.htaccess` done simultaneously […]
> 2. `<DirectoryMatch>` (and `<Directory "~">`)
> 3. `<Files>` and `<FilesMatch>` done simultaneously
> 4. `<Location>` and `<LocationMatch>` done simultaneously
> 5. `<If>` sections […]

and:

> `<Directory>` (group 1 above) is processed in the order **shortest directory component to
> longest** (regardless of the order in which they appear in the configuration file). For
> example, `<Directory "/var/web/dir">` will be processed before `<Directory "/var/web/dir/subdir">`.
>
> **Apart from `<Directory>`, within each group the sections are processed in the order they
> appear in the configuration files.**

So Apache applies depth-ordering to **literal directory paths only**. The moment a pattern
is involved (`<DirectoryMatch>`, `<Directory "~">`), it drops to a _separate group_ resolved
by **declaration order**. Apache had every incentive to define specificity for patterns and
did not.

Apache also merges (later group overrides earlier) rather than replacing, and — importantly
— the docs concede the model is a hazard:

> Regardless of any access restrictions placed in `<Directory>` sections, the `<Location>`
> section will be evaluated last and will allow unrestricted access to the server. In other
> words, **order of merging is important, so be careful!**

That warning is about a **fixed selector-class ranking** producing a surprise, not about
declaration order. It is the failure mode of the specificity-style model.

### 3.3 Kubernetes Ingress: longest match — over literal paths only

Source: [Ingress API — HTTPIngressPath](https://kubernetes.io/docs/reference/kubernetes-api/service-resources/ingress-v1/)

> If multiple matching paths exist in an Ingress spec, the longest matching path is given
> priority.
>
> `/foo` and `/foo/` both match requests to `/foo` and `/foo/`. If both paths are present in
> an Ingress spec, the longest matching path (`/foo/`) is given priority.

Note the path types available: `Exact`, `Prefix`, and `ImplementationSpecific`. There is no
glob type. And where matching _is_ pattern-like, the API punts entirely:

> `ImplementationSpecific`: Interpretation of the Path matching is up to the IngressClass.

Kubernetes chose to make specificity well-defined by **restricting the selector language**
rather than by defining an ordering over an expressive one.

### 3.4 Traefik: the documented failure of length-as-specificity

Source: [HTTP Routers — Rules and Priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/)

Traefik is the one surveyed system that _does_ apply a specificity heuristic to
pattern-bearing rules — and its own docs demonstrate it going wrong:

> To avoid path overlap, routes are sorted, by default, in descending order using rules
> length.
>
> The priority is directly equal to the length of the rule, and so the longest length has
> the highest priority.

The docs' worked example contrasts ``HostRegexp(`[a-z]+\.traefik\.com`)`` (length 34) with
``Host(`foobar.traefik.com`)`` (length 26):

> The previous table shows that `Router-1` has a higher priority than `Router-2`.

That is: **a broad regexp outranks an exact host match, because its string is longer.** The
documented remedy is to abandon the heuristic:

> To solve this issue, the priority must be set.

with manual integers. Supporting details: "A value of `0` for the priority is ignored"
(falls back to length sorting), "Negative priority values are supported", and cross-provider
ties are broken by a `providers.precedence` setting.

**This is the empirical answer to "is `docs/**/*.md` more specific than `**/*.md`?"** Any
syntactic proxy for specificity — length, segment count, wildcard count — is a heuristic
that will invert on some real input, and the escape hatch you are then forced to add is an
explicit ordering. You end up implementing both models and shipping the confusion of each.

### 3.5 CSS: the only rigorous specificity system — and it still needs order, plus escapes

Sources: [Selectors Level 3 §9](https://www.w3.org/TR/selectors-3/#specificity),
[CSS Cascading and Inheritance Level 4 — Cascade Sorting Order](https://drafts.csswg.org/css-cascade/#cascade-sort),
[CSS Cascade Level 5 — Layering](https://drafts.csswg.org/css-cascade-5/#layering).

Specificity is a **lexicographically-ordered tuple with hand-assigned weights per selector
kind** — not anything derived from the selector's structure:

- _a_ = count of ID selectors
- _b_ = count of class selectors, attribute selectors, and pseudo-classes
- _c_ = count of type selectors and pseudo-elements
- the universal selector is ignored

> Concatenating the three numbers a-b-c (in a number system with a large base) gives the
> specificity.

Two things follow directly.

**First, specificity is only a preorder, so CSS still needs declaration order.** The cascade
sorts on four criteria in sequence — Origin and Importance, Context, Specificity, Order of
Appearance — and the last is:

> The declaration with the highest specificity wins.
>
> **The last declaration in document order wins.**

Even the canonical specificity system cannot avoid an order-based tiebreak. **Any
specificity model for the harness must also define declaration order semantics** — so
"specificity avoids the need to reason about order" is false.

**Second, CSS has accreted three separate escape hatches** because authors could not control
the outcome: `!important` (folded into the Origin/Importance step), `:where()`, which per
Selectors 4 "contributes no specificity", and cascade layers, added in Level 5 so that
authors can reorder concerns

> without altering selectors or specificity within each layer, or relying on order of
> appearance to resolve conflicts across layers

with the framing that "cascade layers provide a structured way to organize and balance
concerns within a single origin." A specificity system that needed to grow three escape
hatches over twenty-five years is weak evidence for adopting one in a small YAML config.

---

## 4. The second selector dimension (path **and** frontmatter `type`)

Question: does any system combine two orthogonal selectors, and how does it rank them?

**Finding: yes, several do — and none of them computes a cross-dimension specificity.**
There are exactly two strategies in the wild.

**Strategy A — fixed rank per selector _class_, then order within class.**

- **nginx**: exact (`=`) > prefix-with-`^~` > regex-in-file-order > longest-prefix. The
  ranking of _kinds_ is hardcoded in the manual; nothing is computed.
- **Apache**: five hardcoded groups (`<Directory>` → `<DirectoryMatch>` → `<Files>` →
  `<Location>` → `<If>`), depth-sorted only inside group 1, declaration order everywhere
  else. Merged in that fixed sequence, later groups overriding earlier ones.
- **CSS**: the a/b/c weights are exactly this — ID class outranks attribute/class/pseudo
  class outranks type class — assigned by fiat in the spec.

The cost of Strategy A is that the ranking is arbitrary and must be memorised. Apache's own
"order of merging is important, so be careful!" and its `<Location>`-silently-defeats-
`<Directory>` example are the documented consequence.

**Strategy B — AND the selectors within a rule; rank rules by declaration order.**

- **Renovate**: `matchFileNames` (path glob) AND `matchPackageNames` AND `matchUpdateTypes`
  AND `matchDepTypes` within one rule; across rules, "in the order in which they are
  defined", last-wins-per-option.
- **Kyverno**: "the `match` and `exclude` conditions are evaluated using a logical **AND**
  operation", with "AND across types but an OR within list types" inside a block — e.g. a
  rule fires "if the request contains any one (OR) of the kinds AND any one (OR) of the
  namespaces". Rules within a policy are "applied in declaration order".
- **OPA Gatekeeper**: "if multiple matchers are specified, a resource must satisfy each
  top-level matcher (kinds, namespaces, etc.) to be in scope", and "All selection
  expressions are ANDed to determine if an object meets the cumulative requirements of the
  selector." (Note `kinds` is the OR exception: "If multiple groups/kinds objects are
  specified, only one match is needed for the resource to be in scope.")

**Renovate is the exact precedent for the harness's case** — a path selector and a
non-path categorical selector in the same rule object — and it resolves cross-rule conflicts
purely by array position.

**No surveyed system answers "is `{path: docs/**, type: adr}` more or less specific than
`{path: docs/logs/**}`?"** because no surveyed system asks the question. Under Strategy A
you would have to invent a weight for `type` versus a weight for path depth, and defend it;
under Strategy B the question does not arise.

---

## 5. Relaxation: which systems permit it, and how they gate it

There is a clean split in the evidence, and it tracks **what the config governs**, not what
is technically easier.

**File-scoped configuration systems all permit relaxation, and most provide an explicit
"revert" token:**

| System                                 | Relaxation mechanism                                                              |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `.gitignore`                           | `!pattern` re-includes                                                            |
| `.gitattributes`                       | `-attr` sets false; `!attr` reverts to Unspecified                                |
| EditorConfig                           | `key = unset` — "removes the effect of that pair, even if it has been set before" |
| ESLint                                 | later object sets severity `off` — a documented intended use                      |
| Prettier / Renovate / tsconfig / npmrc | later value simply overwrites                                                     |
| GitHub CODEOWNERS                      | a later, narrower line with an empty owner list                                   |

**Security policy engines forbid relaxation by construction, and abandon ordering to do it:**

AWS IAM ([policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)):

> If an action is allowed by an identity-based policy, a resource-based policy, or both,
> then AWS allows the action. **An explicit deny in either of these policies overrides the
> allow.**
>
> When AWS evaluates the identity-based policies and permissions boundary for a user, the
> resulting permissions are the **intersection** of the two categories.
>
> An explicit deny in the identity-based policy, an SCP, or an RCP overrides the allow.

There is no notion of "the last policy" or "the most specific policy" — the result is
order-independent by design, because order-dependence in a security decision is a
vulnerability. **OPA Gatekeeper** and **Kyverno** work the same way: every matching
constraint/policy is independently enforced, and nothing in either project's docs defines a
cross-policy precedence rule at all.

**Kyverno is the interesting middle case**, because it eventually _had_ to support
relaxation and refused to do it by ordering. It added a separate CRD
([Policy Exceptions](https://kyverno.io/docs/exceptions/)):

> a Namespaced Custom Resource which allows a resource(s) to be allowed past a given policy
> and rule combination

motivated explicitly by the limits of in-rule exclusion:

> the resources which they are intended to exclude must occur in the same rule definition.
> This may be limiting in situations where policies may not be directly editable.

and gated hard: "PolicyExceptions are disabled by default", their creation "can and should
be controlled by a number of different mechanisms to ensure their creation in a cluster is
authorized", and

> it is considered a best practice to only allow very narrow exceptions to a much broader rule.

**Lesson for the harness:** if the frontmatter rules are _editorial hygiene_, the
file-config precedent applies and relaxation should be ordinary. If any rule is ever
intended as a _guarantee_ (e.g. "every ADR must carry a status"), the IAM/OPA precedent says
that rule should live in a channel that no path rule can relax — a small monotone floor
alongside the cascade, not a rule inside it.

---

## 6. Implementation complexity

**Ordered cascade:**

```
result = {}
for rule in rules:            # declaration order
    if matches(rule.selectors, file):
        deep_merge(result, rule.constraints)   # per-leaf-key overwrite
```

One pass, no sorting, no recursion, no total order to define, no ties. This is literally
Prettier's `mergeOverrides` (`for … of` + `Object.assign`, no `break`) and, per its
maintainer, Renovate's evaluation loop. Debuggability is linear: "which rule set this?" is
answered by "the last one in the file that matched", and a `--explain` mode is trivial —
record `(key → index of rule that last wrote it)` during the same pass.

**Specificity-based** additionally requires: (a) a documented **total** order over glob
patterns, which §3 shows nobody has defined; (b) a weight for the second selector dimension
relative to path depth; (c) a stable sort; (d) a tiebreak rule anyway — CSS, the reference
implementation, needs "The last declaration in document order wins"; and (e) an escape
hatch for the cases the heuristic gets backwards, which Traefik's docs show arriving within
one worked example. The recursion the harness would be trying to avoid is not the main cost;
the specification burden is.

---

## 7. Recommendation

**Adopt the ordered cascade: all matching rules merge in declaration order, later wins,
merge granularity per leaf key.** The evidence is close to unanimous for a config of this
shape.

The three tools whose data model is closest to the harness's — a bag of typed settings
attached to files by glob — all independently chose exactly this: `.gitattributes` ("a later
line overrides an earlier line. This overriding is done per attribute"), EditorConfig ("the
most recent pairs found take precedence"), and ESLint flat config ("The last matching config
always wins when there is a conflict"). Prettier's implementation and Renovate's maintainer
confirm the same. `docs/` requiring a description while `docs/logs/` does not is expressed
by putting the `docs/logs/` rule later — the same shape as `docs/*.md` then `!docs/logs/*.md`
in gitignore, or a `docs/logs/**` block setting a rule to `off` in ESLint.

Concrete design points, each backed by a precedent above:

1. **Merge at the leaf, not the rule.** `docs/logs/**` setting `description.required: false`
   must not erase `description.minLength` set by `docs/**`. Precedent: gitattributes
   ("per attribute"), EditorConfig ("pairs"), ESLint (`languageOptions.globals` are merged).
2. **Selector fields replace; constraint fields merge.** Precedent: TypeScript — `files`,
   `include`, `exclude` "_overwrite_" while `compilerOptions` merge; Renovate declares
   mergeability per option in its schema.
3. **Provide an explicit "say nothing" value, distinct from "assert false".** Precedent:
   gitattributes' four states with `!attr`; EditorConfig's `unset`. Without it,
   "stop constraining `description` here" is unexpressible.
4. **Write the precedence rule into the config file itself, not only the manual.** GitHub
   ships "Order is important; the last matching pattern takes the most precedence." as a
   comment in the CODEOWNERS template — because the rule is the single most misunderstood
   thing about it. Prettier's silence on the same question is the counter-example not to
   follow.
5. **Add a `--explain <file>` output** listing, per resolved key, which rule index set it.
   ESLint's post-mortem names the absence of exactly this as the core failure: "No one
   really understood all of the different permutations around calculating the final config
   for any given file."
6. **Consider a small monotone floor** for constraints that must not be relaxable at all,
   evaluated outside the cascade (IAM's "explicit deny […] overrides the allow"). If
   relaxation ever needs auditing, follow Kyverno and make it a _named exception_ rather
   than an anonymous later rule.

### Failure modes, stated honestly

**Ordered cascade fails at:**

- **Action at a distance from a broad rule appended late.** Someone adds `**/*.md` at the
  bottom of the list and silently relaxes every earlier rule. Mitigation: a config lint that
  errors when a rule's glob is a strict superset of an earlier rule's glob (ESLint's
  "Configuration objects without `files` or `ignores` are automatically applied to any file
  that is matched by any other configuration object" is the same hazard, handled by
  convention rather than tooling).
- **Reordering changes semantics invisibly.** Rule-list reorderings in a diff are
  semantically meaningful but read as noise, and merge conflicts can reorder rules. Order is
  load-bearing state that review must protect.
- **Users assuming specificity.** CODEOWNERS is the standing proof that people expect
  most-specific-wins from a glob list. Broad-to-narrow authoring hides the divergence until
  it bites. Mitigation: points 4 and 5 above.
- **Silently skipped lines shift "last".** GitHub: "If any line in your CODEOWNERS file
  contains invalid syntax, that line will be skipped." Fail the whole config on a malformed
  rule rather than skipping it.

**Specificity fails at:**

- **The ordering is not well-defined.** `docs/**/*.md` vs `**/*.md` vs `docs/logs/*.md` has
  no answer any surveyed system supplies. Traefik's length heuristic is documented ranking a
  broad regexp above an exact host.
- **You need order anyway.** CSS's fourth sorting criterion is "The last declaration in
  document order wins." You would implement both models and inherit both sets of surprises.
- **Two selector dimensions force an arbitrary weight.** Is `type: adr` worth more than one
  path segment? Two? Any answer is indefensible, and Apache's fixed group order plus its own
  "order of merging is important, so be careful!" shows how that plays out.
- **Escape hatches accumulate.** CSS needed `!important`, then `:where()`, then cascade
  layers. Traefik needed a manual `priority` integer. nginx needed `^~` and `=`.
- **Non-local reasoning.** You cannot determine the effective config by reading top to
  bottom; you must evaluate every rule and sort. This is the precise complaint ESLint made
  about its own cascade: "the team was collectively becoming afraid of touching anything to
  do with the config system."

**Depth-based specificity is defensible in exactly one narrow form** — the form
EditorConfig, gitignore and Apache actually use — where "deeper" refers to the **literal
directory location of a config file or literal path prefix**, an unambiguous integer, and
never to the shape of a glob. If the harness ever supports per-directory config files,
closest-file-wins is well-precedented. Within a single rule _list_ in one file, it is not.

---

## 8. What could not be established

- **Renovate's published `packageRules` prose.** The `configuration-options` page is long
  enough that automated fetches truncate before reaching that section. The precedence rule
  in §2.8 is quoted from a maintainer's answer in a GitHub discussion, which is primary but
  not the manual. The often-repeated "order your `packageRules` in ascending order of
  importance" was not verified verbatim against the docs.
- **Prettier's intended `overrides` conflict semantics.** The behaviour in §2.7 is read off
  the current implementation. No design statement, RFC or documentation sentence confirming
  it is _intended_ rather than incidental was located.
- **Selectors Level 4 §15 specificity text verbatim.** The a/b/c definition in §3.5 is
  quoted from Selectors Level 3 §9 (a W3C Recommendation). The Level 4 draft's own wording,
  including the specificity of `:is()` / `:not()` / `:has()`, could not be retrieved; only
  the `:where()` characterisation ("contributes no specificity") was obtained.
- **A CSS WG statement acknowledging "specificity wars".** The css-cascade-5 Layering
  section frames layers positively ("a structured way to organize and balance concerns
  within a single origin") and never states that specificity was a problem. The motivational
  reading in §3.5 is inference from the feature's existence, not a quotation.
- **Any cross-policy precedence rule in OPA Gatekeeper or Kyverno.** Searched and not found;
  the absence appears to be deliberate (constraints are independently enforced), but no
  primary source was located that says so in those words.
- **Any widely-adopted system that ranks overlapping glob patterns by computed
  specificity.** None was found. Every "specificity" system located restricts the comparison
  to literal prefixes/paths (nginx, Apache, Kubernetes Ingress) or to a hand-assigned
  per-selector-kind weight (CSS), with the sole exception of Traefik's rule-string length,
  whose documented behaviour is the argument against it.

---

## Sources

- [gitignore(5)](https://git-scm.com/docs/gitignore) · [gitattributes(5)](https://git-scm.com/docs/gitattributes)
- [GitHub — About code owners](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
- [GitLab — Code Owners reference](https://docs.gitlab.com/user/project/codeowners/reference/)
- [EditorConfig Specification](https://spec.editorconfig.org/)
- [ESLint — Configuration Files (flat)](https://eslint.org/docs/latest/use/configure/configuration-files) · [ESLint v8 — eslintrc](https://eslint.org/docs/v8.x/use/configure/configuration-files)
- [ESLint blog — new config system, Part 1](https://eslint.org/blog/2022/08/new-config-system-part-1/) · [Part 2](https://eslint.org/blog/2022/08/new-config-system-part-2/)
- [Prettier — Configuration File](https://prettier.io/docs/configuration) · `src/config/resolve-config.js` in [prettier/prettier](https://github.com/prettier/prettier)
- [Renovate — Configuration Options](https://docs.renovatebot.com/configuration-options/) · [discussion #24163](https://github.com/renovatebot/renovate/discussions/24163)
- [TSConfig Reference — extends](https://www.typescriptlang.org/tsconfig/) · [TypeScript 5.0 release notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-0.html)
- [npm — npmrc](https://docs.npmjs.com/cli/v11/configuring-npm/npmrc)
- [Selectors Level 3 §9 — Calculating a selector's specificity](https://www.w3.org/TR/selectors-3/#specificity) · [Selectors Level 4](https://www.w3.org/TR/selectors-4/)
- [CSS Cascading and Inheritance Level 4 — Cascade Sorting Order](https://drafts.csswg.org/css-cascade/#cascade-sort) · [Level 5 — Layering](https://drafts.csswg.org/css-cascade-5/#layering)
- [nginx — ngx_http_core_module `location`](https://nginx.org/en/docs/http/ngx_http_core_module.html#location)
- [Apache httpd 2.4 — Configuration Sections](https://httpd.apache.org/docs/2.4/sections.html)
- [Kubernetes — Ingress API (HTTPIngressPath)](https://kubernetes.io/docs/reference/kubernetes-api/service-resources/ingress-v1/)
- [Traefik — HTTP Routers: Rules and Priority](https://doc.traefik.io/traefik/reference/routing-configuration/http/routing/rules-and-priority/)
- [AWS IAM — Policy evaluation logic](https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_evaluation-logic.html)
- [OPA Gatekeeper — How to use Gatekeeper](https://open-policy-agent.github.io/gatekeeper/website/docs/howto/)
- [Kyverno — Match/Exclude](https://kyverno.io/docs/policy-types/cluster-policy/match-exclude/) · [Policy Exceptions](https://kyverno.io/docs/exceptions/)
