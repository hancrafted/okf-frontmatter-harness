# Docusaurus & Decap CMS: front matter constraints as code vs. as data

These two bracket the design space: Docusaurus is **hardcoded, type-aware validation with
no user-facing schema config at all**; Decap CMS is **fully declarative YAML with a rich,
generic constraint vocabulary**. Primary sources only: `facebook/docusaurus@main` (HEAD
`eef60b7`), its tracker, `decaporg/decap-cms@main`, `decaporg/decap-website@main` (source
of decapcms.org/docs). Where a fact could not be established from primary source, I say so.

---

## Docusaurus

### Where validation lives

Three plugins, three sibling `frontMatter.ts` files, one shared helper; each exports one
Joi object schema and one `validateXFrontMatter()`:
`packages/docusaurus-plugin-content-docs/src/frontMatter.ts:24` → `DocFrontMatterSchema`;
`…-content-blog/src/frontMatter.ts:35` → `BlogFrontMatterSchema`;
`…-content-pages/src/frontMatter.ts:19` → `PageFrontMatterSchema`. Shared pieces live in
`packages/docusaurus-utils-validation/src/{validationSchemas,validationUtils,JoiFrontMatter}.ts`.

The docs schema, the load-bearing artefact, with repetitive runs elided
([`frontMatter.ts:20-51`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/frontMatter.ts#L20-L51)):

```ts
// NOTE: we don't add any default value on purpose here
// We don't want default values to magically appear in doc metadata and props
export const DocFrontMatterSchema = Joi.object<DocFrontMatter>({
  id: Joi.string(),
  title: Joi.string().allow(''),
  hide_title: Joi.boolean(),
  hide_table_of_contents: Joi.boolean(),
  keywords: Joi.array().items(Joi.string().required()),
  image: URISchema,
  description: Joi.string().allow(''),
  slug: Joi.string(),
  sidebar_key: Joi.string(), // + sidebar_label/_position/_class_name/_custom_props
  displayed_sidebar: Joi.string().allow(null),
  tags: FrontMatterTagsSchema,
  custom_edit_url: URISchema.allow('', null),
  pagination_next: Joi.string().allow(null), // + pagination_prev, pagination_label
  ...FrontMatterTOCHeadingLevels, // toc_min/max_heading_level, both number 2..6
  last_update: FrontMatterLastUpdateSchema,
})
  .unknown()
  .concat(ContentVisibilitySchema);
```

**Not one top-level key is `.required()`.** Every `.required()` in all three schemas sits
_inside_ an array item or nested object (`keywords` items; tag `label`/`permalink`).
Docusaurus front matter validation is **pure type-shape checking; it never checks
presence.** The only presence-ish constraints are Joi `.or()` on sub-objects:
`.or('author', 'date')` on `last_update` ([`validationSchemas.ts:186`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationSchemas.ts#L177-L190))
and `.or('key', 'name', 'imageURL')` on the blog author object ([`content-blog/frontMatter.ts:29`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-blog/src/frontMatter.ts#L21-L30)).
Cross-field logic is an imperative callback, not data: `ContentVisibilitySchema` is a
`.custom()` closure returning `helpers.error('frontMatter.draftAndUnlistedError')` →
`"Can't be draft and unlisted at the same time."` ([`validationSchemas.ts:162-171`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationSchemas.ts#L162-L171)).

One transferable lesson regardless of engine: YAML auto-types `tag: 2021` as a number and
`2019-01-01` as a Date, so Docusaurus extends `Joi.string()` to stringify those _before_
validating — `prepare: (value) => typeof value === 'number' || value instanceof Date ?
{value: value.toString()} : {value}` ([`JoiFrontMatter.ts:14-19`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/JoiFrontMatter.ts#L10-L31)).
**A YAML constraint engine must settle coercion before it can say "must be a string".**

### Is it user-configurable? No.

**(a) No hook exists in plugin options.** The complete content-docs `OptionsSchema`
([`options.ts:76-156`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/options.ts#L76-L156))
accepts `path`, `editUrl`, `routeBasePath`, `include`, `exclude`, `sidebarPath`,
`remarkPlugins`, `admonitions`, `versions`, `tags`, `onInlineTags` and component swaps —
nothing naming front matter; the string `frontMatter` does not appear in the file.
`validateDocFrontMatter` is called unconditionally with the module-level schema
([`docs.ts:113`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/docs.ts#L113)).

**(b) Unknown keys are globally, deliberately permitted — the only extension point.**
`validateFrontMatter` forces `allowUnknown: true` on every call: `schema.validate(frontMatter,
{convert: true, allowUnknown: true, abortEarly: false, ...options})` ([`validationUtils.ts:85-90`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationUtils.ts#L85-L90)).
That was the founding intent, from [facebook/docusaurus#4591 "Strict frontmatter validation"](https://github.com/facebook/docusaurus/issues/4591):

> We should validate docs/blog/pages frontmatter against a Joi schema:
>
> - prevent the user to use bad frontmatter
> - display friendly error messages when this happens
> - **allow unknown frontmatter (user can assign additional metadata to each doc)**

The site author's available moves are exactly:

| Author wants to…                                       | Without forking?                                             |
| ------------------------------------------------------ | ------------------------------------------------------------ |
| Add a new key to front matter                          | Yes — silently accepted, exposed as `frontMatter.*` metadata |
| Constrain that new key                                 | **No**                                                       |
| Make a built-in key required                           | **No**                                                       |
| Relax a built-in constraint (e.g. allow `title: null`) | **No**                                                       |
| Forbid a key in one subtree                            | **No**                                                       |

Tracker searches for a configurable-schema request (`disable front matter validation`,
`custom front matter validation schema`, `extend frontMatter schema plugin`, plus a
Discussions search) returned **none** — only requests to add _more first-party fields_
(#12230 `created_at`, #10586 `title_meta`, #5691 `created`). A negative search result is
not proof of absence, but the observed pattern is authors asking Docusaurus to widen the
built-in vocabulary rather than to define their own. The only escape hatch is a remark
plugin (`beforeDefaultRemarkPlugins`) or an external linter — neither is configuration.

### Error messages

Template at
[`validationUtils.ts:98-103`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationUtils.ts#L94-L105):
``logger.error`The following front matter:\n---\n${Yaml.dump(frontMatter)}---\ncontains
invalid values for field(s): code=${invalidFields}.\n${errorDetails.map(({message}) => message)}` ``.
A real instance, quoted verbatim by the reporter of
[facebook/docusaurus#8230](https://github.com/facebook/docusaurus/issues/8230):

```
[ERROR] The following front matter:
---
title: null
---
contains invalid values for field(s): `title`.

- "title" must be a string

[ERROR] Unable to build website for locale en.
[ERROR] ValidationError: "title" must be a string
```

**Does it teach the author what was wanted?** Partly, and the gaps are the lesson. It
echoes the offending front matter and names the field — good. But the rule text is Joi's
_generic default_: it states the type, never the reason. And it originally carried **no
file path** — the issue title is literally _"front matter validation does not print a good
error message"_; the reporter wrote "without context, I don't know where to look at", and a
maintainer replied _"I can agree that we don't make it easy to find the original md file
that has the problem."_ The fix was a wrapper re-throw at
[`docs.ts:257-262`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/docs.ts#L257-L262):
`` `Can't process doc metadata for doc at path path=${args.docFile.filePath} in version name=${args.versionMetadata.versionName}` ``.
Intent lands **only** where a maintainer hand-wrote a `.messages()` override — each is
hardcoded English prose beside the schema:

| Constraint  | Message                                                                                                                     | Location                                       |
| ----------- | --------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| tag         | `'{{#label}} does not look like a valid tag'`                                                                               | `validationSchemas.ts:128`                     |
| last_update | `'…does not look like a valid last update object. Please use an author key with a string or a date with a string or Date.'` | `validationSchemas.ts:174-175`                 |
| authors     | `'…does not look like a valid blog post author. Please use an author key or an author object (with a key and/or name).'`    | `plugin-content-blog/src/frontMatter.ts:32-33` |
| url         | `"{{#label}} does not look like a valid url (value='{{.value}}')"`                                                          | `validationSchemas.ts:82-83`                   |
| deprecated  | `'{#label} blog frontMatter field is deprecated. Please use {#alternative} instead.'`                                       | `plugin-content-blog/src/frontMatter.ts:81-82` |

The maintainer's own verdict on doing this in a code-schema world, directly above
`URISchema` ([`validationSchemas.ts:65-66`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationSchemas.ts#L65-L66)):

> `// TODO how can we make this emit a custom error message :'(`
> `//  Joi is such a pain, good luck to annoying trying to improve this`

(the typo is upstream's, quoted verbatim)

### Per-plugin variation and de-facto path scoping

| Field group                                                                       | docs   | blog                 | pages  |
| --------------------------------------------------------------------------------- | ------ | -------------------- | ------ |
| `title`, `description`, `slug`, `image`, `keywords`, `hide_table_of_contents`     | yes    | yes                  | yes    |
| `tags`                                                                            | yes    | yes                  | **no** |
| `date`, `authors`, `author*`, `title_meta`                                        | **no** | yes                  | **no** |
| `sidebar_*`, `pagination_*`, `displayed_sidebar`, `hide_title`, `custom_edit_url` | yes    | `sidebar_label` only | **no** |
| `wrapperClassName`                                                                | **no** | **no**               | yes    |
| `toc_min/max_heading_level`, `last_update`, `draft`, `unlisted`                   | yes    | yes                  | yes    |

Scope is expressed **not as a path pattern inside a rule, but as which plugin instance
owns the directory**: `path: 'docs'`, `include: ['**/*.{md,mdx}']`, `exclude:
GlobExcludeDefault` ([`content-docs/options.ts:27-33`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-docs/src/options.ts#L27-L33));
`path: 'src/pages'` for pages. Multiple instances are supported via the `id` option
([`validationUtils.ts:29-50`](https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-utils-validation/src/validationUtils.ts#L29-L50)).
Two consequences:

1. **Granularity stops at the plugin root.** No way to say "inside `docs/`, the subtree
   `docs/logs/` differs". Every file one instance matches gets exactly one schema.
2. **The scope→schema binding is 1:1 and non-composing.** Two docs instances share the
   _same_ `DocFrontMatterSchema`; you vary the root, never the rules. Cascade, override
   and relaxation cannot arise as questions. **Docusaurus is the null result the harness's
   cascade requirement is defined against.**

---

## Decap CMS (formerly Netlify CMS)

Up front, because it colours everything: **Decap validation is browser-only.** The
validators are React component methods in
`packages/decap-cms-core/src/components/Editor/EditorControlPane/Widget.js`, and there is
no lint/validate CLI anywhere in the 40-package monorepo (`decap-server` is a local backend
proxy, not a checker). A file written by hand, a script, or an agent and committed directly
**never passes through any of it.**

### Binding: how a file is matched to a collection

Exactly one of two keys — "`files` or `folder` (requires one of these): specifies the
collection type and location" ([configuration-options.md:260](https://github.com/decaporg/decap-website/blob/main/content/docs/configuration-options.md)) —
enforced by Decap's own AJV config schema: `oneOf: [{ required: ['files'] }, { required:
['folder', 'fields'] }]` ([`configSchema.js:354`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/constants/configSchema.js#L354)).
A folder collection must declare `fields`; a file collection must not (each file carries its own).

**`files`** — explicit paths, one config each ([collection-file.md:9](https://github.com/decaporg/decap-website/blob/main/content/docs/collection-file.md)):

> A `files` collection contains one or more uniquely configured files. Unlike items in
> `folder` collections, which repeat the same configuration over all files in the folder,
> each item in a `files` collection has an explicitly set path, filename, and
> configuration.

**`folder`** — a directory, one config for all ([collection-folder.md:9](https://github.com/decaporg/decap-website/blob/main/content/docs/collection-folder.md)):

> Folder collections represent one or more files with the same format, fields, and
> configuration options, all stored within the same folder in the repository.

**Matching is a directory listing, not a glob match, and it is shallow by default.** Decap
never asks "which collection owns this path?"; it asks "what files does this collection's
folder contain?". Depth comes from the `path` template or `nested.depth` — `depth =
collection.get('nested')?.get('depth') || getPathDepth(collection.get('path', ''))`
([`backend.ts:321-331`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/backend.ts#L321-L331)) —
and `getPathDepth('')` is `1` ([`backendUtil.ts:118-121`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-lib-util/src/backendUtil.ts#L118-L121)).
The GitHub backend then lists non-recursively: `params: depth > 1 ? { recursive: 1 } : {}`
… `.filter(file => … file.path.split('/').length <= depth)` ([`API.ts:732-747`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-backend-github/src/API.ts#L732-L747)).
So **nested folders inside a collection folder are invisible unless you opt in** — via a
`path` template ("This allows saving content in subfolders, e.g. configuring `path:
'{{year}}/{{slug}}'`", collection-folder.md:87) or a nested collection, which "allows a
folder collection to show a nested structure of entries and edit the locations of the
entries" ([collection-nested.md:8](https://github.com/decaporg/decap-website/blob/main/content/docs/collection-nested.md)).
Critically, a nested collection applies **one** `fields` list to the entire subtree;
`depth` controls visibility, never rule variation.

The one documented way to give files in the same directory different rules is
_content_-based ([collection-folder.md:47](https://github.com/decaporg/decap-website/blob/main/content/docs/collection-folder.md)):

> The entries for any folder collection can be filtered based on the value of a single
> field. By filtering a folder into different collections, you can manage files with
> different fields, options, extensions, etc. in the same folder.

Implemented as a plain equality/`includes` test on a parsed front matter value
([`backend.ts:1522-1530`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/backend.ts#L1522-L1530)).
Note the direction: **the document's own content selects its rule set** — a discriminated
union, and the only branching Decap has. I found no primary-source statement on what
happens when two collections' folders overlap _by path_ rather than by `filter`; the config
schema requires only that collection _names_ be unique (`uniqueItemProperties: ['name']`).

### Constraint vocabulary

Available on **every** field regardless of widget (widgets.md "Common widget options";
identical text at configuration-options.md:396-403):

| Key        | Semantics (quoted)                                                                                                                                    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | "(required): unique identifier for the field, used as the key when referenced in other contexts"                                                      |
| `label`    | "label for the field in the editor UI; defaults to the value of `name`"                                                                               |
| `widget`   | "defines editor UI and inputs and file field data types"                                                                                              |
| `default`  | "specify a default value for a field… the field default value only works for folder collection type"                                                  |
| `required` | "specify as `false` to make a field optional; **defaults to `true`**"                                                                                 |
| `hint`     | "optionally add helper text directly below a widget. Useful for including instructions. Accepts markdown for bold, italic, strikethrough, and links." |
| `pattern`  | "add field validation by specifying a list with a regex pattern and an error message"                                                                 |
| `comment`  | "optional comment to add before the field (only supported for `yaml`)"                                                                                |

`pattern` is a two-element array — regex **and its message**, side by side as data:
`pattern: {type:'array', minItems:2, items:[{oneOf:[{type:'string'},{instanceof:'RegExp'}]},{type:'string'}]}`
([`configSchema.js:97-101`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/constants/configSchema.js#L97-L101)),
used as `pattern: ['.{20,}', "Must have at least 20 characters"]` (configuration-options.md:414).
Per-widget constraint options (docs under `content/docs/widgets/`; machine-readable
duplicates in each `packages/decap-cms-widget-*/src/schema.js`):

| Widget                                   | Constraint-bearing options                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `string`, `text`, `markdown`, `richtext` | none beyond the common set                                                                                                     |
| `boolean`                                | `default`                                                                                                                      |
| `number`                                 | `value_type` (`int`\|`float`), `min`, `max`, `step`                                                                            |
| `select`                                 | `options` (**required**; strings, numbers, or `{label, value}` objects), `multiple`, `min`, `max`                              |
| `list`                                   | `field`/`fields`/`types`, `min`, `max`, `allow_add`, `allow_remove`, `allow_reorder`, `collapsed`, `summary`                   |
| `object`                                 | `fields` (**required**), `collapsed`, `summary`                                                                                |
| `relation`                               | `collection`, `value_field`, `search_fields` (all **required**), `file`, `display_fields`, `multiple`, `min`, `max`, `filters` |
| `datetime`                               | `format`, `date_format`, `time_format`, `picker_utc`                                                                           |
| `map`                                    | `type` (`Point`\|`LineString`\|`Polygon`), `decimals`                                                                          |
| `code`                                   | `keys`, `output_code_only`, `default_language`, `allow_language_selection`                                                     |
| `image`, `file`                          | `allow_multiple`, `media_folder`, `public_folder`, `choose_url`, `media_library`                                               |
| `hidden`                                 | `default` (written but not editable)                                                                                           |
| `color`, `uuid`                          | rendering/generation options only                                                                                              |

The vocabulary is **extensible as data**: a widget's extra options are a JSON Schema
fragment the widget package ships, and the field schema dispatches on the widget name —
`select: { $data: '0/widget' }, selectCases: { ...getWidgetSchemas() }`, where
`getWidgetSchemas()` maps `getWidgets()` to `{[widget.name]: widget.schema}`
([`configSchema.js:106-109, 391-394`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/constants/configSchema.js#L106-L109)).
`decap-cms-widget-select/src/schema.js` is a fair sample: `{properties: {multiple, min,
max, options: {…}}, required: ['options']}`. Note the shape — **generic keys
(`min`/`max`/`options`) reused across widgets, never type-aware names.**

Runtime enforcement is two functions, total: `const validations = [this.validatePresence,
this.validatePattern]`, with `const isRequired = field.get('required', true)` and `if
(pattern && !RegExp(pattern.first()).test(value))` ([`Widget.js:154, 172-211`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/components/Editor/EditorControlPane/Widget.js#L154-L211)).
`field.get('required', true)` in source confirms the docs: **required-by-default, opt-out**
— the inverse of JSON Schema, YAML-schema linters and Docusaurus, all optional-by-default.
Richer checks (`min`/`max`, counts) run inside each widget's control via
`validateWrappedControl`, with messages from `decap-cms-locales/src/en/index.js:87-96`:
`required: '%{fieldLabel} is required.'`, `regexPattern: "%{fieldLabel} didn't match the
pattern: %{pattern}."`, `range: '%{fieldLabel} must be between %{minValue} and
%{maxValue}.'`, `rangeCount: '%{fieldLabel} must have between %{minCount} and %{maxCount}
item(s).'`. Crucially `regexPattern` interpolates `pattern.last()` — **the author-supplied
message, not the regex** (`Widget.js:201-204`). Decap's constraint messages are
user-authored data; Docusaurus's are maintainer source code.

### Required/optional granularity

**Per field, always.** `required` lives on the field object; there is no collection-level
required list and no way to name a set of keys as a group. In a `files` collection the
grain is effectively per-file, since each file entry has its own `fields`. Nesting is
recursive (`fields` inside `object`/`list` inside `fields`) and `required` applies at each
level independently. Exactly one quasi-collection-level presence rule exists, and it is
hardcoded rather than configured (collection-folder.md:13): "Folder collections must have
at least one field with the name `title` for creating new entry slugs. … If you forget to
add this field, you will get an error that your collection 'must have a field that is a
valid entry identifier'." Overridable in name only, via `identifier_field`.

### Partial override / inheritance: none

There is **no inheritance, extension, mixin or cascade mechanism** anywhere in the config
schema. The collection object's properties (`configSchema.js:216-352`) contain no
`extends`, `inherit`, `base` or `include` key; its `fields` is a flat array replacing
nothing. A nested subfolder cannot relax or extend the parent collection's fields. **The
only route to different rules for a subtree is declaring a second, wholly independent
collection and restating every field** — `filter` makes that survivable inside one
directory, at the cost of a discriminator field in the content. Variable-type widgets
(`types:` on a `list`) give per-item polymorphism _inside a field_ — "multiple named sets
of fields can be defined" — but they are union, not override: each type restates its
complete `fields`, and `typeKey` (default `type`) records which arm was chosen.
Discrimination, never relaxation. The only composition available is YAML's own
anchors/aliases over the config file; I found no first-party Decap documentation describing
or endorsing that, so I record it as a capability of the format, not a Decap feature.

### `hint:` and `label:` — closest precedent for a mandatory `intent:`

`hint` is "optionally add helper text directly below a widget. Useful for including
instructions. Accepts markdown for bold, italic, strikethrough, and links." It renders as a
`<p>` under the control — `{fieldHint && (<ControlHint … error={hasErrors}><ReactMarkdown
remarkPlugins={[gfm]} allowedElements={['a','strong','em','del']} …>` — and turns red on
failure (`color: props.error ? colors.errorText : …`), so the guidance is **co-located with
the error**: exactly the behaviour the harness wants from `intent:`
([`EditorControl.js:97-104, 359-379`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/components/Editor/EditorControlPane/EditorControl.js#L359-L379)).

**Is `hint` validated? Only as a type.** It is `hint: { type: 'string' }`
([`configSchema.js:95`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/constants/configSchema.js#L95)),
and the field object's mandatory key list is `required: ['name']`
([`configSchema.js:110`](https://github.com/decaporg/decap-cms/blob/main/packages/decap-cms-core/src/constants/configSchema.js#L110)) —
`label`, `widget` and `hint` are all optional. **Nothing checks that a hint exists, is
non-empty, or says anything useful.** `label` is likewise cosmetic ("defaults to the value
of `name`") but is the string every error message interpolates (`field.get('label',
field.get('name'))`, `Widget.js:180`); optionality is surfaced by appending a literal
`(optional)` to the label when `field.get('required') === false` (`EditorControl.js:113, 236`).

### Could an agent author correct front matter from this config, cold?

Substantially yes — better than any linter config in this survey, with two real caveats.

**What works.** A Decap collection is a **positive, ordered enumeration of every legal
key**, each carrying name, human label, type, defaultness, optionality and an optional
prose hint. `required: true` by default means the config states the _complete_ required
set, not a subset; `select.options` enumerates legal values inline; `pattern` ships its own
failure message. Nothing needs a second document — `folder:` plus `fields:` is a complete,
readable contract for a directory. That property comes from being _positive and closed_
(here is everything, in order) rather than _negative and open_ (here are some prohibitions).

**Where being UI-shaped hurts.** (1) The vocabulary is **presentational where it should be
semantic** — `widget: image`, `collapsed`, `summary`, `allow_add`, `media_library` are
form-rendering instructions with no bearing on file validity, so an agent must learn which
keys constrain and which merely decorate. (2) `hint` is where all the _reasons_ live and it
is optional, so the average config teaches types without teaching intent — a direct
argument for making `intent:` mandatory rather than copying `hint` as-is. (3) The config
describes a _form_, not a _file_: the `body` convention ("In files with frontmatter, one
field should be named `body`", configuration-options.md:405) and `widget: hidden` mean the
field→disk mapping is knowledge an agent must already have. (4) Because collections match
by listing rather than by glob, a config is silent about which files it does _not_ govern.

Net: **more self-teaching than a linter config, and for a structural reason** — a whitelist
with labels, not a blacklist of violations. Its weaknesses are separable from that virtue.

---

## Implications for the harness

1. **Docusaurus is the anti-pattern, and citable as one.** Type-aware, hardcoded, zero
   config surface, one schema per plugin root, no subtree variation, no relaxation — and
   the only feature requests are "please add my field to your enum". Exactly the failure
   mode a data-driven `okf-config.yml` exists to avoid.
2. **Required-by-default is a live, shipped design.** Decap's `field.get('required', true)`
   inverts JSON Schema's default: the config states its complete obligation set, and
   _relaxation_ becomes the common operation (`required: false`) — precisely the cascade
   motion the harness needs. Worth serious consideration as the rule vocabulary's default.
3. **Constraint + message as one data pair.** `pattern: [regex, "message"]` is the shape to
   copy: failure text is authored data beside the constraint, not maintainer source.
   Contrast `// TODO how can we make this emit a custom error message :'(`. This is the
   empirical argument for a mandatory `intent:` — with the correction that Decap's `hint`
   is optional and consequently usually absent.
4. **Generic option names transfer directly.** `required`, `pattern`, `min`, `max`,
   `options`, `default`, `multiple`, `fields`, reused across widgets and never type-aware,
   are the closest thing in the survey to the vocabulary the harness wants — and evidence
   that generic keys plus a per-value "kind" tag carry real content.
5. **Neither tool supports leaf-merged precedence, and Decap shows the cost.** Its answer
   to "this subtree is different" is _restate the whole collection_; to "same directory,
   different rules", a content discriminator rather than a path rule. If the harness's
   cascade works, it solves what two mature tools both punt on.
6. **Separate discrimination from relaxation.** Both can _branch_ (Docusaurus by plugin,
   Decap by `filter` and `types`); neither can _relax_. Requiring `docs/logs/` to drop a
   `description` that `docs/` mandates is unreachable by either mechanism here — so the
   cascade must not be modelled as a discriminated union.
7. **Settle YAML coercion before writing the type vocabulary.** Docusaurus needed a Joi
   extension so `tag: 2021` and `date: 2019-01-01` did not fail "must be a string"; a
   hand-rolled checker over `ctx.readYAML()` hits the same wall, and the answer belongs in
   the config's stated semantics, not buried in a rule file.
8. **Enforcement point matters more than vocabulary.** Decap's constraints run only in a
   browser form, so an agent writing a file bypasses them entirely. The harness's value is
   running that same declarative vocabulary as a repository gate — the gap is in the
   precedent, not in the harness.
