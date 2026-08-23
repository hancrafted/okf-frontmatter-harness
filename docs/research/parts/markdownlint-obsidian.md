# markdownlint-cli2 and Obsidian Linter

Research slice for the OKF frontmatter governance harness. Both tools are surveyed
because both are what someone reaches for when asked "lint my markdown frontmatter",
and both answer a _different_ question than this harness asks. Every load-bearing
claim is quoted from upstream `README`/`doc` files or upstream source. Where a fact
could not be established from a primary source, it says so.

Versions pinned from upstream `package.json` at time of survey:
`markdownlint@0.41.1`, `markdownlint-cli2@0.23.2`. Obsidian Linter is unversioned
here — the plugin ships no meaningful version-to-doc pinning; source is `master`.

---

## 1. markdownlint / markdownlint-cli2

### 1.1 Does it validate frontmatter content at all?

**No. Essentially no — a decisive negative, not a gap in the survey.** Frontmatter is
_removed before parsing_ and handed to rules as an opaque array of raw strings.
Nothing in the library parses it as YAML.

`lib/markdownlint.mjs:123-134`:

```js
function removeFrontMatter(content, frontMatter) {
  let frontMatterLines = [];
  if (frontMatter) {
    const frontMatterMatch = content.match(frontMatter);
    if (frontMatterMatch && !frontMatterMatch.index) {
      const contentMatched = frontMatterMatch[0];
      content = content.slice(contentMatched.length);
      frontMatterLines = contentMatched.split(helpers.newLineRe);
```

The README frames it as an _ignore_ feature (`markdownlint/README.md`, "Configuration"):

> Text passed to `markdownlint` is parsed as Markdown, analyzed, and any issues
> reported. **Two kinds of text are ignored by most rules:** … Front matter (see
> `options.frontMatter` below)

`options.frontMatter` is only a `RegExp` for recognising the block to skip:

> Type: `RegExp`. Matches any front matter found at the beginning of a file. Some
> Markdown content begins with metadata; the default `RegExp` for this option
> **ignores** common forms of "front matter". To match differently, specify a custom
> `RegExp` or use the value `null` to disable the feature.

The default pattern matches YAML `---`, TOML `+++` and JSON `{ }` blocks identically
— it is delimiter-shaped, not format-aware.

**Dependency evidence.** `markdownlint@0.41.1` has no YAML parser in its dependencies
at all (`micromark*`, `string-width`). `markdownlint-cli2` depends on `js-yaml`, but
only to read `.markdownlint.yaml` _config files_; the document's frontmatter never
reaches it (`markdownlint-cli2.mjs:776-778` passes `frontMatter` through purely as a
`RegExp`).

**The frontmatter-aware rules.** Grepping `doc/Rules.md` for "front" hits exactly
four of the 53 documented rules:

| Rule                           | Parameter                                 | What it does with frontmatter                       |
| ------------------------------ | ----------------------------------------- | --------------------------------------------------- |
| `MD001` heading-increment      | `front_matter_title` (`^\s*title\s*[:=]`) | Treats a matching line as a virtual h1              |
| `MD022` blanks-around-headings | `include_front_matter` (default `false`)  | Whether to require a blank line after the block     |
| `MD025` single-title           | `front_matter_title`                      | Same virtual-h1 treatment; suppresses "multiple h1" |
| `MD041` first-line-heading     | `front_matter_title`                      | Suppresses "file must start with h1"                |

None validates a _field_. All three `front_matter_title` rules funnel into one helper
(`helpers/helpers.cjs:364-375`):

```js
module.exports.frontMatterHasTitle = function frontMatterHasTitle(frontMatterLines, frontMatterTitlePattern) {
  const ignoreFrontMatter = frontMatterTitlePattern !== undefined && !frontMatterTitlePattern;
  const frontMatterTitleRe = new RegExp(String(frontMatterTitlePattern || '^\\s*"?title"?\\s*[:=]'), 'i');
  return !ignoreFrontMatter && frontMatterLines.some((line) => frontMatterTitleRe.test(line));
};
```

`.some((line) => re.test(line))` is the whole of markdownlint's frontmatter
understanding: _does any line, anywhere, at any nesting depth, match this regex_. A
`title:` nested three levels deep inside an unrelated mapping satisfies MD041. And
it is used only as a suppression gate, never as an assertion (`lib/md041.mjs:36-41`):
`if (!frontMatterHasTitle(params.frontMatterLines, params.config.front_matter_title)) {`.

**Escape hatch.** Custom rules can reach the raw block — `doc/CustomRules.md`:
_"`frontMatterLines` is an `Array` of `String` values corresponding to any front
matter (not present in `lines`)."_ That is the only route to field-level governance
in this family, and it means re-implementing the harness inside a plugin API.

### 1.2 Config cascade — merge or replace, and can a nested config relax?

**A nested `.markdownlint-cli2.*` merges and can relax. A nested `.markdownlint.*`
replaces wholesale.** Two config families with _opposite_ cascade semantics is itself
the most transferable finding here.

`markdownlint-cli2/README.md`, `.markdownlint-cli2.jsonc`:

> - Settings in this file apply to the directory it is in and all subdirectories
> - Settings **merge with** those applied by any versions of this file in a parent
>   directory (up to the current directory)

Same README, `.markdownlint.jsonc`/`.json`:

> - Settings **override** those applied by any versions of this file in a parent
>   directory (up to the current directory)
> - To merge the settings of these files or share configuration, use the `extends`
>   property

**Resolution code** (`markdownlint-cli2.mjs:664-680`) — a walk up the parent chain,
folding parent into child so the child wins:

```js
  // Merge configuration by inheritance
  for (const dirInfo of dirInfos) {
    let { markdownlintConfig, markdownlintOptions } = dirInfo;
    let parent = dirInfo;
    while ((parent = parent.parent)) {
      if (parent.markdownlintOptions) {
        markdownlintOptions = mergeOptions(parent.markdownlintOptions, markdownlintOptions);
      }
      if (!markdownlintConfig && parent.markdownlintConfig && !markdownlintOptions?.config) {
        markdownlintConfig = parent.markdownlintConfig;
      }
    }
```

The asymmetry is visible in that one block: `markdownlintOptions` is merged at every
level; `markdownlintConfig` is picked up only `if (!markdownlintConfig)` —
nearest-ancestor-wins, no merge.

`merge-options.mjs` (entire file), whose own docstring reads _"Merges two options
objects by combining config and replacing properties"_:

```js
const mergeOptions = (first, second) => {
  const merged = { ...first, ...second };
  const firstConfig = first && first.config;
  const secondConfig = second && second.config;
  if (firstConfig || secondConfig) {
    merged.config = { ...firstConfig, ...secondConfig };
  }
  return merged;
};
```

**This is a two-level shallow merge and that is the ceiling.** Level 1: top-level
options keys (`fix`, `noInlineConfig`, `frontMatter`, …). Level 2: `config` keys, i.e.
per _rule name_. **Level 3 does not exist** — a rule's parameter object is replaced
atomically. Parent `"MD013": { "line_length": 100, "tables": false }` plus child
`"MD013": { "line_length": 200 }` yields the child's object alone; `tables` silently
reverts to default.

**Can a nested config turn OFF a rule the parent turned ON? Yes.** `"MD013": false`
in a child spreads over the parent's entry, and `getEffectiveConfig` reads the falsy
value as disabled (`lib/markdownlint.mjs:228-250`: `enabled` starts `false`, set true
only inside `if (value)`). Genuine relaxation.

**The `.markdownlint.*` trap.** At lint time the two families do not combine — one
wins outright (`markdownlint-cli2.mjs:772`):

```js
"config": markdownlintConfig || markdownlintOptions?.config,
```

A single `.markdownlint.json` anywhere in the ancestor chain **discards the entire
merged cli2 cascade** for that subtree.

**Second scoping mechanism: `overrides`**, glob-scoped within one file:

> - `overrides`: `Array` of `Override` objects defining configuration overrides
>   - `Override` object properties (**all required**):
>     - `filter`: `Array` of `String`s defining glob expressions of files to include
>       or exclude … Only files _already_ in scope for the parent configuration object
>       are subject to override; `filter` will not bring in additional files.
>       **If multiple `Override` object `filter`s match a file, only the first
>       matching `Override` is used**
>     - `config`: `markdownlint` `config` object
>     - `combine`: `String` value `merge` or `replace`:
>       - `merge`: Merges override `config` values with parent config
>       - `replace`: Replaces parent `config` values with override config

Implementation (`markdownlint-cli2.mjs:704`):
`const overrideConfig = (combine === "merge") ? { ...dirInfo.markdownlintOptions?.config, ...config } : config;`

Three points of precedent: (a) **first match wins, not last, not most-specific** —
the opposite precedence rule to the directory cascade _in the same tool_; (b)
`combine` is **required**, so merge-or-replace is stated at every override rather than
inferred; (c) overrides apply _after_ directory inheritance resolves, so glob scoping
composes on top of path scoping instead of competing with it.

### 1.3 Enable/disable vocabulary — expressing "govern nothing except what I name"

**The idiom is `"default": false`, then name rules** (`markdownlint/README.md`,
`options.config`):

> Object keys are rule names/aliases; object values are the rule's configuration.
> The value `false` disables a rule. The values `true` or `"error"` enable a rule in
> its default configuration … Passing an object enables _and_ customizes the rule;
> the properties `severity` (`"error" | "warning"`) and `enabled` (`false | true`) can
> be used in this context. **The special `default` rule assigns the default for all
> rules.** Using a tag name (e.g., `whitespace`) and a setting of `false`, `true`,
> `"error"`, or `"warning"` applies that setting to all rules with that tag. **When no
> configuration object is passed or the optional `default` setting is not present, all
> rules are enabled.**

Note the last sentence: markdownlint's shipped posture is default-govern-everything —
the posture this harness rejects. Opting out is one line, but it is opt-_out_.

**Ordered cascade inside one config object**, by declaration order not specificity:

> To evaluate a configuration object, the `default` setting is applied first, then
> keys are processed in order from top to bottom. If multiple values apply to a rule
> (because of tag names or duplication), **later values override earlier ones.** Keys
> (including rule names, aliases, tags, or `default`) are not case-sensitive.

Confirmed in `lib/markdownlint.mjs:198-263`: `default` is found by a first pass over
`Object.entries(config)` and seeds `rulesEnabled` for every rule; a second
`for (const [key, value] of Object.entries(config))` loop does
`effectiveConfig[ruleName] = effectiveValue` — a plain assignment, so the last key
touching a rule wins and **replaces**, never merging two keys' parameters.

Canonical example — rule IDs, aliases and tags in one ordered flat list:

```json
{
  "default": true,
  "MD003": { "style": "atx_closed" },
  "MD007": { "indent": 4 },
  "no-hard-tabs": false,
  "whitespace": false
}
```

**Three coordinate systems address the same rule** — ID (`MD010`), alias
(`no-hard-tabs`), tag (`whitespace`) — in one flat namespace resolved order-dependently.
Reverse the last two lines above and the specific setting is silently clobbered by
the general one. This is the failure mode a self-teaching config must avoid:
correctness depending on line order between two keys that do not look related.

**Cross-file relaxation via `extends`.** The README's own example is a
deeper-config-relaxes-shallower case: `base.json` = `{ "default": true }`;
`custom.json` = `{ "extends": "base.json", "line-length": false }`; result is
`{ "default": true, "line-length": false }`. Semantics:

> If an `extends` key is present once read, its value will be resolved as a path
> relative to `file` and loaded recursively. **Settings from a file referenced by
> `extends` are applied first, then those of `file` are applied on top (overriding any
> of the same keys appearing in the referenced file).**

Base-first, leaf-on-top, per-key override, relaxation allowed — an ordered cascade
merging leafward, arrived at independently by a widely-deployed tool.

### 1.4 Per-rule options, and does rationale reach the user?

Rule parameters are a flat, untyped bag of scalars scoped to one rule
(`doc/md041.md`):

> - `allow_preamble`: Allow content before heading (`boolean`, default `false`)
> - `front_matter_title`: RegExp matching title in front matter (`string`, default `^\s*title\s*[:=]`)
> - `level`: Heading level (`integer`, default `1`)

Two names are reserved out of that namespace by the config layer before the rule sees
`params.config` (`lib/markdownlint.mjs:241-244`): `enabled` and `severity`.

**The one-line description reaches the user; the "Rationale" paragraph does not.**
A rule carries (`doc/CustomRules.md`): _"`description` is a required `String` value
that describes the rule in output messages"_ and _"`information` is an optional
(absolute) `URL` of a link to more information about the rule."_

The default formatter (`formatter-default/markdownlint-cli2-formatter-default.js:20`,
the whole emit):

```js
logError(`${fileName}${line}${column}${sev} ${rule} ${description}${detail}${context}`);
```

Producing, e.g.:
`docs/x.md:12:3 MD041/first-line-heading/first-line-h1 First line in a file should be a top-level heading [Context: "Some text"]`

Four channels reach the user: `ruleNames` and `ruleDescription` authored per _rule_;
`errorDetail` and `errorContext` supplied per _violation_ via `onError({ detail, context })`.

The `Rationale:` paragraph ending every `doc/mdNNN.md` — MD041's _"The top-level
heading often acts as the title of a document"_ — is **documentation only**. It is not
a field on the rule object and not in `LintError` (`lib/markdownlint.d.mts:426-452`:
`lineNumber`, `ruleNames`, `ruleDescription`, `ruleInformation`, `errorDetail`,
`errorContext`, `errorRange`, `fixInfo`). **The _why_ is unreachable from a failing
run** unless folded into the fixed `description` or chased through the URL.

### 1.5 Inline overrides, and can config forbid them?

A full inline vocabulary exists (`markdownlint/README.md`, "Configuration"):
`<!-- markdownlint-disable -->`, `-enable`, `-disable-line`, `-disable-next-line`,
each optionally taking rule names, plus `-capture`/`-restore`. And whole-file
reconfiguration from inside the document:

> - Configure: `<!-- markdownlint-configure-file { options.config JSON } -->`
>   …
>   These changes apply to the entire file regardless of where the comment is located.
>   Multiple such comments (if present) are applied top-to-bottom.

That last is not merely an exemption — a _document_ can set arbitrary rule parameters
for itself, merged over the file's config (`lib/markdownlint.mjs:330-333`:
`config = { ...config, ...parsed }`).

**The forbid switch** (`options.noInlineConfig`):

> Disables the use of HTML comments like `<!-- markdownlint-enable -->` to toggle
> rules within the body of Markdown content. By default, properly-formatted inline
> comments can be used to create exceptions for parts of a document. **Setting
> `noInlineConfig` to `true` ignores all such comments.**

It gates _every_ inline directive including `configure-file`, because the check sits
at the top of the shared scanner (`lib/markdownlint.mjs:303-305`):

```js
function handleInlineConfig(input, forEachMatch, forEachLine = undefined) {
  for (const [ lineIndex, line ] of input.entries()) {
    if (!noInlineConfig) {
```

**Caveat — not established from docs.** `noInlineConfig` is a top-level cli2 option,
and the README does _not_ mark it "valid only in the directory from which
`markdownlint-cli2` is run" (unlike `globs`, `gitignore`, `noBanner`, `noProgress`,
`outputFormatters`, `showFound`). Since `mergeOptions` spreads top-level keys with the
child winning, a nested `.markdownlint-cli2.jsonc` should be able to set
`noInlineConfig: false` and re-open exemptions for its subtree. **This is read off the
merge code plus the absence of the annotation; I found no doc sentence stating it and
did not execute the tool to confirm.**

---

## 2. Obsidian Linter (`platers/obsidian-linter`)

### 2.1 Linter or formatter?

**A formatter. It never reports a violation; it rewrites the file in place.** The
name is misleading and this should be stated plainly wherever it is cited as prior art.

`Rule.apply` is `string → string` — there is no violation type in the API to return
(`src/rules.ts:117-121`):

```ts
public apply(text: string, options?: Options): string {
  return ignoreListOfTypes(this.ignoreTypes, text, (textAfterIgnore: string) => {
    return this.applyAfterIgnore(textAfterIgnore, options);
  });
```

`RulesRunner.lintText` also returns `string` (`src/rules-runner.ts:57`), and the call
site writes it straight to disk (`src/main.ts:559-563`):

```ts
const newText = this.rulesRunner.lintText(createRunLinterRulesOptions(oldText, file, …));
if (oldText != newText) {
  await this.app.vault.modify(file, newText);
```

The documented pipeline ends in a write; reporting is reserved for _crashes_
(`docs/docs/index.md`, "How it Works"):

> `handle-error{Did an error happen?} -- No --> update-file` /
> `handle-error -- Yes --> log-error` /
> `log-error[Display error and log to dev console] --> done` /
> `update-file[Update file contents**] --> done`

Diff-before-write is an **open** feature request:
[#1515 "FR: Preview diff before applying lint changes"](https://github.com/platers/obsidian-linter/issues/1515)
(2026-05-08, open).

This is the _inverse_ of the harness. A formatter never needs to explain itself — the
fix is the message.

### 2.2 What can its YAML rules assert about fields?

Fourteen YAML rules ship (`README.md`): `add-blank-line-after-yaml`,
`dedupe-yaml-array-values`, `escape-yaml-special-characters`, `force-yaml-escape`,
`format-tags-in-yaml`, `format-yaml-array`, `insert-yaml-attributes`,
`move-tags-to-yaml`, `remove-yaml-keys`, `sort-yaml-array-values`, `yaml-key-sort`,
`yaml-timestamp`, `yaml-title`, `yaml-title-alias`. Every verb is a mutation.

| Rule                     | Documented behaviour (quoted)                                                                                                                                          | Nearest harness constraint | Asserts?                          |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | --------------------------------- |
| `insert-yaml-attributes` | "Inserts the given YAML attributes into the YAML frontmatter. Put each attribute on a single line."                                                                    | `required`                 | No — splices a literal text block |
| `remove-yaml-keys`       | "Removes the YAML keys specified"                                                                                                                                      | `forbidden`                | No — deletes unconditionally      |
| `yaml-key-sort`          | Options `YAML key priority sort order`, `Priority keys at start of YAML`, `YAML sort order for other keys` (`None`/`Ascending Alphabetical`/`Descending Alphabetical`) | key ordering               | No — reorders                     |
| `yaml-timestamp`         | Options `Date created key` (default `date created`), `Date created source of truth` (`file system`\|`frontmatter`), Moment format                                      | `type: date`               | No — writes a timestamp           |
| `force-yaml-escape`      | "Uses the YAML escape character on the specified YAML keys … if it is not already escaped. Do not use on YAML arrays."                                                 | value formatting           | No — rewrites quoting             |
| `yaml-title`             | `Mode`: `first-h1-or-filename-if-h1-missing` \| `filename` \| `first-h1`                                                                                               | `required` + derived value | No — derives and writes           |

**No rule asserts that a field is present, absent, of a given type, matches a pattern,
or is one of an enumerated set.** The nearest thing to "required" is
`insert-yaml-attributes`, which makes the field present by writing it.

The parsing substrate is weaker than the name suggests
(`docs/docs/settings/yaml-rules.md`, preamble):

> These rules try their best to work with YAML values in Obsidian.md. … The rules work
> on most YAML use cases, but it is not perfect · Certain formats of YAML may have
> problems being parsed · **The YAML keys have their values parsed via regex instead
> of a library at this time** · Comments in the value of a key may cause problems with
> things like sorting properly or grabbing a key's value · Blank lines may be removed
> if you are sorting or making modifications to the order of keys

Regex-over-lines again — the same substrate as `frontMatterHasTitle`, reached
independently. **Neither of the two closest-named tools parses frontmatter as
structured data.**

### 2.3 Binding — any path scoping?

**None. Two global ignore lists, not scoped configuration — and the maintainer says so
explicitly.** (`docs/docs/usage/disabling-rules.md`):

> ## Ignoring a Folder
>
> There is a setting in the plugin called `Folders to Ignore`. … The values in the
> text box are expected to be folder paths from the base of the Obsidian vault. …
> Nested folders are ignored as well.
>
> ## Ignoring Files via Regex
>
> … If a file matches the provided regex, it will go ahead and ignore the file before
> it even lints the file.

Both are binary skips evaluated before any rule runs (`src/main.ts:531-551`,
`shouldIgnoreFile` → `boolean`; folder matching is a
`file.path.startsWith(normalizePath(folder) + '/')` prefix test, not a glob).

Maintainer `pjkaufman` on [#1213 "FR: Different lint settings per folder"](https://github.com/platers/obsidian-linter/issues/1213)
(2024-10-29, **still open**):

> "There is currently no way to disable or enable rules on a folder by folder basis.
> As of right now, you can disable the rules you do not want to only run on specific
> files. However, you con [sic] include the rule aliases to disable in the YAML
> frontmatter … But if you are looking for a different set of settings almost like
> different profile settings, that currently does not exist."

Related, all open and unbuilt: [#555 "FR: Profiles in Settings"](https://github.com/platers/obsidian-linter/issues/555)
(2022-12-15, 13 comments), [#1147](https://github.com/platers/obsidian-linter/issues/1147),
and [#849 "FR: enable rules via frontmatter"](https://github.com/platers/obsidian-linter/issues/849)
(2023-08-17) — _"There's an option to disable rules per-file … I'd like to see a
symmetrical option to forcibly enable rules per-file."_ Four years of requests for
path-scoped configuration. A commenter on #1213 proposes exactly this harness's model
— reuse the path lists as config _selectors_ rather than as skips:

> "If that functionality is implemented, the 'Folders to ignore' and 'Files to ignore'
> sections could be re-purposed to apply specific profiles."

**Exemptions** are pushed into the documents instead:

> In the YAML frontmatter of a file, you have the ability to specify a list of rules
> to disable for that file using the key `disabled rules`. Valid values … are rule
> aliases to disable specific rules or `all` to disable all rules for the file.

plus ranged ignores `<!-- linter-disable -->` / `%%linter-disable%%`, with a
documented sharp edge — _"Ranged ignores only prevent the values in the ranged ignore
from being linted. It **does not** prevent whitespace or other additions around the
ranged ignore"_ — and an unterminated range silently swallows the rest of the file.
**There is no config-side switch to forbid any of this**; no `noInlineConfig`
equivalent exists in `LinterSettings`. Governance is unilaterally waivable by the
document being governed.

### 2.4 Config format — hand-editable data, or UI state?

**UI-generated state in a plugin-private blob, not an authoring surface.** Settings go
through Obsidian's plugin data API — `this.loadData()` / `this.saveData(settings)`
(`src/main.ts:85, 132`) — resolving to `.obsidian/plugins/obsidian-linter/data.json`.
The docs treat that file as a debugging artifact
(`docs/docs/settings/debug-settings.md`): _"This is the Linter's settings. It makes the
values in the `data.json` easier to access. **This value should be provided on all bug
reports.**"_ And `docs/docs/contributing/bug-fix.md`: _"The first thing that I tend to
do once I get a bug report is make sure I have the `data.json` of the person who
reported the issue."_

Shape (`src/settings-data.ts:26-48`, abridged):

```ts
export interface LinterSettings {
  ruleConfigs: { [ruleName: string]: Options; };
  …
  foldersToIgnore: string[];
  filesToIgnore: FileToIgnore[];
  lintCommands: LintCommand[];
  customRegexes: CustomReplace[];
}
```

`ruleConfigs` is a **single flat map** keyed by rule alias
(`src/option.ts:58, 69`: `settings.ruleConfigs[this.ruleAlias][this.configKey]`).
There is exactly one scope in the design; `foldersToIgnore` sits _beside_ it, never
inside it. Enabling is a synthetic `enabled` boolean the `Rule` constructor unshifts
onto every rule's option list (`src/rules.ts:62`) — so there is no `default: false`
idiom and **no way to express "govern nothing except what I name"** short of toggling
every switch off by hand in the UI.

The README itself warns the docs may lag: _"The docs are updated before the plugin is
released, so they may not be completely accurate."_

### 2.5 Could an agent author correct frontmatter from this config cold?

**No.** The config is not in the repository (it is `data.json` inside a vault, described
by the docs only as a bug-report attachment); it states _transformations_, not
_obligations_ (`Date created key: date created` says a key will be written _for_ the
agent, not that one is required); and nothing is path-scoped, so it cannot answer "what
does _this_ directory require". Nor does the agent need it to — the tool rewrites
whatever is authored.

For markdownlint-cli2 the answer is **partially yes, for rule _selection_ only**: an
agent can read `{"default": false, "MD041": {"front_matter_title": "^\\s*id\\s*[:=]"}}`
and infer "this tree wants an `id:` line in the frontmatter". What it cannot infer is
_why_ — the rationale reaches neither the config nor the message.

---

## 3. Implications for the harness

1. **Neither closest-named tool validates frontmatter fields.** markdownlint strips the
   block and exposes it as `readonly string[]`; Obsidian Linter parses "via regex instead
   of a library". No incumbent to defer to and no constraint vocabulary to copy — a green
   field, not a survey gap.

2. **markdownlint-cli2's directory cascade is a deployed instance of the model this
   harness settled on**: parent merged first, child on top, per-key override, relaxation
   permitted (`"MD013": false` in a child kills a rule the parent enabled). `extends` is
   the same shape at file granularity. Cite as precedent that a leafward-relaxing ordered
   cascade is not exotic.

3. **Merge depth is the decision to make explicitly.** `mergeOptions` stops at two levels
   — options keys, then rule keys — and replaces a rule's parameter object atomically. The
   harness's requirement (`docs/` requires `description`, `docs/logs/` does not) is a
   _leaf-level_ relax, one level deeper than markdownlint-cli2 merges. Copying
   `{...parent, ...child}` verbatim would not satisfy it; the merge must recurse to the
   individual constraint (`description.required`), not stop at the field name.

4. **One config file kind, one precedence rule.** markdownlint-cli2 ships two config
   families with opposite cascade semantics, chosen by filename and resolved by
   `markdownlintConfig || markdownlintOptions?.config` — so a stray `.markdownlint.json`
   silently discards an entire merged cascade. It also runs two path-scoping mechanisms
   with contradictory precedence (directory cascade = deepest-wins-merging;
   `overrides[].filter` = first-match-wins). Both are self-inflicted and both are
   avoidable by declining the second mechanism.

5. **`combine: "merge" | "replace"` being _required_ is the right ergonomic** — it puts
   the merge decision at the point of authorship instead of leaving an agent to infer it.
   If the harness ever needs a replace mode, name it in the rule; do not default it.

6. **`"default": false` is the proven default-ignore idiom** — one reserved key seeding
   every rule, then explicit names to opt in. markdownlint has the key but defaults it the
   other way (_"When no configuration object is passed or the optional `default` setting is
   not present, all rules are enabled"_). Keep the key, flip the default. Obsidian Linter
   has no such key and is correspondingly unusable in default-ignore mode.

7. **One address per thing.** markdownlint lets `MD010`, `no-hard-tabs` and the
   `whitespace` tag all key the same flat object, last-key-wins — so whether
   `no-hard-tabs: false` survives depends on its line order relative to a key that does not
   look related. Fatal for a config meant to teach by inspection.

8. **Carry rationale in the emitted message, not in a field nothing reads.** markdownlint's
   output channels work, but the per-rule `Rationale:` paragraph is unreachable from a
   failing run — the same injectable-explanation gap the prior session found in
   `remark-lint-frontmatter-schema`. If a harness rule can author a `reason`, it must appear
   in the violation output, or it is documentation wearing a config's clothes.

9. **Exemptions need a lock that cannot be reopened downward.** `noInlineConfig` is the
   right shape but merges as an ordinary key with the child winning, so a nested config can
   re-open what the root closed (§1.5 caveat). Obsidian Linter shows the other failure:
   `disabled rules: [all]` in a document, with no lock at all.

10. **Say plainly that this harness reports and never rewrites.** The adjacent tool with the
    closest name is a formatter that never reports; the expectation it sets is the opposite
    one.
