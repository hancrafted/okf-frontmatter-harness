/**
 * Ambient types for `okf-config.yml`, the harness's one configuration file.
 *
 * HAND-WRITTEN. archgate does not generate this file, and `npm run verify`
 * does not diff it. The generated typings are the sibling `rules.d.ts`, which
 * IS guarded by `git diff --exit-code`. Edit this one freely; edit that one
 * never.
 *
 * A `.rules.ts` reaches these types the same way it reaches archgate's:
 *
 *     /// <reference path="../okf-config.d.ts" />
 *
 * A triple-slash reference is a comment, so the rule-file security scanner
 * cannot object to it. An `import` — including `import type` — would be
 * refused. That is why everything here is `declare`d into the global scope
 * rather than exported.
 *
 * Nothing here describes the Floor. The Floor is not configurable, so it has
 * no representation in the config and therefore none in this file. See
 * CONTEXT.md.
 */

// ---------------------------------------------------------------------------
// The config file
// ---------------------------------------------------------------------------

/**
 * The parsed contents of `okf-config.yml`.
 *
 * One file, at the repo root, no nesting and no fallback filenames — a second
 * config would need a precedence rule *between* files, which is the second
 * precedence dimension this design exists to avoid.
 *
 * Unknown top-level keys are a config error, so gaining a key later is a
 * deliberate amendment rather than an accident.
 */
declare interface OkfConfig {
  /**
   * The repo's Type vocabulary, maintained as master data.
   *
   * Optional. A repo that declares none gets no membership check at all — only
   * the Floor's requirement that `type` be present and a non-empty string.
   * Declaring one closes the set, which is stricter than OKF (§4.1 Frontmatter
   * leaves type values unregistered, and §11 Conformance forbids a *consumer*
   * rejecting over them), so closing it is always the repo's own choice about
   * its own files.
   *
   * Where this list exists it is a ceiling: a rule-level `types` must be a
   * subset of it. Where it does not, a rule-level `types` stands alone.
   */
  types?: OkfTypeRecord[];

  /**
   * The ordered rule list. REQUIRED, and must be a list rather than a mapping:
   * YAML mappings have no guaranteed order, and first-match needs one.
   *
   * For any file the harness walks top-down and the FIRST matching rule is the
   * complete set of constraints that applies. Nothing merges, nothing is
   * inherited. Write the most specific rules first and the broadest last;
   * reversed, a narrow rule silently wins for zero files.
   *
   * An empty list is a config error, not an inert harness.
   */
  rules: OkfRule[];
}

/**
 * One document kind the repo recognises.
 *
 * A list of records rather than a mapping, for a measured reason: a YAML
 * mapping silently keeps the last of two duplicate keys, and this is a file
 * agents append to. A list preserves the duplicate so the validator can report
 * it. Records also let a kind gain fields later without a breaking change.
 *
 * There is no bare-string shorthand: `types: [adr, guide]` is invalid.
 */
declare interface OkfTypeRecord {
  /** The value that appears in a document's `type` frontmatter key. */
  name: string;

  /**
   * What this kind IS, in one sentence.
   *
   * Optional, but `intent: ""` and a bare `intent:` are both config errors —
   * writing the key and saying nothing is worse than omitting it.
   *
   * This prose is rendered: a failed membership check prints the whole allowed
   * set with each value's `intent`, uncapped, including values that have none.
   * A partial map must never become the display source.
   */
  intent?: string;
}

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

/**
 * One entry in the ordered rule list.
 *
 * Every rule = a selector + a reason + a payload. The two exclusivity rules
 * the config validator enforces are modelled here so the illegal states are
 * unrepresentable rather than merely undocumented:
 *
 *   - exactly one of `path` / `fileName`
 *   - `frontmatter: forbidden` carries no payload at all
 */
declare type OkfRule = OkfRuleCommon & OkfRuleSelector & OkfRulePayload;

/** Keys every rule carries, whatever it selects and whatever it asserts. */
declare interface OkfRuleCommon {
  /**
   * Why this rule exists, in the config author's own words. MANDATORY.
   *
   * Appended to every violation this rule reports — never substituted for the
   * harness's own sentence, so an author cannot write prose that hides which
   * constraint fired. A constraint-level `intent` wins over this one for that
   * constraint; this is the fallback.
   */
  intent: string;

  /**
   * Paths this rule does NOT govern, as globs.
   *
   * Per rule, never global — a global exclude list could not express "exempt
   * from *this* rule only", so an excluded file could never pick up a rule of
   * its own. Exclusion always wins within a rule, and takes no part in
   * ordering: it answers one yes/no question before any rule is chosen.
   *
   * Invalid without a selector on the same rule. Its only real use under
   * first-match is letting a file fall THROUGH to a later, broader rule
   * without restating that rule's constraints.
   */
  excludeFiles?: OkfGlob[];
}

/**
 * How a rule selects files. Exactly one of the two.
 *
 * `fileName` is defined as sugar: `fileName: "log.md"` desugars to
 * `path: ["**\/log.md"]`. Everything is a path glob underneath, so precedence
 * stays one-dimensional and the resolver keeps one code path.
 */
declare type OkfRuleSelector = { path: OkfGlob[]; fileName?: never } | { fileName: string; path?: never };

/**
 * What a rule asserts. Either it forbids frontmatter outright, or it
 * constrains it — never both.
 */
declare type OkfRulePayload = OkfConstrainingPayload | OkfNoFrontmatterPayload;

/** A rule that constrains the frontmatter of the files it matches. */
declare interface OkfConstrainingPayload {
  frontmatter?: never;

  /**
   * The document kinds permitted on these paths — an allowlist, never a match
   * guard. A file whose `type` is outside it is REPORTED, not skipped.
   *
   * A flat list of names: the top level *defines* the vocabulary, a rule
   * *references* a subset of it. Must subset a declared global `types`; stands
   * alone where none is declared.
   *
   * This is the only spelling. `fields: { type: { allowed: [...] } }` is a
   * config error, because it says the same thing while evading the subset
   * check.
   */
  types?: string[];

  /**
   * Constraints on individual frontmatter fields, keyed by field address.
   *
   * The container is load-bearing. Flat, these keys would be siblings of
   * `path`, `intent`, `types`, `unknownKeys` and every key added later —
   * confiscating those names from every adopter's frontmatter forever, and
   * putting `type` one letter from `types` at the same level. Under a
   * container, a key in the wrong half is a reportable config error instead of
   * a silent no-op.
   */
  fields?: Record<OkfFieldAddress, OkfFieldConstraints>;

  /**
   * Whether frontmatter keys this rule does not name are permitted.
   *
   * Defaults to `allowed` when absent, because OKF is permissive: §4.1
   * (Frontmatter) says producers MAY include any additional keys, and §11
   * (Conformance) says consumers MUST NOT reject documents with unrecognized
   * fields. Closing the set is therefore a repo choosing to be stricter than
   * OKF about its own files — the same shape as declaring a Type vocabulary,
   * and never a divergence.
   */
  unknownKeys?: OkfUnknownKeys;

  /** Exactly one of these fields must be present. */
  exactlyOneOf?: OkfFieldAddress[];
  /** At least one of these fields must be present. */
  anyOf?: OkfFieldAddress[];
  /** All of these fields must be present. */
  allOf?: OkfFieldAddress[];
}

/**
 * A rule declaring its paths frontmatter-free.
 *
 * This is the Floor's one and only escape, and it is forced rather than
 * chosen: "carries no frontmatter" and "must carry `type`" are contradictory
 * demands, so unrelaxability survives everywhere except where it contradicts
 * itself.
 *
 * Its corollary: "governed but type-free" is inexpressible. A file that must
 * be checked for one key and no others has to be left ungoverned instead.
 *
 * Every payload key is excluded — each would assert something about
 * frontmatter that must not exist.
 */
declare interface OkfNoFrontmatterPayload {
  frontmatter: 'forbidden';
  types?: never;
  fields?: never;
  unknownKeys?: never;
  exactlyOneOf?: never;
  anyOf?: never;
  allOf?: never;
}

/** The only legal value of `unknownKeys`. `allowed` is also the default. */
declare type OkfUnknownKeys = 'allowed' | 'forbidden';

// ---------------------------------------------------------------------------
// Field constraints
// ---------------------------------------------------------------------------

/**
 * A glob, matched against repo-root-relative paths.
 */
declare type OkfGlob = string;

/**
 * A frontmatter field address.
 *
 * Reaches exactly one level into nested shapes, which is not a nicety: of the
 * spec's `MUST`/`REQUIRED` lines, exactly two bind a producer's optional
 * frontmatter — `generated.by` and `sources[].resource` — and both are nested.
 * A top-level-only vocabulary could enforce nothing OKF requires beyond
 * `type`.
 *
 *   description          a top-level key
 *   generated.by         a key inside a mapping
 *   sources[].resource   a key inside EVERY entry of a list
 *
 * The bracket notation is OKF's own: the Pinned revision writes
 * `sources[].id` (§5.1 Provenance: `sources`), `sources[].resource` twice
 * (§6.2 Path-valued fields) and `verified[].by` (§7 Actor convention). It is
 * adopted, not invented — other path languages disagree with each other and
 * with themselves.
 *
 * Addressing a list entry and addressing the list itself are different
 * addresses, so a per-entry constraint and a container constraint never share
 * a shape:
 *
 *   sources:            { minItems: 1 }        the list
 *   sources[].resource: { presence: required } every entry
 */
declare type OkfFieldAddress = string;

/**
 * What must be true of one field.
 *
 * Every key is optional; a constraint object stating nothing is a config
 * error. Keys are shape-specific by construction — `minLength` names strings,
 * `minItems` names lists — which is what keeps this vocabulary out of
 * Laravel's trap, where a shape-agnostic `min:18` silently meant "18 digits".
 */
declare interface OkfFieldConstraints {
  /**
   * Whether the field must appear.
   *
   * `required` means PRESENT AND NON-EMPTY, which is why there is no
   * `minLength: 1` anywhere — the Floor already requires `type` to be a
   * non-empty string, so that is the meaning this harness has committed to.
   *
   * Three named states rather than a boolean: `required: false` genuinely
   * reads both as "may be absent" and "must be absent".
   */
  presence?: 'required' | 'optional' | 'forbidden';

  /** Minimum length, STRINGS ONLY. A three-item list does not satisfy `minLength: 3`. */
  minLength?: number;
  /** Maximum length, strings only. */
  maxLength?: number;

  /** One of the named formats. */
  format?: OkfFormat;

  /**
   * A regular expression the value must match.
   *
   * A checking function is structurally impossible here — the rule-file
   * scanner blocks `eval`, `Function`, `Reflect` and `.constructor` — so this
   * is the only expressiveness valve that can exist, and dropping it would
   * make anything outside the named formats inexpressible forever.
   *
   * A sibling `intent` is MANDATORY whenever this is present, and it is what
   * the violation reports. Without it the raw regex leaks into the message —
   * the failure Kubernetes accepts (`"failed rule: {Rule}"`) and VS Code
   * bolted `patternErrorMessage` on to avoid.
   */
  pattern?: string;

  /** Minimum number of entries, LISTS ONLY. */
  minItems?: number;
  /** Maximum number of entries, lists only. */
  maxItems?: number;
  /** Maximum length of each entry of a list of strings. */
  itemMaxLength?: number;

  /**
   * A closed set of permitted values. Replaces wholesale, never appends — an
   * appending allowlist could only ever widen, which makes it useless as a
   * restriction.
   *
   * A config error on the `type` field: `types` is the only spelling there.
   */
  allowed?: (string | number | boolean)[];

  /**
   * Why THIS constraint exists. Optional, except mandatory alongside
   * `pattern`.
   *
   * Wins over the rule's `intent` for violations of this field. Appended to
   * the harness's own message, never substituted for it.
   */
  intent?: string;
}

/**
 * The named formats. Not sugar — the Floor needs all three, and `actor` is the
 * clearest case for a name over a regex: it is a three-way alternation that is
 * unreadable written out and self-evident written as `format: actor`.
 */
declare type OkfFormat =
  /** ISO 8601 with an explicit UTC offset (§5 Provenance, trust, and lifecycle). */
  | 'datetime'
  /** A path or URI (§4.1 Frontmatter; §5.1 Provenance: `sources`). */
  | 'uri'
  /** `<producer>/<version>` | `human:<id>` | `process:<id>` (§7 Actor convention). */
  | 'actor';

// ---------------------------------------------------------------------------
// Known shapes — harness internals, never written in the config
// ---------------------------------------------------------------------------

/**
 * The shape OKF gives a key it defines.
 *
 * Built into the harness because it belongs to the interface rather than to a
 * repo's taste. NOT a constraint, and never fires on its own: it decides what
 * a constraint the config DID write means, and rejects a config whose
 * constraint contradicts it (`minLength: 5` on `tags` is a config error, not a
 * silent pass — JSON Schema Core §7.6.1 silently passes, and Rails silently
 * coerces).
 *
 * Declared here rather than in a rules file because the rule-file scanner
 * blocks relative imports, so every `.rules.ts` needs its own copy of the
 * table. The VALUES stay duplicated; typing them against one declaration makes
 * a divergence between the copies a compile error.
 */
declare type OkfShape =
  | 'string'
  | 'number'
  | 'boolean'
  | 'list'
  | 'mapping'
  /** `verified` only: a bare mapping is normalised to a one-element list. */
  | 'mapping-or-list';

/** Every frontmatter address OKF defines, top level and one level in. */
declare type OkfDefinedAddress =
  | 'type'
  | 'title'
  | 'description'
  | 'resource'
  | 'tags'
  | 'status'
  | 'stale_after'
  | 'generated'
  | 'generated.by'
  | 'generated.at'
  | 'verified'
  | 'verified[].by'
  | 'verified[].at'
  | 'sources'
  | 'sources[].id'
  | 'sources[].title'
  | 'sources[].author'
  | 'sources[].resource'
  | 'sources[].last_modified'
  | 'sources[].usage_count'
  | 'usage_window'
  | 'usage_window.from'
  | 'usage_window.to';

/**
 * The known-shape table. Total over `OkfDefinedAddress`, so a rules file that
 * omits or misspells an entry fails to compile.
 */
declare type OkfKnownShapes = Readonly<Record<OkfDefinedAddress, OkfShape>>;

/**
 * The six timestamp-valued keys OKF defines, exhaustively. Producer-defined
 * date-ish keys are NOT sniffed — sniffing would break the harness's
 * permissiveness toward fields OKF does not define.
 */
declare type OkfTimestampAddress = Extract<
  OkfDefinedAddress,
  'generated.at' | 'verified[].at' | 'sources[].last_modified' | 'usage_window.from' | 'usage_window.to' | 'stale_after'
>;

/**
 * The three addresses that carry an Actor, and so are checked for actor FORM
 * (never for actor correctness — whether content was hand-authored is
 * unknowable from the file).
 */
declare type OkfActorAddress = Extract<OkfDefinedAddress, 'generated.by' | 'verified[].by' | 'sources[].author'>;
