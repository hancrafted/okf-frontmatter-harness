# Astro Content Collections and VitePress

Research slice for the OKF frontmatter harness. Two tools that sit in front of directories of Markdown and must decide "which rules apply to this file?". Astro answers with a **code** config; VitePress mostly declines to answer. Every load-bearing claim is quoted from a primary source (upstream source, official docs source, RFC text, maintainer statement) with a URL. Where a fact could not be established from a primary source, this says so rather than inferring.

Read at `main`: `withastro/astro` (CHANGELOG head `7.2.4`), `withastro/docs`, `withastro/roadmap`, `vuejs/vitepress` (CHANGELOG head `2.0.0-alpha.19`, 2026-08-02), `colinhacks/zod`.

---

## 1. Astro Content Collections

### 1.0 Version timeline

| Thing                                                                         | Version    | Evidence                                                                                                                                                                                                                                                                               |
| ----------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Content collections, `src/content/config.ts`, Zod schema                      | **2.0**    | `<Since v="2.0.0" />` — [`content-collections.mdx:16`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L16)                                                                                                                             |
| JSON Schema emitted to `.astro/collections/`                                  | **4.13.0** | `<Since v="4.13.0" />` — [`content-collections.mdx:998`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L998)                                                                                                                          |
| Content Layer (`loader:`) behind `experimental.contentLayer`                  | **4.14.0** | "The Content Layer API introduced behind a flag in 4.14.0 is now stable and ready for use in Astro v5.0" — [PR #11911](https://github.com/withastro/astro/pull/11911)                                                                                                                  |
| `glob()` loader stable                                                        | **5.0.0**  | `<Since v="5.0.0" />` — [`content-loader-reference.mdx:32`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/content-loader-reference.mdx#L32)                                                                                                                |
| Config moved `src/content/config.*` → `src/content.config.*`                  | **5.0**    | "Changes the default content config location from `src/content/config.*` to `src/content.config.*`. The previous location is still supported" — [PR #12475](https://github.com/withastro/astro/pull/12475)                                                                             |
| `retainBody` on `glob()`                                                      | **5.17.0** | `<Since v="5.17.0" />` — [`content-loader-reference.mdx:114`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/content-loader-reference.mdx#L114)                                                                                                             |
| Zod **4** replaces Zod 3                                                      | **6.0**    | "Astro v6.0 upgrades to Zod v4 for schema validation" — [PR #14956](https://github.com/withastro/astro/pull/14956)                                                                                                                                                                     |
| Legacy collections removed (`legacy.collectionsBackwardsCompat` escape hatch) | **6.0**    | `LegacyContentConfigError` hint → `/en/guides/upgrade-to/v6/#removed-legacy-content-collections` in [`errors-data.ts`](https://github.com/withastro/astro/blob/main/packages/astro/src/core/errors/errors-data.ts); flag in [PR #15137](https://github.com/withastro/astro/pull/15137) |

Direction of travel: binding moved away from "magic directory = collection" toward "explicit glob in a TypeScript file". Both moves increase the amount of code in the config.

### 1.1 Binding

Two-level and explicit: a named key in an exported object, plus a `loader` selecting files.

> "All of your build-time content collections are defined in a special `src/content.config.ts` file (`.js` and `.mjs` extensions are also supported) using `defineCollection()`, and then a single collections object is exported for use in your project." — [`content-collections.mdx:128`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L128)

> "The `pattern` property accepts a string or an array of strings using glob matching (e.g. wildcards, globstars). The patterns must be relative to the base directory of entry files to match." — [`content-loader-reference.mdx:73`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/content-loader-reference.mdx#L73)

The pattern may not escape `base`; only `base` can point outside. Enforced in source, not documented:

```ts
// glob.ts:88-96
if (checkPrefix(globOptions.pattern, '../'))
  throw new Error('Glob patterns cannot start with `../`. Set the `base` option to a parent directory instead.');
if (checkPrefix(globOptions.pattern, '/'))
  throw new Error(
    'Glob patterns cannot start with `/`. Set the `base` option to a parent directory or use a relative path instead.',
  );
```

— [`glob.ts:88`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/loaders/glob.ts#L88)

**Frontmatter fields cannot select a schema.** No `type:` discriminator, no "if `kind: adr` apply this schema". The only frontmatter field read before validation is `slug`, and it sets the entry _id_: `if (data.slug) { return String(data.slug); }` — [`glob.ts:51`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/loaders/glob.ts#L51)

**Can one file be matched by two schemas? Yes, and nothing detects it.** Collections load independently in parallel, each with its own `parseData` closure bound to its own schema — `await Promise.all(Object.entries(contentConfig.config.collections).map(async ([name, collection]) => {` ([`content-layer.ts:286`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/content-layer.ts#L286)) — and the store is namespaced by collection, so two collections over one file yield two independent entries: `protected _collections = new Map<string, Map<string, any>>();` ([`data-store.ts:85`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/data-store.ts#L85)).

The only collision Astro detects is a duplicate entry id **within one collection** (`**${collection}** contains multiple entries with the same slug`, [`errors-data.ts:2056`](https://github.com/withastro/astro/blob/main/packages/astro/src/core/errors/errors-data.ts#L2056)), and it is downgradeable to warn or ignore via `config.prerenderConflictBehavior` ([`glob.ts`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/loaders/glob.ts), `syncData`).

**Not established from a primary source:** no Astro doc, issue, or RFC discusses overlapping collection globs at all. GitHub search of `withastro/astro` for `overlapping glob collections` returns 0 results; `same file two collections` returns only unrelated hits. The paragraph above is read off source, not documented behaviour.

### 1.2 Constraint vocabulary

The vocabulary is **not Astro's**. Astro re-exports Zod and stops:

> "The `astro/zod` module exposes a re-export of Zod that gives you access to all the features of Zod v4. By using this module, you do not need to install Zod yourself." — [`astro-zod.mdx:14`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/modules/astro-zod.mdx#L14)

The documented cheatsheet is the whole offered surface ([`astro-zod.mdx:44`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/modules/astro-zod.mdx#L44)):

```ts
const user = z.object({
  username: z.string(),
  name: z.string().min(2),
  email: z.email(),
  role: z.enum(['admin', 'editor']),
  language: z.enum(['en', 'fr', 'es']).default('en'),
  hobbies: z.array(z.string()),
  age: z.number(),
  isEmailConfirmed: z.boolean(),
  inscriptionDate: z.date(),
  website: z.url().optional(),
});
```

Scalars, lists, enums, length/shape constraints, defaults, optionality — plus `.refine()` (arbitrary predicates) and `.transform()` (arbitrary rewriting). That last pair is the qualitative difference from any data format: the constraint language is Turing-complete because it _is_ the host language.

Astro adds exactly two items of its own: `reference('collection')` — "you can define a property in a collection schema as an entry from another collection" ([`content-collections.mdx:382`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L382)) — and `image()`, injected via `schema: ({ image }) => z.object({...})`, with the documented limitation "performing custom validation checks on images using `image().refine()` is unsupported" ([`content-collections.mdx:376`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L376)).

A gap that matters for governance: **unknown frontmatter keys are silently dropped.** Astro uses `z.object()` in every example, and Zod's docs state:

> "By default, unrecognized keys are _stripped_ from the parsed result: `Dog.parse({ name: "Yeller", extraKey: true }); // => { name: "Yeller" }`" — [`zod/docs/api.mdx:1180`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#L1180)

Rejecting a typo'd field needs `z.strictObject()`; Astro's content-collections guide never mentions it.

Library-agnosticism has **not** happened: a PR to accept any Standard Schema library was closed unmerged — [PR #15683](https://github.com/withastro/astro/pull/15683) (`"state": "closed"`, `"merged": false`). `main` still types the schema as Zod core: `export type BaseSchema = zCore.$ZodType;` ([`config.ts:72`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/config.ts#L72)).

### 1.3 Required/optional granularity

**Per-field, within a per-collection schema.** Zod properties are required unless wrapped: "mark optional properties with `.optional()`" — RFC 0027, [`:277`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L277). There is no collection-level requiredness knob and no path-scoped requiredness _inside_ a collection. Because the schema is a value, `.partial()` / `.required()` can flip it later (§1.4).

### 1.4 Partial override — the load-bearing question

**Astro offers nothing. Zod offers everything. The distinction matters.**

Astro's only statement on composition is a pass-through disclaimer:

> "All [Zod schema methods](/en/reference/modules/astro-zod/#using-zod-methods) (e.g. `.parse()`, `.transform()`) are available, with some limitations." — [`content-collections.mdx:376`](https://github.com/withastro/docs/blob/main/src/content/docs/en/guides/content-collections.mdx#L376)

Astro's `astro/zod` reference documents `.transform()`, `.refine()`, and error customization. It does **not** mention `.extend()`, `.merge()`, `.partial()`, or `.pick()` anywhere — the whole 120-line file ([`astro-zod.mdx`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/modules/astro-zod.mdx)) contains none of those names. **Composition is Zod's API leaking through a re-export, undocumented by the tool that ships it.**

What Zod itself provides, and what it costs:

- **`.extend()`** — add/overwrite fields. "the `.extend()` method can be expensive on large schemas, and due to [a TypeScript limitation] it gets quadratically more expensive when calls are chained." Zod steers users away: "**Alternative: spread syntax** — You can alternatively avoid `.extend()` altogether by creating a new object schema entirely. This makes the strictness level of the resulting schema visually obvious." — [`api.mdx:1311,1334`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#L1311)
- **`.safeExtend()`** — the only form that works on refined schemas: "(Regular `.extend()` will throw an error when used on schemas with refinements.)" — [`api.mdx:1338`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#L1338)
- **`.partial({ field: true })`** — **selectively relaxes required to optional**, the exact operation JSON Schema cannot express: `const RecipeOptionalIngredients = Recipe.partial({ ingredients: true }); // { title: string; description?: string | undefined; ingredients?: string[] | undefined }` — [`api.mdx:1456`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#L1456)
- **`.required({ field: true })`** — the inverse tightening — [`api.mdx:1532`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#L1532)

The crux: a code config can relax an inherited constraint _because composition is a function call on a value, not a merge of two documents_. There is no merge semantics to argue about; the "cascade" is just `const logs = docs.partial({ description: true })`. The cost is that the relationship between `docs` and `logs` is invisible unless you read and mentally execute the config, and that both must still be registered as **separate collections with separate glob patterns** — the relaxation attaches to a name, not to a path.

**Nested/hierarchical collections: not supported, ruled out in the original RFC.**

> "Collections are considered **one level deep**, so you cannot nest collections (or collection schemas) within other collections. However, we _will_ allow nested directories to better organize your content. […] All nested directories will share the same (optional) schema defined at the top level." — RFC 0027, [`:247`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L247)

The Content Layer RFC keeps the same definition: "**Collection**: A set of entries that share a common schema. Each entry has a unique ID." — RFC 0051, [`:90`](https://github.com/withastro/roadmap/blob/main/proposals/0051-content-layer.md#L90)

It _was_ requested. Roadmap discussion #801, "Enhancing Content Collection Structure in Astro" (2023-12-25), asks for `'course/chapters'` / `'course/lessons'` keys under a shared non-collection parent. Maintainer @bholmesdev replied twice:

> "We're exploring deeper changes to content collections right now to break out of the 'top-level directory' requirement. Noted" — 2024-01-09

> "Happy to share we overhauled collection configs for the new Content Layer. We introduced 'loaders' to unlock total flexibility over where your content lives. We include a `glob()` utility out-of-the-box to describe nested folder structures, which maps pretty well to the course > chapters > lessons schema you shared here. […] I'm also marking this discussion as 'closed.'" — 2024-11-12
>
> both at [roadmap#801](https://github.com/withastro/roadmap/discussions/801)

The resolution is explicit: **hierarchy is expressed by writing more glob patterns, not by nesting schemas.** The collection namespace stayed flat; only file selection got more expressive. Searching `withastro/roadmap` for `subcollection` / `"nested collection"` surfaces only the Content Layer and Incremental Builds issues — no open proposal for hierarchical schemas.

### 1.5 Data vs code — what the maintainers said

RFC 0027 considered and rejected a data-format config:

> "**Invent our own JSON or YAML-based schema format.** This would fall in-line with a similar open source project, [ContentLayer], which specifies types with plain JS. Main drawbacks: replacing one learning curve with another, and increasing the maintenance cost of schemas overtime.
>
> In the end, we've chosen Zod since it can scale to complex use cases and takes the maintenance burden off of Astro's shoulders." — RFC 0027, [`:541`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L541)

Read carefully, that is not an argument that code is better _for the user_. Two of three reasons are Astro-internal (maintenance cost; "off of Astro's shoulders"). The user-facing argument is only "replacing one learning curve with another" — a claim that a YAML schema DSL would be _no cheaper to learn_, not that it would be worse.

The RFC also rejected generating schemas from TypeScript types on capability grounds:

> "**Generate schemas from a TypeScript type.** […] However, TypeScript is missing a few surface-level features Zod covers: - Constraining the shape of a given value. For instance, setting a `min` or `max` character length, testing strings against `email` or `URL` regexes. - [Transforming] a frontmatter value into a new data type." — RFC 0027, [`:538`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L538)

And listed the cost it knowingly accepted, under **Drawbacks**: "1. **Zod means a new learning curve** for users already familiar with TypeScript. […] 2. **Magic is always scary,** especially with Astro's bias towards being explicit." — RFC 0027, [`:527`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L527)

Its own prediction of what users would write undercuts the power argument:

> "However, given frontmatter is limited to primitive types like strings and booleans, we expect new users to stick to simple `string()`, `number()`, and `boolean()` utilities." — RFC 0027, [`:311`](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L311)

Astro then re-derives a data artifact _from_ the code — a tacit admission that data is what tooling wants. Since 4.13.0 it emits JSON Schema per collection:

```ts
const schema = z.toJSONSchema(zodSchemaForJson, {
  unrepresentable: 'any',
  override: (ctx) => {
    /* date -> string / date-time */
  },
  // Collection schemas are used for parsing collection input, so we need to tell Zod to use the
  // input shape when generating a JSON schema.
  io: 'input',
});
```

— [`types-generator.ts:651`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/types-generator.ts#L651)

`unrepresentable: 'any'` makes the code→data projection lossy by construction: `.refine()` and `.transform()` degrade to `any`. The generated JSON Schema is an editor hint, not an equivalent of the source of truth.

### 1.6 Could an agent read the config cold and author correct frontmatter?

**Partly — it learns the shape reliably and the intent not at all.**

_Carried:_ types, cardinality, enum members, defaults, format constraints, all legible at a glance from `z.object({...})`.

_Not carried:_ nothing in Astro's documented surface asks for field intent. Neither the content-collections guide nor the `astro/zod` reference mentions `.describe()` or `.meta()` in a schema-authoring context (grepped both; no occurrences). Zod _does_ support prose metadata — "The `.describe()` method is a shorthand for registering a schema in `z.globalRegistry` with just a `description` field" ([`metadata.mdx:173`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/metadata.mdx#L173)), with `z.globalRegistry` accepting `id`/`title`/`description`/`deprecated`/arbitrary keys ([`metadata.mdx:86`](https://github.com/colinhacks/zod/blob/main/packages/docs/content/metadata.mdx#L86)), and `z.toJSONSchema()` carries those through. But it is opt-in, undocumented by Astro, and absent from every Astro example. In practice Astro configs carry types and rationale-free constraint numbers.

_Does the failure message teach?_ No.

```ts
export const InvalidContentEntryDataError = {
  title: 'Content entry data does not match schema.',
  message(collection: string, entryId: string, error: $ZodError) {
    return [
      `**${String(collection)} → ${String(entryId)}** data does not match collection schema.\n`,
      ...error.issues.map((issue) => `  **${issue.path.join('.')}**: ${issue.message}`),
      '',
    ].join('\n');
  },
  hint: 'See https://docs.astro.build/en/guides/content-collections/ for more information on content schemas.',
};
```

— [`errors-data.ts:1819`](https://github.com/withastro/astro/blob/main/packages/astro/src/core/errors/errors-data.ts#L1819)

`issue.message` comes from Zod's English locale: a missing field reads `Invalid input: expected string, received undefined` ([`en.ts:75`](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/locales/en.ts#L75)); a length violation reads `Too small: expected string to have >=40 characters` ([`en.ts:92`](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/locales/en.ts#L92)). The message names the field and the type; it never names the reason. The `hint` is a static link, identical for every failure. Astro does pass the raw YAML through `getYAMLErrorLine(entry._internal?.rawData, String(parsed.error.issues[0].path[0]))` ([`utils.ts`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/utils.ts), in `getEntryData`) so the error points at a line — location, not rationale.

Teaching messages _are_ possible but manual, via `.refine(fn, { error: "…" })` ([`astro-zod.mdx:100`](https://github.com/withastro/docs/blob/main/src/content/docs/en/reference/modules/astro-zod.mdx#L100)). The ceiling is high; every example Astro ships sits on the floor.

---

## 2. VitePress

**VitePress does not validate frontmatter at all** — no schema concept, no required fields, no error on unknown keys. What it does have, since 2.0.0-alpha.5, is a directory-scoped **defaults** cascade whose precedence and merge semantics are close to what the harness wants. Useless as a constraint precedent; unusually good as a _cascade_ precedent.

### 2.1 Binding

**Frontmatter is bound to nothing.** Parsed and handed through untyped:

> "VitePress supports YAML frontmatter in all Markdown files, parsing them with [gray-matter](https://github.com/jonschlinkert/gray-matter). […] You can also define custom frontmatter data of your own, to be used in dynamic Vue expressions on the page." — [`guide/frontmatter.md:9,23`](https://github.com/vuejs/vitepress/blob/main/docs/en/guide/frontmatter.md#L9)

The public type is open: `frontmatter: Record<string, any>` — [`types/shared.d.ts:66`](https://github.com/vuejs/vitepress/blob/main/types/shared.d.ts#L66)

**Site config, however, is path-bound** — by a co-located config file, not a glob:

> "Some config settings can be overridden at the directory level, allowing all pages in that directory to share the settings without needing to repeat them in the frontmatter of each page. This is achieved by adding a file called `config.ts` (or `.js`, `.mjs`, or `.mts`) in the relevant directory. […] Nested directories inherit the settings from the parent directory, and the configuration overrides are merged accordingly." — [`reference/site-config.md:145`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/site-config.md#L145)

Discovery is one glob over the source tree — `const additionalConfigGlob = \`**/config.{js,mjs,ts,mts}\`` ([`config.ts:38`](https://github.com/vuejs/vitepress/blob/main/src/node/config.ts#L38)) — keyed by directory prefix: `const id = normalizePath(\`/${path.dirname(file)}/\`)` ([`config.ts:206`](https://github.com/vuejs/vitepress/blob/main/src/node/config.ts#L206)). Resolution then walks the page's own path upward, collecting **every** ancestor's config:

```ts
function resolveAdditionalConfig({ additionalConfig }: SiteData, path: string): AdditionalConfig[] {
  if (additionalConfig === undefined) return [];
  if (typeof additionalConfig === 'function') return additionalConfig(path) ?? [];
  const configs: AdditionalConfig[] = [];
  const segments = path.split('/').slice(0, -1); // remove file name
  while (segments.length) {
    const key = `/${segments.join('/')}/`;
    configs.push(additionalConfig[key]);
    segments.pop();
  }
  configs.push(additionalConfig['/']);
  return configs.filter((config) => config !== undefined);
}
```

— [`shared.ts:296`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L296)

Multiple configs matching one file is the _design_, not an edge case. By contrast the default theme's `sidebar` object is path-keyed **single-winner** (`'/guide/': [...]`, `'/config/': [...]` — "This sidebar gets displayed when a user is on `guide` directory", [`default-theme-sidebar.md`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/default-theme-sidebar.md)). The same product ships both models for different concerns.

### 2.2 Constraint vocabulary

**There is none.** GitHub code search of `vuejs/vitepress` for `path:src frontmatter schema` returns `"total_count": 0`; `path:docs/en frontmatter validation` returns `"total_count": 0`. The frontmatter reference is a list of keys VitePress _reads if present_ — `title`, `titleTemplate`, `description`, `head`, `layout`, `navbar`, `sidebar`, `editLink`, `lastUpdated`, `outline`, `prev`/`next`, `aside`, `pageClass` — each documented as a type and an override relationship, never as a constraint:

> "Frontmatter enables page based configuration. In every markdown file, you can use frontmatter config to override site-level or theme-level config options. Also, there are config options which you can only define in frontmatter." — [`reference/frontmatter-config.md:8`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/frontmatter-config.md#L8)

Nothing enforces `title` being a string; `inferTitle` merely guards at read time (`if (typeof frontmatter.title === 'string')`, [`markdownToVue.ts:349`](https://github.com/vuejs/vitepress/blob/main/src/node/markdownToVue.ts#L349)). A misspelled key is silently ignored.

Two escape hatches, both arbitrary user code:

- `transformPageData` — "a hook to transform the `pageData` of each page. You can directly mutate `pageData` or return changed values which will be merged into the page data." Type `(pageData: PageData, context: TransformPageContext) => Awaitable<Partial<PageData> | { [key: string]: any } | void>` — [`site-config.md:721`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/site-config.md#L721). Throwing from it would be the only way to fail a build on bad frontmatter; **I could not establish from a primary source that VitePress documents or guarantees that behaviour.**
- `createContentLoader('posts/*.md')` — glob → `ContentData[]` with `frontmatter: Record<string, any>` and an optional `transform`, for index pages — [`guide/data-loading.md:86`](https://github.com/vuejs/vitepress/blob/main/docs/en/guide/data-loading.md#L86). Access, not validation.

### 2.3 Required/optional granularity

Not applicable — no requiredness exists. The nearest analogue is _defaulting_: site config → locale config → directory config → frontmatter each supply a value if the page omits one. Nothing can insist the page supply one itself.

### 2.4 Partial override

**Yes: per-key, at the leaf, deepest-wins.** Page-time resolution stacks the layers deepest-first — `return stackView<SiteData>(topLayer, ...additionalConfigs, localeConfig, siteData)` ([`shared.ts:152`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L152)):

```ts
/**
 * Creates a deep, merged view of multiple objects without mutating the originals.
 * Returns a readonly proxy behaving like a merged object of the input objects.
 * Layers are merged in descending precedence, i.e. the earlier layer is on top.
 */
export function stackView<T extends ObjectType>(..._layers: Partial<T>[]): T {
  const layers = _layers.filter((layer) => isObject(layer))
  if (layers.length <= 1) return _layers[0] as T
  ...  // Proxy get() recurses: stackView(...layers.map((l) => l[prop]))
```

— [`shared.ts:332`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L332)

Consequences read off that code:

- **Objects deep-merge; scalars and arrays replace.** `isObject` is `Object.prototype.toString.call(value) === '[object Object]'` ([`shared.ts:378`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L378)), so an array is a leaf and a deeper directory's array wholly replaces the shallower one.
- **A subdirectory overrides only the keys it names.** It never restates the parent. This is exactly the property the harness wants.
- `head` is the one key with append-with-dedupe semantics, hoisted into `topLayer` via `mergeHead` and documented: "Head entries from the site config, locale config, directory-level config, frontmatter and `transformHead` are merged in that order. A later entry replaces an earlier one with the same key instead of being appended." — [`site-config.md:251`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/site-config.md#L251)

**Un-setting is where it breaks, and the two merge paths disagree.** The `extends` merge drops nullish values, so a child cannot clear a parent key:

```ts
export function mergeConfig<A extends object, B extends object>(a: A, b: B, isRoot = true): A & B {
  const merged: Record<string, any> = { ...a }
  for (const key in b) {
    const value = b[key]
    if (value == null) { continue }                     // cannot un-set
    const existing = merged[key]
    if (Array.isArray(existing) && Array.isArray(value)) {
      merged[key] = [...existing, ...value]             // arrays CONCATENATE here
      continue
    }
```

— [`config.ts:299`](https://github.com/vuejs/vitepress/blob/main/src/node/config.ts#L299)

whereas `stackView` filters only non-objects, so an explicit `null` **does** win. The same product therefore has arrays that concatenate under `extends` and replace under the directory cascade, and `null` that is ignored under one and honoured under the other. I found no documentation of this divergence; it is read off the two implementations.

### 2.5 Data vs code

The directory config is a JS/TS module — `export default defineAdditionalConfig({...})` — but its content is plain data, and the helper is types-only: "The `defineAdditionalConfig` helper can be used to get TypeScript-powered intellisense for the available options, though its use is optional." ([`site-config.md:145`](https://github.com/vuejs/vitepress/blob/main/docs/en/reference/site-config.md#L145)). The only genuine code-ness is that `additionalConfig` may itself be a function `(path) => AdditionalConfig[]` ([`shared.ts:300`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L300)).

**I found no maintainer statement weighing data against code for VitePress frontmatter.** The originating feature request argues against _centralisation_, not against data formats:

> "Currently, a `vitepress` site is configured through a centralized monolithic configuration entry. This makes it difficult to apply fine grained configuration alternation to specific part of the website. […] We can instead provide a distributed configuration hierarchy based on the same folder structure used to organize markdown contents." — [vitepress#4659](https://github.com/vuejs/vitepress/issues/4659), implemented by [PR #4660 "Hierarchical site configuration using distributed config files"](https://github.com/vuejs/vitepress/pull/4660), merged 2025-04-15, shipped in `2.0.0-alpha.5` ([CHANGELOG](https://github.com/vuejs/vitepress/blob/main/CHANGELOG.md))

That is a _locality_ argument, orthogonal to the data/code axis. The harness's single-file `okf-config.yml` takes the opposite position on locality while agreeing on cascade.

### 2.6 Could an agent read the config cold and author correct frontmatter?

**No, because there is nothing to read.** VitePress config declares site _defaults_, not page _obligations_. An agent inspecting `docs/es/config.ts` learns that pages under `es/` get a Spanish description; it learns nothing about what such a page must contain. The authoritative answer to "what frontmatter should this page have?" lives only in `frontmatter-config.md` — prose on a website, not in the repo being authored. There is no validation failure message because there is no validation; bad frontmatter renders wrong or is silently ignored.

The one genuinely instructive mechanism VitePress ships is a **dev-mode provenance dump**:

```ts
function reportConfigLayers(path: string, layers: Partial<SiteData>[]) {
  const summaryTitle = `Config Layers for ${path}:`;
  const summary = layers.map((c, i, arr) => {
    const n = i + 1;
    if (n === arr.length) return `${n}. .vitepress/config (root)`;
    return `${n}. ${(c as any)?.[VP_SOURCE_KEY] ?? '(Unknown Source)'}`;
  });
  console.debug([summaryTitle, ''.padEnd(summaryTitle.length, '='), ...summary].join('\n'));
}
```

— [`shared.ts:317`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L317), gated on `inBrowser && (import.meta as any).env?.DEV` ([`shared.ts:135`](https://github.com/vuejs/vitepress/blob/main/src/shared/shared.ts#L135))

That answers "why is this rule applying to my file?", the second question an agent asks after "what rule applies?".

---

## 3. Implications for the harness

1. **Neither tool offers a constraint cascade.** Astro offers composition-in-code; VitePress offers a defaults cascade. The harness's design — path-scoped rules, ordered, merging at the leaf, deeper rules able to relax — is a hybrid with no direct precedent in either. Worth knowing before assuming a settled pattern exists to copy.

2. **Copy `stackView`'s shape, not its bugs.** "Layers merged in descending precedence; objects recurse, everything else is a leaf" is the right primitive and is ~15 dependency-free lines. Take the explicit lesson from VitePress's two divergent merge paths: **decide once, in the ADR, what `null` means and what arrays do.** VitePress got both wrong by having two answers.

3. **Relaxation is what code buys you, and it is cheap to buy in data.** Zod relaxes because `.partial({ description: true })` is a function call on a value; JSON Schema cannot because `allOf` is a conjunction. Neither fact constrains the harness: an ordered cascade over rule _objects_ relaxes trivially (`description: { required: false }` in a later rule) precisely because it is not a logical conjunction. Declarative YAML does not cost the harness the relaxation Astro gets from Zod, provided merge is per-key and last-wins.

4. **Overlap must be a decided question, not an emergent one.** Astro lets two collections silently claim the same file, producing two independently validated copies with no diagnostic ([`content-layer.ts:286`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/content-layer.ts#L286), [`data-store.ts:85`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/data-store.ts#L85)), and nobody has filed an issue in four years. The harness's cascade makes overlap meaningful rather than undefined — stronger, but it means rule authors need to see the resolved set. Ship the equivalent of `reportConfigLayers`: given a file, print the ordered list of rules that matched and the final merged constraint. Cheap, and the highest-leverage self-teaching feature either tool demonstrates.

5. **Both tools fail the "author correct frontmatter from the config alone" test, for opposite reasons.** Astro's config carries types with no intent — `description: z.string().min(40)` never says why 40 — and the failure message is `Too small: expected string to have >=40 characters` ([`en.ts:92`](https://github.com/colinhacks/zod/blob/main/packages/zod/src/v4/locales/en.ts#L92)), restating the constraint rather than the purpose. VitePress carries no constraint at all. Neither uses a `.describe()`-equivalent in _any_ shipped example. The harness has a free win: make a prose `why` field on each constraint conventional in the config and **echo it verbatim in the violation message**. That single decision puts it ahead of both.

6. **Astro's own behaviour argues that data is what tooling wants.** It chose Zod, then had to project back down to JSON Schema for editors — `z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' })` ([`types-generator.ts:651`](https://github.com/withastro/astro/blob/main/packages/astro/src/content/types-generator.ts#L651)) — losing every `.refine()` and `.transform()`. Starting from data avoids the lossy round trip. What it gives up is precisely `.refine()`: arbitrary cross-field predicates. Given the harness's "generic, never type-aware" vocabulary rule already forbids that class of check, the loss is already accepted and should be stated rather than rediscovered.

7. **The maintainer quote to carry into the ADR.** Astro rejected a YAML schema format with: "Main drawbacks: replacing one learning curve with another, and increasing the maintenance cost of schemas overtime. In the end, we've chosen Zod since it can scale to complex use cases and takes the maintenance burden off of Astro's shoulders" ([RFC 0027:541](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L541)). Two of three reasons are about _Astro's_ burden, not the user's. The harness has the opposite constraint set — no third-party libraries in `.rules.ts`, so "off our shoulders" is unavailable and the maintenance cost lands on the harness either way. Astro's own RFC also predicted its users would only ever need `string()`, `number()`, `boolean()` ([RFC 0027:311](https://github.com/withastro/roadmap/blob/main/proposals/0027-content-collections.md#L311)) — roughly the vocabulary a YAML config expresses natively. The strongest argument for Zod does not transfer; the strongest argument against YAML was never a strong one.
