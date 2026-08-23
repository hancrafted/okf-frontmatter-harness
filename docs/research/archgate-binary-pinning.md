# Why the archgate binary cannot be pinned, and what the harness does instead

Reference for `GEN-001` Consequences §2. Establishes the mechanism behind the version
gate so the ADR can state the tradeoff without transcribing the machinery.

Probed against archgate 0.55.0 on 2026-08-23. Every claim below is from the shipped
shim source or a reproduced command, not from documentation.

---

## 1. The npm package ships no binary

`node_modules/archgate` is 36K and contains four files:

```
LICENSE.md   README.md   package.json   shims/npm/archgate.cjs
```

Its manifest declares `files: ["shims/npm/archgate.cjs"]`, `bin.archgate` pointing at that
shim, and **no `dependencies`, no `optionalDependencies`, and no `cpu` field**. So archgate
does not use the esbuild-style pattern of per-platform packages selected by `os`/`cpu` — the
route that would have made a `node_modules`-local binary possible. `node_modules/.bin/archgate`
is a symlink to the shim, which means `npx archgate` is a _local downloader for a global
binary_, not a local binary.

(There is an `archgate-darwin-arm64` package on npm, but it is stranded at 0.26.0 and nothing
references it.)

## 2. The shim runs whatever is cached, without comparing versions

The two functions that decide which binary executes:

```js
function getCacheDir() {
  return path.join(os.homedir(), '.archgate', 'bin');
}

function getBinaryPath() {
  const binaryName = getBinaryName();
  const cachePath = path.join(getCacheDir(), binaryName);
  if (fs.existsSync(cachePath)) return cachePath;
  return null;
}
```

`getPackageVersion()` — which reads the installed package's own version — is referenced
**only** inside `downloadBinary()`, on the `if (!binary)` branch. So:

- the cache is a **single global unversioned slot** shared by every project on the machine;
- there is no `~/.archgate/bin/<version>/` directory, so two projects cannot hold two versions;
- an existing binary is executed with **no version comparison of any kind**.

Consequence: `devDependencies.archgate` governs only what a _clean_ machine downloads. On a
machine that already has a binary — from a global install, or from another repo that pulled a
newer one — the declared version is inert. On the probe machine `which archgate` and
`npx archgate` resolved to the same `~/.archgate/bin/archgate`.

No alternative pin exists at the tool's own surface: `.archgate/config.json` holds only
`domains` and `baseBranch`, the CLI exposes no version-constraint command, and
`ARCHGATE_VERSION` steers only the standalone installer at install time.

## 3. A per-repo binary is achievable via `HOME`, and was declined

`getCacheDir()` is hardcoded to `os.homedir()`, and Node's `os.homedir()` honours `$HOME` on
POSIX. Relocating it therefore relocates the cache, and the shim then downloads the version
its package declares — which makes the declared range genuinely authoritative:

```
$ HOME=/tmp/agtest npx archgate --version
archgate: binary not found, downloading v0.55.0...
archgate: binary downloaded successfully.
0.55.0
$ find /tmp/agtest -name archgate
/tmp/agtest/.archgate/bin/archgate      # 73M, repo-local
```

Declined as the standing mechanism for three reasons:

1. **73 MB per repo**, downloaded on adoption — an adoption tax on a harness whose whole point
   is being copied into a foreign repo unchanged.
2. **Not cross-platform.** On Windows `os.homedir()` reads `USERPROFILE`, not `HOME`, so the
   script prefix does not port.
3. **It splits the toolchain.** Only invocations carrying the prefix get the pinned binary, so
   a bare `archgate check` — which the archgate agent workflow instructs agents to run — would
   use a _different_ binary than the gate, which is a worse failure mode than the one being fixed.

It remains the escalation path if version drift becomes routine. Note it also relocates
user-level archgate state (`$HOME/.archgate/config.json`, holding `telemetry` and `installId`,
and presumably `archgate login` credentials).

## 4. What ships instead: assert the range against the running binary

`scripts/check-archgate-version.mjs` reads `devDependencies.archgate` and tests the output of
`archgate --version` against it with `semver.satisfies()`. It runs first in both `verify` and
`verify:commit`, costs ~34 ms, and uses only the documented `-V, --version` flag.

It cannot be an archgate rule: a rule executes _inside_ archgate, so a wrong-version binary
would be grading its own homework. The gate must sit outside the tool it gates.

### The existing caret was already the right range

For a `0.x` version npm's caret moves only the patch digit, so `^0.55.0` already means
`>=0.55.0 <0.56.0`. Verified with `semver.satisfies`:

| version  | satisfies `^0.55.0` |
| -------- | ------------------- |
| `0.54.9` | false               |
| `0.55.0` | true                |
| `0.55.7` | true                |
| `0.56.0` | false               |
| `1.0.0`  | false               |

The declaration was never the weak point; the absence of any comparison against the running
binary was. `package.json`'s range is therefore unchanged.

### The range means "verified against"

0.55 broke a rule that 0.54 satisfied — a minor bump carrying a breaking behavioural change —
so compatibility is not inferable from the version number. Widening the range is a deliberate
act: re-verify the rules against the new version, then widen. Recorded as a manual review duty
in `GEN-001`.

## 5. Generated typings regenerate in place

`archgate check` rewrites the committed `.archgate/rules.d.ts` while it is present, not only
when absent. `verify` therefore ends with `git diff --exit-code .archgate/rules.d.ts`, so a
side-effect rewrite surfaces as a failure rather than an unexplained dirty file. This also
catches same-version regeneration drift, which the version assertion cannot.
