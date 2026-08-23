# Symlink Detection Under Archgate 0.55.0

Research question (issue [#2](https://github.com/hancrafted/okf-frontmatter-harness/issues/2)): `GEN-001`'s
`adr-claude-rules-symlink` rule detected a symlink by a behavioural signature —
`ctx.glob` lists it but `ctx.readFile` throws on it. Archgate 0.51.0 shipped
`fix(engine): allow symlinks that resolve inside the project root`, so `readFile`
now succeeds on every valid runtime symlink and the rule reports each one as a
forbidden copied body. `archgate check` is red for exactly this reason.

**Can a rule under 0.55.0 still tell a symlink from a copy — and if not, what can
still be asserted?**

Every fact below was established by running the installed binary
(`~/.archgate/bin/archgate`, `0.55.0`) against purpose-built probe rules in
throwaway scratch projects under `/tmp`, plus one probe against a full copy of
this repository. All output is quoted verbatim. Where a claim rests on
documentation rather than experiment, the source is named.

---

## 0. Bottom line

**YES — the runtime-entry rule can still assert, and it can still distinguish a
symlink from a copy.**

There is exactly one live, working-tree-accurate discriminator on the 0.55
`RuleContext` surface:

> With `respectGitignore: false` in the ADR frontmatter, `ctx.glob()`,
> `ctx.grepFiles()` and `ctx.scopedFiles` **omit symlinks entirely**, while
> `ctx.readFile()` still resolves them.

So `readFile` succeeds **and** the path is absent from `glob` ⇒ symlink.
`readFile` succeeds **and** the path is present in `glob` ⇒ regular file, i.e. a
forbidden copy. This is the exact inverse of the pre-0.51 signature, and unlike
the pre-0.51 signature it catches a **freshly-made, byte-identical copy**.

A second, weaker discriminator exists: `ctx.fileAtBase()` returns the _link
target string_ for a committed symlink (git stores mode `120000` with the target
as the blob) but the _file content_ for a regular file. It only sees the merge
base, not the working tree.

Under default frontmatter (`respectGitignore` unset), **no** `RuleContext` method
distinguishes an in-root symlink from a byte-identical regular file.

Both discriminators are **undocumented**. The `respectGitignore` one is the same
class of emergent behavioural signature that inverted under us in 0.51.
Section 7 proposes a canary that makes the next inversion fail loudly instead of
silently.

---

## 1. Summary matrix — every `RuleContext` method against a symlink

Fixture: `target/real.md` (regular, 57 bytes), `links/link-rel.md`
(`-> ../target/real.md`), `copies/copy.md` (byte-identical regular copy).
Full probe project: `/tmp/.../scratchpad/symprobe`.

| Method                                        | On regular file              | On in-root symlink                                                   | Discriminates?              |
| --------------------------------------------- | ---------------------------- | -------------------------------------------------------------------- | --------------------------- |
| `ctx.glob()` — default                        | listed                       | listed identically                                                   | **No**                      |
| `ctx.glob()` — `respectGitignore: false`      | listed                       | **omitted**                                                          | **YES**                     |
| `ctx.grepFiles()` — default                   | matches                      | matches, reports link path                                           | **No**                      |
| `ctx.grepFiles()` — `respectGitignore: false` | matches                      | **never scanned**                                                    | **YES**                     |
| `ctx.scopedFiles` — default                   | present                      | present                                                              | **No**                      |
| `ctx.scopedFiles` — `respectGitignore: false` | present                      | **absent**                                                           | **YES**                     |
| `ctx.changedFiles`                            | present when changed         | present when changed (git-derived, unaffected by `respectGitignore`) | **No**                      |
| `ctx.readFile()`                              | content                      | **content** (follows the link)                                       | **No**                      |
| `ctx.grep()`                                  | matches, `file` = given path | matches, `file` = given path                                         | **No**                      |
| `ctx.readJSON()`                              | parsed                       | parsed                                                               | **No**                      |
| `ctx.readYAML()`                              | parsed                       | parsed                                                               | **No**                      |
| `ctx.ast()` (working tree)                    | tree                         | tree                                                                 | **No**                      |
| `ctx.ast(…, { rev: 'base' })`                 | tree                         | **throws** (parses the target path string)                           | **YES**, code files only    |
| `ctx.fileAtBase()`                            | file content at base         | **the link target string**                                           | **YES**, base revision only |
| `ctx.checkCase()`                             | pure, no I/O                 | pure, no I/O                                                         | **No**                      |
| `ctx.projectRoot`                             | —                            | canonical (`/private/tmp/…`), no link info                           | **No**                      |

---

## 2. Q1 — Can any `RuleContext` method distinguish a symlink from a regular file?

### 2.1 Under default frontmatter: no

Probe `probe-perpath` dumped `readFile` / `grep` / `fileAtBase` for every fixture
path. The relevant rows:

```
PATH target/real.md
  readFile   = OK[len=57 head="---\nkind: real\nn: 1\n---\nREAL B"]
  grep       = OK[matches=6]
PATH copies/copy.md
  readFile   = OK[len=57 head="---\nkind: real\nn: 1\n---\nREAL B"]
  grep       = OK[matches=6]
PATH links/link-rel.md
  readFile   = OK[len=57 head="---\nkind: real\nn: 1\n---\nREAL B"]
  grep       = OK[matches=6]
```

`glob` lists the symlink beside the real files with no marker:

```
glob("**/*.md") = OK[n=10 :: .archgate/adrs/GEN-001-probe.md | copies/copy.md |
  copies/stale.md | links/link-abs.md | links/link-bounce.md | links/link-out.md |
  links/link-rel.md | links/new-copy.md | links/new-link.md | target/real.md]
```

The parsers are equally blind — `probe-parsers`:

```
readJSON(target/real.json) = OK[{"kind":"real","n":1}]
readJSON(links/link.json)  = OK[{"kind":"real","n":1}]
readYAML(target/real.md)   = OK[{"frontmatter":{"kind":"real","n":1},"content":"REAL BODY LINE\nNEEDLE_TOKEN here"}]
readYAML(links/link-rel.md)= OK[{"frontmatter":{"kind":"real","n":1},"content":"REAL BODY LINE\nNEEDLE_TOKEN here"}]
readYAML(copies/copy.md)   = OK[{"frontmatter":{"kind":"real","n":1},"content":"REAL BODY LINE\nNEEDLE_TOKEN here"}]
ast(target/real.ts,'typescript') = OK[Program body=1]
ast(links/link.ts,'typescript')  = OK[Program body=1]
```

`grep` reports the path it was _given_, not the resolved path, so there is no
realpath leak:

```
grep('links/link-rel.md') = OK[n=1 :: links/link-rel.md:6:1]
grep('target/real.md')    = OK[n=1 :: target/real.md:6:1]
grepFiles(**/*.md) = OK[n=8 :: copies/copy.md:6:1 | copies/stale.md:6:1 |
  links/link-abs.md:6:1 | links/link-bounce.md:6:1 | links/link-rel.md:6:1 |
  links/new-copy.md:6:1 | links/new-link.md:6:1 | target/real.md:6:1]
```

Path-traversal tricks are closed too. Archgate normalises the path **lexically**
before it reaches the filesystem, so the classic `link/..` → target's-parent
resolution never happens:

```
readFile(links/link-rel.md/x)            = THROW[ENOTDIR: not a directory, open '…/links/link-rel.md/x']
readFile(links/link-rel.md/../real.md)   = THROW[ENOENT: no such file or directory, open '…/links/real.md']
```

(The second would have resolved to `target/real.md` on a real filesystem; the
`ENOENT` on `links/real.md` proves lexical normalisation. A regular file
produces the identical pair of errors.)

There is no escape hatch either — rule files are scanned before execution:

```
=== RULE security-scan error err: ADR GEN-001: rule file blocked by security scanner (7 violations)
Reference to the "globalThis" global is blocked in rule files. Rules reach the
project only through the RuleContext API (ctx); naming a runtime global — even to
alias, destructure, or reflect over it — is not permitted.
Dynamic import of "node:fs" is blocked in rule files. Only node:path, node:url,
node:util, node:crypto may be imported; use the RuleContext API for filesystem,
subprocess, and network access.
```

So `lstat`/`readlink` are unreachable by any route. Confirmed: `strings` over
the 0.55.0 binary shows `lstat` (29), `readlink` (25) and `isSymbolicLink` (7)
present in the Bun runtime, but none of it is surfaced to rules.

### 2.2 `respectGitignore: false` — the working discriminator

This is the headline finding. The same probe run twice, changing only the ADR
frontmatter. `links/` contains six symlinks and one regular file
(`links/new-copy.md`).

**Default (`respectGitignore` absent):**

```
glob("links/*")    = OK[n=10 :: links/link-abs.md | links/link-bounce.md | links/link-out.md |
  links/link-rel.md | links/link.json | links/link.ts | links/link.yaml | links/linkdir |
  links/new-copy.md | links/new-link.md]
glob("links/*.md") = OK[n=6 :: links/link-abs.md | links/link-bounce.md | links/link-out.md |
  links/link-rel.md | links/new-copy.md | links/new-link.md]
grepFiles(/NEEDLE_TOKEN/, 'links/*.md') = THROW[Path "links/link-out.md" resolves outside
  the project through symbolic link "link-out.md" — access denied]
readFile(links/link-rel.md) = OK[len=57]
```

**`respectGitignore: false`:**

```
glob("links/*")    = OK[n=1 :: links/new-copy.md]
glob("links/*.md") = OK[n=1 :: links/new-copy.md]
grepFiles(/NEEDLE_TOKEN/, 'links/*.md') = OK[n=1 :: links/new-copy.md]
readFile(links/link-rel.md) = OK[len=57]
```

Every symlink vanishes from `glob` and `grepFiles`; the one regular file
survives; `readFile` still follows the links. `scopedFiles` shows the same split
(`links/new-copy.md` is the only `links/` entry that remains).

The vanishing is **not** a gitignore effect: `links/link-rel.md` is tracked
(`git ls-files -s` shows `120000 40f0c65… links/link-rel.md`), and with
`respectGitignore: false` the gitignore filter is off entirely — the same run
newly _includes_ `.git/**` and `gitignored/ig.md`. The scanner archgate uses
when it does not need gitignore semantics simply does not emit symlink dirents.

Both freshly-created and long-committed symlinks are omitted
(`links/new-link.md` was untracked at the time of the run, and is absent from
the `respectGitignore: false` listing), so the discriminator has **no base-revision
blind spot** — it reads the working tree.

### 2.3 `ctx.fileAtBase()` — the git-mode channel

Git stores a symlink as a blob of mode `120000` whose content is the target
path. `fileAtBase` reads the blob, so it hands the rule the link target:

```
PATH links/link-rel.md
  readFile   = OK[len=57 …]
  fileAtBase = OK[len=17 "../target/real.md"]
PATH links/link-abs.md
  fileAtBase = OK[len=140 "/private/tmp/claude-501/-Users-han-Developer-okf-frontmatter-harness/d9ef887f-8a"]
PATH links/link.json
  fileAtBase = OK[len=19 "../target/real.json"]
PATH links/linkdir
  readFile   = THROW[Directories cannot be read like files]
  fileAtBase = OK[len=9 "../target"]
PATH copies/copy.md
  readFile   = OK[len=57 …]
  fileAtBase = OK[len=57 "---\nkind: real\nn: 1\n---\nREAL BODY LINE\nNEEDLE_TOKEN here\n"]
```

Verified against **this repository** (full copy, `origin/main` = `b44b5e4`,
`HEAD` = `e09970b`, identical with and without an explicit `--base origin/main`):

```
glob('.claude/rules/*.md') = OK[.claude/rules/gen-001-adr.md]
readFile(link) = OK[len=17841]
readFile(adr)  = OK[len=17841]
readFile(link)===readFile(adr) = true
fileAtBase(link) = OK[len=35 "../../.archgate/adrs/GEN-001-adr.md"]
fileAtBase(adr)  = OK[len=17841 "---\ntype: adr\nid: GEN-001\ntitle: 'ADR Co"]
changedFiles.includes(link) = false
```

The corollary for code files: `ast(path, lang, { rev: 'base' })` parses the base
blob, so it chokes on a symlink —

```
ast(links/link.ts,'typescript')                 = OK[Program body=1]
ast(links/link.ts,'typescript',{rev:'base'})    = THROW[Failed to parse "links/link.ts" as typescript: Unexpected .]
```

— useless for `.md` runtime entries, but worth knowing.

**The blind spot.** `fileAtBase` describes the _merge base_, not the working
tree. Replacing a committed symlink with a regular copy in the working tree is
invisible to it:

```
# working tree: links/link-rel.md replaced by a byte-identical regular file
links/link-rel.md
  readFile=OK[len=57]
  fileAtBase=OK[len=17 "../target/real.md"]      ← still says "symlink"
links/new-link.md      (new, uncommitted symlink)
  readFile=OK[len=57]
  fileAtBase=OK[null]
links/new-copy.md      (new, uncommitted regular file)
  readFile=OK[len=57]
  fileAtBase=OK[null]
```

New symlink and new copy are **indistinguishable** (`null` for both), and a
just-swapped entry reports its old type. `fileAtBase` is therefore only sound
when the path is _not_ in `changedFiles`; the moment the harm is introduced it
abstains. That is precisely the wrong moment.

### 2.4 Symlinks that escape the project root

Still rejected, by every I/O method, with a distinctive message:

```
PATH links/link-out.md              (-> /etc/hosts)
  readFile   = THROW[Path "links/link-out.md" resolves outside the project through symbolic link "link-out.md" — access denied]
  grep       = THROW[Path "links/link-out.md" resolves outside the project through symbolic link "link-out.md" — access denied]
  fileAtBase = THROW[Path "links/link-out.md" resolves outside the project through symbolic link "link-out.md" — access denied]
PATH links/link-out-rel.md          (-> ../../outside/out.md)
  readFile   = THROW[Path "links/link-out-rel.md" resolves outside the project through symbolic link "link-out-rel.md" — access denied]
```

The guard tests the **fully-resolved** path, not any intermediate: a link that
leaves the root and comes back is allowed —

```
readFile(links/link-bounce.md) = OK[len=57]        # -> ../../symprobe/target/real.md
```

**Is it exploitable for this rule?** No. The runtime entry must point at the ADR
_inside_ the repo, so it will never trip the guard. The escaping-symlink throw is
a discriminator for a case we do not have.

It is, however, a live hazard: one escaping symlink anywhere in a `grepFiles`
glob aborts the **whole call**, and if the rule does not catch it the whole rule
errors out —

```
=== RULE probe-surface error err: Path "links/link-out-rel.md" resolves outside the project
    through symbolic link "link-out-rel.md" — access denied
```

`respectGitignore: false` incidentally immunises `grepFiles` against this,
because escaping symlinks are never enumerated.

### 2.5 Other, narrower signatures

- **Directory symlinks are detectable without any flag.** `glob` never lists a
  real directory, but it _does_ list a symlink-to-directory as an entry, and
  `readFile` on it throws a distinctive message:

  ```
  glob("links/*") = OK[… | links/linkdir | …]        # links/linkdir -> ../target
  readFile(links/linkdir) = THROW[Directories cannot be read like files]
  glob("links/linkdir/*")  = OK[n=0 :: ]
  glob("links/linkdir/**") = OK[n=0 :: ]
  glob("*")                = OK[n=1 :: .gitignore]   # real dirs never listed
  ```

  So `glob` lists directory symlinks but refuses to descend through them. In
  this repo `.claude/skills/commit` (git mode `120000`) shows up this way in
  `glob('.claude/**/*')`. Not applicable to a `.md` runtime entry, which must be
  a file.

- **Broken and looping symlinks** are listed by `glob` (default) and fail on
  read with the raw errno:

  ```
  readFile(links/link-broken.md) = THROW[ENOENT: no such file or directory, open '…/links/link-broken.md']
  readFile(links/link-loop.md)   = THROW[ELOOP: too many symbolic links encountered, open '…/links/link-loop.md']
  fileAtBase(links/link-broken.md) = OK[len=9 "./nope.md"]
  ```

  A broken symlink is thus distinguishable from a regular file — but a _correct_
  symlink is not, which is exactly backwards for our purpose.

- **Reads through a symlinked ancestor directory are allowed** for project files
  (the 0.51.0 `reject rule-file reads through a symlinked ancestor directory`
  fix scopes to rule files, not to `ctx` reads):

  ```
  readFile(links/linkdir/real.md) = OK[len=57]
  readFile(links/linkdir/real.ts) = OK[len=28]
  ```

---

## 3. Q2 — Does `respectGitignore`, or any other frontmatter option, change symlink handling?

### 3.1 `respectGitignore`

**Yes — decisively, and undocumented.** See §2.2. The official docs describe it
purely as a gitignore filter:

> "By default, files listed in `.gitignore` are excluded from all file-scanning
> operations (`ctx.scopedFiles`, `ctx.glob()`, `ctx.grepFiles()`). Set
> `respectGitignore: false` to include gitignored files"
> — archgate `llms-full.txt`, ADR frontmatter reference

Nothing says it also drops symlinks. It does.

Cost, measured on a full copy of this repo **with `node_modules` present**
(5 739 files):

|                              | default        | `respectGitignore: false` |
| ---------------------------- | -------------- | ------------------------- |
| `glob('.claude/rules/*.md')` | 0 ms           | 1 ms                      |
| `glob('**/*.md')`            | 15 files, 0 ms | 210 files, 19 ms          |
| whole-check `durationMs`     | 28.96          | 75.38                     |
| wall clock                   | 0.377 s        | 0.394 s                   |

Two stderr advisories fire when there is no `files:` scope:

```
warn: ADR GEN-001: respectGitignore is false without a files scope — scanning all files
  including node_modules/, .git/, etc. This may be very slow. Add a files pattern to narrow the scope.
warn: ADR GEN-001: Resolved 5885 files from patterns: **/* (scan took 44ms). Consider narrowing
  the `files` patterns in the ADR frontmatter to improve performance.
```

Neither is a `--strict` failure. Isolated test with a no-op rule and no other
advisories:

```
{'pass': True, 'strictAdvisoryExceeded': False, 'warningsExceeded': False,
 'briefingWarnings': [], 'suppressionWarnings': [], 'unparsedAdrs': []}
strict exit=0
plain exit=0
```

So the flag can be adopted without a `files:` scope, at the price of a stderr
warning and roughly 45 ms.

### 3.2 `files:` — no effect on symlinks, but it gates whether the ADR runs

`files:` narrows `ctx.scopedFiles` only; `ctx.glob()` stays project-wide.

More importantly, 0.54.0 shipped `feat(check): skip ADRs whose files scope has no
changed files`. Measured on a clean tree with base == HEAD:

```
### clean tree, base==HEAD, files:["links/**"] ###
  total 1 …   RAN scoped=1 changed=
### touch a file OUTSIDE the files scope ###
  total 0 passed 0 failed 0 results: []          ← ADR skipped entirely
### touch a file INSIDE the files scope ###
  total 1 …   RAN scoped=1 changed=links/new-copy.md
### replace an in-scope SYMLINK with a copy ###
  total 1 …   RAN scoped=2 changed=links/link-rel.md
```

The skip is driven by `changedFiles` (git-derived), which **does** include
symlinks even under `respectGitignore: false` — so a symlink→copy swap inside
the scope still wakes the ADR up. But adding `files:` to silence the perf
advisory means the rule goes quiet on every commit that touches nothing in scope.

### 3.3 `paths:` is not an archgate frontmatter key

Side finding, worth flagging. `GEN-001-adr.md` declares
`paths: ['.archgate/adrs/**/*.{md,ts}']`. Archgate's documented scope key is
`files`. Empirically `paths:` scopes nothing:

| frontmatter                                       | `ctx.scopedFiles.length` |
| ------------------------------------------------- | ------------------------ |
| `files: ["links/**"]` + `respectGitignore: false` | **1**                    |
| `paths: ["links/**"]` + `respectGitignore: false` | **64** (whole project)   |

`paths:` is inert to archgate; it is a GEN-001-internal convention that only
GEN-001's own rules read. That is fine as long as nobody expects it to scope.

### 3.4 What `respectGitignore` does _not_ change

`ctx.readFile()` is not gitignore-filtered under either setting — it reads
gitignored files and gitignored symlinks alike:

```
readFile(gitignored/ig.md)      = OK[len=21]
readFile(gitignored/ig-link.md) = OK[len=57]      # a symlink inside a gitignored dir
```

That is what makes the §2.2 detector work: `readFile` establishes existence,
`glob` establishes regular-file-ness, and the two disagree exactly on symlinks.

---

## 4. Q3 — Is there a documented replacement API or migration note?

**No.**

- The official documentation bundle (`llms-full.txt`, 8 110 lines, the source
  behind docs.archgate pages including the Rule API Reference) contains **zero**
  occurrences of `symlink`, `lstat`, or `readlink`. Symlink behaviour is
  undocumented in both directions — before and after 0.51.
- The upstream `CHANGELOG.md` (935 lines, `archgate/cli`) mentions symlinks
  exactly twice, both under **0.51.0**:

  ```
  * **engine:** allow symlinks that resolve inside the project root (#500) (387bf15)
  * **engine:** reject rule-file reads through a symlinked ancestor directory (#499) (a555f9d)
  ```

  Neither is flagged as breaking; neither carries a migration note. 0.52.0
  through 0.55.0 say nothing about symlinks at all.

- `.archgate/rules.d.ts` as generated by 0.55.0 documents `fileAtBase`,
  `readYAML`, `ast` and `checkCase` in detail and says nothing about symlinks.
  There is no `lstat`, `readlink`, `stat`, or file-type accessor on
  `RuleContext`.

Conclusion: 0.51.0 changed a behaviour that was never specified, and the 0.55
replacement signature is likewise unspecified. Any rule that depends on either
is depending on an implementation detail — which is exactly how `GEN-001`
Consequences §2 predicted this would go.

---

## 5. Q4 — What can still be asserted, ranked

Detection is _not_ impossible, so this is a ranked menu rather than a fallback.

### Rank 1 — "is it a pointer?", via the glob/readFile asymmetry

**Requires `respectGitignore: false` on the ADR. Catches a fresh copy — the case
nothing else catches.**

```ts
// Requires `respectGitignore: false` in this ADR's frontmatter: under that flag
// archgate's file scanner omits symlinks from glob()/scopedFiles/grepFiles,
// while readFile() still resolves them. Listed by glob ⇒ regular file.
const listedAsRegularFile = new Set(await ctx.glob('.claude/rules/*.md'));
const body = await tryReadFile(ctx, link); // null ⇒ absent or broken
const isSymlink = body !== null && !listedAsRegularFile.has(link);
```

End-to-end verdicts, run against a copy of this repo with four seeded entries:

```
glob('.claude/rules/*.md') = [.claude/rules/gen-002-adr.md, .claude/rules/gen-003-adr.md]
.claude/rules/gen-001-adr.md: inGlob=false readable=true  sameAsAdr=true  => SYMLINK — ok
.claude/rules/gen-002-adr.md: inGlob=true  readable=true  sameAsAdr=true  => REGULAR FILE — fresh copy (VIOLATION)
.claude/rules/gen-003-adr.md: inGlob=true  readable=true  sameAsAdr=false => REGULAR FILE — stale copy (VIOLATION, drifted)
.claude/rules/gen-999-adr.md: inGlob=false readable=false sameAsAdr=false => NOT READABLE — absent or broken/escaping symlink
.claude/rules/gen-000-adr.md: inGlob=false readable=false sameAsAdr=false => NOT READABLE — absent or broken/escaping symlink
```

Costs and caveats:

1. **Undocumented.** Same fragility class as the signature that just broke.
   Mitigate with the canary in §7.
2. **`respectGitignore` is ADR-wide.** Every rule in `GEN-001-adr.rules.ts`
   would lose symlink visibility and gain gitignored files. The
   `adr-governed-files` and `adr-frontmatter` globs over `.archgate/adrs/` are
   unaffected in practice (nothing there is ignored or symlinked), but this must
   be re-verified rather than assumed.
3. **Orphan enumeration is lost.** A symlink with no backing ADR becomes
   invisible to `glob` — `gen-999-adr.md` above is a symlink and does not
   appear. The orphan half of `adr-claude-rules-symlink` cannot survive in the
   same ADR. Two options: (a) split the rule across two ADRs, one with default
   `respectGitignore` owning presence/orphan enumeration and one with
   `respectGitignore: false` owning the pointer assertion; or (b) accept that
   orphan _symlinks_ go unpoliced while orphan _copies_ are still caught.
   Option (a) also lets rule B become a pure existential check — _anything_
   `glob` can see under `.claude/rules/` with an ADR-shaped name is by
   construction a regular file, so it needs no cross-referencing at all.
4. **~45 ms** and a stderr advisory unless a `files:` scope is added — and
   adding one silences the ADR on out-of-scope commits (§3.2).

### Rank 2 — "is it in sync?", via content equality

**Documented, stable, no flags. Catches drift, not freshness.**

```ts
const same = (await ctx.readFile(link)) === (await ctx.readFile(adr));
```

Verified true today in this repo (`readFile(link)===readFile(adr) = true`,
both 17 841 bytes) and demonstrated to catch the stale copy above
(`sameAsAdr=false`).

This is the answer to the issue's own question: **yes**, content equality catches
the actual harm of a copy — the runtime entry drifting away from the ADR it is
supposed to mirror. It cannot catch a copy on the day it is made, and it is
tautologically true for a symlink, so it is a **complement** to Rank 1, not a
substitute. Its cost is zero and its failure mode is benign, so it belongs in the
rule regardless of what else is adopted.

### Rank 3 — "what was it at the merge base?", via `fileAtBase`

**Uses only documented API surface; the `120000` behaviour is an emergent git
property, not an archgate feature. Sound only when the path is unchanged.**

```ts
const atBase = await ctx.fileAtBase(link); // symlink ⇒ the target path string
const wasSymlinkAtBase = atBase !== null && atBase.trimEnd() === expectedRelTarget;
const authoritative = !ctx.changedFiles.includes(link);
```

Both conditions hold in this repo today (`fileAtBase` = `"../../.archgate/adrs/GEN-001-adr.md"`,
`changedFiles.includes(link) = false`). Use it as a **cross-check**, not as the
primary assertion: it abstains (`null`, or stale) exactly when the entry is being
introduced or modified.

### Rank 4 — the structural assertions that never depended on symlink detection

Unaffected by any of this; keep them as-is.

- ADR with non-empty `paths:` ⇒ a `.claude/rules/<basename-lowercased>.md` entry
  exists (`readFile` succeeds).
- ADR with empty/absent `paths:` ⇒ no such entry.
- No ADR-shaped entry without a backing ADR (subject to the §5 Rank 1 caveat 3
  about symlink orphans).
- Entry name is exactly the lowercased ADR basename.

### Rank 5 — assertions that are _not_ worth making

- **Byte-length equality** — subsumed by Rank 2.
- **The escaping-symlink throw** (§2.4) — a real signature, but for a case this
  rule can never encounter.
- **`ast(…, { rev: 'base' })` throwing** — the `fileAtBase` mechanism in
  disguise, and unavailable for `.md`.
- **Anything reaching for `lstat`** — blocked by the rule-file security scanner
  (§2.1).

---

## 6. Recommended shape

Given the ranking, the recommendation for `adr-claude-rules-symlink` is:

1. Keep Rank 4 structurally, unchanged.
2. Add Rank 2 unconditionally — it is free, documented and catches the real harm.
3. Adopt Rank 1 for the pointer assertion, with `respectGitignore: false` and the
   §7 canary; split the orphan enumeration into a second ADR if orphan symlinks
   must stay policed.
4. Wire Rank 3 in as the canary's second channel.

If the team judges the undocumented `respectGitignore` asymmetry too fragile to
depend on twice in a row, the honest degraded position is **Rank 2 + Rank 4
only**, with the rule's description amended to say plainly that it enforces
_sync_, not _pointer-ness_, and with the `## Consequences` section recording that
a fresh copy is undetectable under 0.55 without the flag. That is a smaller
promise than GEN-001 makes today, and it should be written down rather than
silently implied.

## 7. Canary — make the next inversion fail loudly

Both discriminators are undocumented, and one of them has already inverted once.
The failure mode that hurt here was not the inversion itself but that it
inverted _silently_ into a confident false accusation.

Rank 1 and Rank 3 are independent channels (live filesystem scan vs. git blob
mode). When they contradict each other on a path that `changedFiles` says is
unchanged, the discriminator — not the repository — is what broke:

```ts
const unchanged = !ctx.changedFiles.includes(link);
const globSaysRegularFile = listedAsRegularFile.has(link);
const baseSaysSymlink = atBase !== null && atBase.length < 512 && !atBase.includes('\n');

if (unchanged && globSaysRegularFile && baseSaysSymlink) {
  // Not a repo violation — our symlink discriminator no longer works.
  ctx.report.violation({
    message: `Symlink detection is broken under archgate ${'<version>'}: '${link}' is a symlink at the merge base and unchanged since, yet glob() lists it as a regular file. Re-run the symlink-detection research before trusting this rule (GEN-001 [adr-claude-rules-symlink]).`,
    file: link,
  });
  return;
}
```

This turns the next 0.5x behaviour change from "the build accuses every correct
symlink of being a copy" into "the build says the detector needs re-checking" —
which is what actually happened, and what the message should have said.

---

## 8. Reproduction

Probe projects (throwaway, outside this repo):

- `/private/tmp/claude-501/-Users-han-Developer-okf-frontmatter-harness/d9ef887f-8a3e-4237-b361-c5033daca225/scratchpad/symprobe`
  — fixture tree with relative / absolute / escaping / broken / looping /
  directory symlinks, a byte-identical copy and a stale copy, plus git history
  so `fileAtBase` resolves.
- `…/scratchpad/harnesscopy` — full copy of this repository (including
  `node_modules` and `origin/main`) with `GEN-001-adr.rules.ts` swapped for a
  probe, used for the real-repo and performance numbers.

Primary sources consulted:

- `~/.archgate/bin/archgate` `0.55.0` — the binary itself, driven by probe rules.
- `.archgate/rules.d.ts` as generated by 0.55.0 — the authoritative
  `RuleContext` surface.
- `archgate/cli` `CHANGELOG.md` (935 lines) — release history 0.36 → 0.55.
- archgate `llms-full.txt` (8 110 lines) — the official documentation bundle.
