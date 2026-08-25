/// <reference path="../rules.d.ts" />

// Sibling test for GEN-001-adr.rules.ts — pass and fail path per rule.

import { describe, expect, it } from 'vitest';
import ruleSet from './GEN-001-adr.rules';

interface Reported {
  message: string;
  file?: string;
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .split('**')
    .map((chunk) =>
      chunk
        .split('*')
        .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
        .join('[^/]*'),
    )
    .join('.*');
  return new RegExp(`^${escaped}$`);
}

// `symlinks` maps a link path to its target and models archgate 0.55: ctx.glob
// lists the link AND ctx.readFile resolves it, returning the target's bytes.
// `brokenLinks` are listed by glob but unreadable (dangling, or escaping the
// project root). Regular entries live in `files`.
function unquote(s: string): string {
  return s.replace(/^["']|["']$/g, '');
}

// A deliberately narrow frontmatter parser: exactly the YAML forms these rules
// must tell apart — flow sequence, block sequence, scalar, and a valueless key
// (which archgate reads as null and rejects) — and nothing more. Fidelity to
// archgate 0.55's own parser is corroborated by the integration probe recorded
// on issue #14, not by this mock.
function parseFrontmatter(block: string): Record<string, YamlValue> {
  const out: Record<string, YamlValue> = {};
  const lines = block.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^([A-Za-z_][\w-]*)[ \t]*:[ \t]*(.*)$/);
    if (!m) continue;
    const key = m[1];
    const value = m[2].trim();
    if (value === '') {
      // Either a valueless key (null) or the head of a block sequence.
      const items: string[] = [];
      while (i + 1 < lines.length && /^[ \t]*-[ \t]+/.test(lines[i + 1])) {
        items.push(unquote(lines[++i].replace(/^[ \t]*-[ \t]+/, '').trim()));
      }
      out[key] = items.length > 0 ? items : null;
    } else if (value.startsWith('[')) {
      const inner = value.slice(1, value.lastIndexOf(']')).trim();
      // Prefer quoted extraction so a brace-comma glob like **/*.{md,ts} survives.
      const quoted = [...inner.matchAll(/(["'])(.*?)\1/g)].map((q) => q[2]);
      out[key] = inner === '' ? [] : quoted.length > 0 ? quoted : inner.split(',').map((s) => s.trim());
    } else if (value === 'true' || value === 'false') {
      out[key] = value === 'true';
    } else if (value === 'null' || value === '~') {
      out[key] = null;
    } else {
      out[key] = unquote(value);
    }
  }
  return out;
}

function makeCtx(
  files: Record<string, string>,
  opts?: { config?: unknown; symlinks?: Record<string, string>; brokenLinks?: string[] },
) {
  const violations: Reported[] = [];
  const warnings: Reported[] = [];
  const symlinks = opts?.symlinks ?? {};
  const brokenLinks = opts?.brokenLinks ?? [];
  const allPaths = [...Object.keys(files), ...Object.keys(symlinks), ...brokenLinks];
  function read(path: string): string {
    if (path in files) return files[path];
    if (path in symlinks) {
      const target = symlinks[path];
      if (target in files) return files[target];
      throw new Error(`ENOENT: dangling symlink ${path} -> ${target}`);
    }
    if (brokenLinks.includes(path)) throw new Error(`ENOENT: broken symlink ${path}`);
    throw new Error(`ENOENT: ${path}`);
  }
  const ctx = {
    projectRoot: '/repo',
    scopedFiles: allPaths,
    changedFiles: [],
    async glob(pattern: string) {
      const re = globToRegExp(pattern);
      return allPaths.filter((f) => re.test(f));
    },
    async readFile(path: string) {
      return read(path);
    },
    // Models archgate 0.55's frontmatter-aware readYAML: the leading --- block
    // parsed with types preserved, null when there is none.
    async readYAML(path: string) {
      const raw = read(path);
      const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      return {
        frontmatter: m ? parseFrontmatter(m[1]) : null,
        content: m ? raw.slice(m[0].length).trim() : raw.trim(),
      };
    },
    async readJSON(path: string) {
      if (path === '.archgate/config.json') return opts?.config ?? { domains: {} };
      throw new Error(`ENOENT: ${path}`);
    },
    report: {
      violation: (d: Reported) => violations.push(d),
      warning: (d: Reported) => warnings.push(d),
      info: () => {},
    },
  } as unknown as RuleContext;
  return { ctx, violations, warnings };
}

const ADR_PATH = '.archgate/adrs/GEN-001-adr.md';
const RULES_PATH = '.archgate/adrs/GEN-001-adr.rules.ts';
const LINK_PATH = '.claude/rules/gen-001-adr.md';

const FM = `---
type: adr
id: GEN-001
title: "ADR Contract"
domain: general
rules: true
paths: [".archgate/adrs/**/*.md"]
files: [".archgate/adrs/**/*.md"]
---`;

const BODY = `
# ADR Contract

## Context

Why.

## Decision

Decided.

## Do's and Don'ts

Do this.

## Consequences

So.

## Compliance and Enforcement

Enforced.

## References

Links.
`;

const VALID_ADR = `${FM}\n${BODY}`;
const PATHS_LINE = 'paths: [".archgate/adrs/**/*.md"]';
const FILES_LINE = 'files: [".archgate/adrs/**/*.md"]';

function passingFiles(): Record<string, string> {
  return {
    [ADR_PATH]: VALID_ADR,
    [RULES_PATH]: 'export default { rules: {} };',
  };
}

const rules = ruleSet.rules;

describe('adr-frontmatter', () => {
  it('passes a well-formed ADR', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-frontmatter'].check(ctx);
    expect(violations).toEqual([]);
  });

  it("fails when type is not 'adr'", async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr', 'type: spec');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /type.*must be 'adr'/.test(v.message))).toBe(true);
  });

  it('fails when the field order is wrong', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr\nid: GEN-001', 'id: GEN-001\ntype: adr');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /field order must be/.test(v.message))).toBe(true);
  });

  it('fails when rules: true has no sibling .rules.ts', async () => {
    const files = passingFiles();
    delete files[RULES_PATH];
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /sibling.*does not exist/.test(v.message))).toBe(true);
  });

  it('accepts an unlisted tail key ahead of the ordered prefix (§2.2 promises no order there)', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('---\ntype: adr', '---\ndescription: "leads the block"\ntype: adr');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('still fails a reordered key from within the ordered prefix', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('type: adr\nid: GEN-001', 'id: GEN-001\ntype: adr');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-frontmatter'].check(ctx);
    expect(violations.some((v) => /field order must be/.test(v.message))).toBe(true);
  });
});

describe('adr-required-sections', () => {
  it('passes when all six sections are present', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-required-sections'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a section is missing', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('## References\n\nLinks.\n', '');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-required-sections'].check(ctx);
    expect(violations.some((v) => /missing the mandatory section '## References'/.test(v.message))).toBe(true);
  });
});

describe('adr-claude-rules-symlink', () => {
  it('passes when a scoped ADR has a runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles(), { symlinks: { [LINK_PATH]: ADR_PATH } });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a scoped ADR has no runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /no runtime symlink/.test(v.message))).toBe(true);
  });

  it('fails when the runtime entry has drifted from the ADR', async () => {
    const drifted = VALID_ADR.replace('## References', '## Drifted\n\nStale copy.\n\n## References');
    const { ctx, violations } = makeCtx({ ...passingFiles(), [LINK_PATH]: drifted });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /does not match the ADR byte-for-byte/.test(v.message))).toBe(true);
  });

  it('fails when the runtime entry is a broken symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles(), { brokenLinks: [LINK_PATH] });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /cannot be read/.test(v.message))).toBe(true);
  });

  // Accepted gap under archgate 0.55: readFile() resolves symlinks, so a copy is
  // indistinguishable from a pointer until it drifts. Documented in GEN-001
  // Consequences and docs/research/symlink-detection-055.md; asserted here so the
  // gap is a deliberate, visible choice rather than an untested assumption.
  it('passes a byte-identical copy — the documented gap under 0.55', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), [LINK_PATH]: VALID_ADR });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when an ADR with empty paths still has a runtime entry', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths: []');
    const { ctx, violations } = makeCtx(files, { symlinks: { [LINK_PATH]: ADR_PATH } });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /a runtime entry exists/.test(v.message))).toBe(true);
  });

  it('fails on an orphaned ADR-named runtime symlink', async () => {
    const { ctx, violations } = makeCtx(passingFiles(), {
      symlinks: { [LINK_PATH]: ADR_PATH, '.claude/rules/gen-999-ghost.md': ADR_PATH },
    });
    await rules['adr-claude-rules-symlink'].check(ctx);
    expect(violations.some((v) => /has no backing ADR/.test(v.message))).toBe(true);
  });
});

// ---- Shape-grammar (§5) and companion rules-file (§6) rules ----

const TEST_PATH = '.archgate/adrs/GEN-001-adr.rules.test.ts';

// A companion rules file whose single rule key is what the marker tests reference.
const DEMO_RULES = "export default { rules: { 'demo-rule': { async check() {} } } };";

// Build an ADR from a custom Decision and Do's/Don'ts body; the other sections are trivial.
function adrWith(decision: string, dosDonts: string): string {
  return `${FM}

# T

## Context

Why.

## Decision

${decision}

## Do's and Don'ts

${dosDonts}

## Consequences

So.

## Compliance and Enforcement

Enforced.

## References

Links.
`;
}

describe('adr-numbered-decision', () => {
  it('passes numbered anchors with sequential per-anchor lists', async () => {
    const decision = '### 1. First\n\n1. Alpha.\n2. Beta.\n\n### 2. Second\n\nProse only.';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    await rules['adr-numbered-decision'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails on an unordered first-level bullet inside an anchor', async () => {
    const decision = '### 1. First\n\n- loose bullet';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    await rules['adr-numbered-decision'].check(ctx);
    expect(violations.some((v) => /unordered first-level bullet/.test(v.message))).toBe(true);
  });
});

describe('adr-numbered-dos-donts', () => {
  it("passes headed DO and DON'T blocks each ordered from 1", async () => {
    const dosDonts = "### Do's\n\n1. **DO** a.\n2. **DO** b.\n\n### Don'ts\n\n1. **DON'T** c.\n2. **DON'T** d.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    await rules['adr-numbered-dos-donts'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails on a non-sequential DO block', async () => {
    const dosDonts = "### Do's\n\n1. **DO** a.\n3. **DO** b.\n\n### Don'ts\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    await rules['adr-numbered-dos-donts'].check(ctx);
    expect(violations.some((v) => /DO block numbering must be sequential/.test(v.message))).toBe(true);
  });

  it('fails bare adjacent lists that lack the subsection headings', async () => {
    const dosDonts = "1. **DO** a.\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    await rules['adr-numbered-dos-donts'].check(ctx);
    expect(violations.some((v) => /exactly one "### Do's" subsection heading, found 0/.test(v.message))).toBe(true);
    expect(violations.some((v) => /exactly one "### Don'ts" subsection heading, found 0/.test(v.message))).toBe(true);
  });

  it("fails when ### Don'ts precedes ### Do's", async () => {
    const dosDonts = "### Don'ts\n\n1. **DON'T** c.\n\n### Do's\n\n1. **DO** a.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    await rules['adr-numbered-dos-donts'].check(ctx);
    expect(violations.some((v) => /"### Do's" must precede "### Don'ts"/.test(v.message))).toBe(true);
  });

  it('fails an item filed under the wrong subsection', async () => {
    const dosDonts = "### Do's\n\n1. **DO** a.\n2. **DON'T** stray.\n\n### Don'ts\n\n1. **DON'T** c.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith('1. Decided.', dosDonts) });
    await rules['adr-numbered-dos-donts'].check(ctx);
    expect(violations.some((v) => /sits outside the "### Don'ts" subsection/.test(v.message))).toBe(true);
  });
});

describe('adr-rule-mentions', () => {
  const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\n1. Body.';

  it('passes when a rule is marked on both sides with an aligned back-reference', async () => {
    const dosDonts = "1. **DO** it. (Decision 1, 📜 Rule: `demo-rule`)\n\n1. **DON'T** not.";
    const files = { [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES };
    const { ctx, violations } = makeCtx(files);
    await rules['adr-rule-mentions'].check(ctx);
    expect(violations).toEqual([]);
  });

  it("fails when the Do's/Don'ts-side marker is missing", async () => {
    const dosDonts = "1. **DO** it.\n\n1. **DON'T** not.";
    const files = { [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES };
    const { ctx, violations } = makeCtx(files);
    await rules['adr-rule-mentions'].check(ctx);
    expect(violations.some((v) => /needs its marker \(Decision <N>/.test(v.message))).toBe(true);
  });
});

describe('adr-no-review-tag', () => {
  it('passes an ADR with no review tag, and ignores one inside a code span', async () => {
    const { ctx, violations } = makeCtx({ [ADR_PATH]: VALID_ADR.replace('Why.', 'Why. `[review]` is exempt.') });
    await rules['adr-no-review-tag'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a bare [review] tag appears in prose', async () => {
    const { ctx, violations } = makeCtx({ [ADR_PATH]: VALID_ADR.replace('Why.', 'Why. [review] this.') });
    await rules['adr-no-review-tag'].check(ctx);
    expect(violations.some((v) => /retired \[review\] tag/.test(v.message))).toBe(true);
  });
});

describe('adr-rules-test-sibling', () => {
  it('passes when a rules file has its sibling test', async () => {
    const { ctx, violations } = makeCtx({ [RULES_PATH]: DEMO_RULES, [TEST_PATH]: '' });
    await rules['adr-rules-test-sibling'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when the sibling test is absent', async () => {
    const { ctx, violations } = makeCtx({ [RULES_PATH]: DEMO_RULES });
    await rules['adr-rules-test-sibling'].check(ctx);
    expect(violations.some((v) => /no sibling test/.test(v.message))).toBe(true);
  });
});

describe('adr-message-provenance', () => {
  it('passes when every rule embeds its provenance tag', async () => {
    const src =
      "export default { rules: { 'demo-rule': { async check(ctx) { ctx.report.violation({ message: '(GEN-001 [demo-rule])' }); } } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    await rules['adr-message-provenance'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when a rule omits its provenance tag', async () => {
    const src =
      "export default { rules: { 'demo-rule': { async check(ctx) { ctx.report.violation({ message: 'no tag here' }); } } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    await rules['adr-message-provenance'].check(ctx);
    expect(violations.some((v) => /must embed the provenance literal/.test(v.message))).toBe(true);
  });
});

describe('adr-rule-mentions (reverse direction)', () => {
  it('fails when a marker names a rule the rules file does not declare', async () => {
    const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\nAlso ghosted. (📜 Rule: `ghost-rule`)\n\n1. Body.';
    const dosDonts = "1. **DO** it. (Decision 1, 📜 Rule: `demo-rule`)\n\n1. **DON'T** skip.";
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, dosDonts), [RULES_PATH]: DEMO_RULES });
    await rules['adr-rule-mentions'].check(ctx);
    expect(violations.some((v) => /names rule 'ghost-rule' but no such rule exists/.test(v.message))).toBe(true);
  });

  it('flags markers as phantoms when the ADR has no rules file at all', async () => {
    const decision = '### 1. Thing (📜 Rule: `demo-rule`)\n\n1. Body.';
    const { ctx, violations } = makeCtx({ [ADR_PATH]: adrWith(decision, '1. **DO** x.') });
    await rules['adr-rule-mentions'].check(ctx);
    expect(violations.some((v) => /names rule 'demo-rule' but no such rule exists/.test(v.message))).toBe(true);
  });
});

describe('adr-governed-files', () => {
  it('passes a flat directory of ADR bundle files', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), [TEST_PATH]: '' });
    await rules['adr-governed-files'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails on a stray non-ADR-shaped file', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/notes.md': 'scratch' });
    await rules['adr-governed-files'].check(ctx);
    expect(violations.some((v) => /does not match the ADR bundle shape/.test(v.message))).toBe(true);
  });

  it('fails on a file in a subdirectory', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/sub/GEN-050-nested.md': VALID_ADR });
    await rules['adr-governed-files'].check(ctx);
    expect(violations.some((v) => /sits in a subdirectory/.test(v.message))).toBe(true);
  });

  it('fails on an ADR-less rules file (silently inert)', async () => {
    const { ctx, violations } = makeCtx({ ...passingFiles(), '.archgate/adrs/GEN-051-ghost.rules.ts': DEMO_RULES });
    await rules['adr-governed-files'].check(ctx);
    expect(violations.some((v) => /has no backing ADR 'GEN-051-ghost.md'/.test(v.message))).toBe(true);
  });
});

describe('adr-paths-inline', () => {
  it('passes an inline flow list and an absent paths key', async () => {
    const files = passingFiles();
    files['.archgate/adrs/GEN-052-scopeless.md'] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]\n', '').replace(
      'id: GEN-001',
      'id: GEN-052',
    );
    const { ctx, violations } = makeCtx(files);
    await rules['adr-paths-inline'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a block-style paths list', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths:\n  - ".archgate/adrs/**/*.md"');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-paths-inline'].check(ctx);
    expect(violations.some((v) => /must be an inline flow list/.test(v.message))).toBe(true);
  });

  it('fails a null paths value', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('paths: [".archgate/adrs/**/*.md"]', 'paths: null');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-paths-inline'].check(ctx);
    expect(violations.some((v) => /must be an inline flow list/.test(v.message))).toBe(true);
  });
});

describe('adr-files-scope', () => {
  // `swap` rewrites the fixture's files: line; `scopeless` drops both keys.
  const swap = (replacement: string) => VALID_ADR.replace(FILES_LINE, replacement);

  it('passes an inline flow files list alongside paths', async () => {
    const { ctx, violations } = makeCtx(passingFiles());
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('passes a block-form files list — archgate honours block form (unlike paths, §2.7)', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files:\n  - ".archgate/adrs/**/*.md"');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('passes an explicit always-on files: ["**/*"]', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files: ["**/*"]');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('passes an ADR that declares neither paths nor files', async () => {
    const files = passingFiles();
    delete files[ADR_PATH];
    files['.archgate/adrs/GEN-053-unscoped.md'] = VALID_ADR.replace(`${PATHS_LINE}\n`, '')
      .replace(`${FILES_LINE}\n`, '')
      .replace('id: GEN-001', 'id: GEN-053');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails when paths is declared but files is absent', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace(`${FILES_LINE}\n`, '');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /declares 'paths:' but no 'files:'/.test(v.message))).toBe(true);
  });

  it('fails an empty paths: [] with no files — scope still widens to the whole project', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace(PATHS_LINE, 'paths: []').replace(`${FILES_LINE}\n`, '');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /declares 'paths:' but no 'files:'/.test(v.message))).toBe(true);
  });

  it('fails an empty files: [] — archgate reads it as the whole project', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files: []');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /empty 'files: \[\]'/.test(v.message))).toBe(true);
  });

  it('fails a valueless files: — the form that voids the whole ADR', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files:');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /must be a list of non-empty glob strings/.test(v.message))).toBe(true);
  });

  it('fails a scalar files value', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files: ".archgate/adrs/**/*.md"');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /must be a list of non-empty glob strings/.test(v.message))).toBe(true);
  });

  it('fails a files list carrying a blank glob', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files: ["  ", ".archgate/adrs/**/*.md"]');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /must be a list of non-empty glob strings/.test(v.message))).toBe(true);
  });

  it('reports a malformed files exactly once, never also as absent', async () => {
    const files = passingFiles();
    files[ADR_PATH] = swap('files:');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toHaveLength(1);
  });

  // The guard is key presence, not §4.3's non-empty test: every form of a
  // declared paths: leaves scope widened when files: is missing, so each one
  // reports. adr-paths-inline separately owns whether the form itself is legal.
  it('fails a block-form paths with no files, which adr-paths-inline does not cover', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace(PATHS_LINE, 'paths:\n  - ".archgate/adrs/**/*.md"').replace(
      `${FILES_LINE}\n`,
      '',
    );
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations.some((v) => /declares 'paths:' but no 'files:'/.test(v.message))).toBe(true);
  });

  it('stays silent when neither paths nor files is declared, whatever the tail holds', async () => {
    const files = passingFiles();
    delete files[ADR_PATH];
    files['.archgate/adrs/GEN-054-tail.md'] = VALID_ADR.replace(`${PATHS_LINE}\n`, '')
      .replace(FILES_LINE, 'description: "no scope keys at all"')
      .replace('id: GEN-001', 'id: GEN-054');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-files-scope'].check(ctx);
    expect(violations).toEqual([]);
  });
});

describe('adr-error-tier', () => {
  it('passes rules declaring error severity or none', async () => {
    const src =
      "export default { rules: { 'demo-rule': { severity: 'error', async check() {} }, 'other-rule': { async check() {} } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    await rules['adr-error-tier'].check(ctx);
    expect(violations).toEqual([]);
  });

  it('fails a warning-tier rule', async () => {
    const src = "export default { rules: { 'demo-rule': { severity: 'warning', async check() {} } } };";
    const { ctx, violations } = makeCtx({ [RULES_PATH]: src });
    await rules['adr-error-tier'].check(ctx);
    expect(violations.some((v) => /runs every rule at 'error'/.test(v.message))).toBe(true);
  });
});

describe('adr-required-sections (fenced headings)', () => {
  it('does not count a heading that only appears inside a fenced block', async () => {
    const files = passingFiles();
    files[ADR_PATH] = VALID_ADR.replace('## References', '```md\n## References\n```');
    const { ctx, violations } = makeCtx(files);
    await rules['adr-required-sections'].check(ctx);
    expect(violations.some((v) => /missing the mandatory section '## References'/.test(v.message))).toBe(true);
  });
});
