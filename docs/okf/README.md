# Vendored OKF specification

`SPEC-v0.2.md` is a **byte-identical, unmodified copy** of the Open Knowledge Format
specification. It is vendored here as evidence, on the same shelf as `docs/research/` —
it is not part of the harness a foreign repo adopts.

|               |                                                                                    |
| ------------- | ---------------------------------------------------------------------------------- |
| Source        | <https://github.com/GoogleCloudPlatform/open-knowledge-format> (`SPEC.md`, `main`) |
| Retrieved     | 2026-08-24                                                                         |
| Size          | 1006 lines, 37,748 bytes                                                           |
| `sha256`      | `26aa5da029278939f914e578107242d9607d4f2dc5fe153272b82f9ed1030101`                 |
| Licence       | Apache-2.0 (`LICENSE.md` upstream)                                                 |
| Modifications | **None.**                                                                          |

## Why a copy, and not a version number

**This file is the pin.** The harness implements the OKF revision in this directory, not
the version string `"0.2"`.

OKF mutates in place. §12 (Versioning) promises that _"a **minor** version bump introduces
backward-compatible additions"_ and that _"a **major** version bump may make breaking
changes"_ — but upstream changed `stale_after`, `last_modified` and `usage_window` from
`YYYY-MM-DD` dates to full ISO 8601 datetimes under an unchanged `0.2` label. Upstream also
publishes **no git tags and no releases**, so `"0.2"` exists only as prose inside the file it
labels. There is nothing to pin to.

Mature spec ecosystems make the citable thing immutable — an RFC number never changes, and
W3C publishes dated snapshot URLs beside its mutable "latest" URL. OKF provides neither, so
the harness manufactures the immutable referent by keeping the bytes.

No checksum is recorded anywhere else, and nothing verifies this file: git already
content-addresses it. `git log docs/okf/SPEC-v0.2.md` says when the pin moved, and
`git diff` says how — which is exactly the input reconciliation needs.

## Reconciliation

Moving the pin is **deliberate and manual**: replace this file, re-read the diff, and adjust
the ADRs and rules the change touches. Drift — upstream differing from this copy — is a
fact, not an error, and nothing in this repo reports it. Automating that detection is
deliberately out of scope; see the drift-watcher issue linked from the wayfinder map.

## Governance

Both files in this directory are **ungoverned** and must stay that way. They carry no
frontmatter and the text is third-party, so a path rule matching `docs/**/*.md` would demand
a `type` key on prose this repo cannot edit. `SPEC-v0.2.md` is also listed in
`.prettierignore`, because formatting it would silently move the pin.
