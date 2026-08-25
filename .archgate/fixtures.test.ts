/// <reference path="./okf-config.d.ts" />

// Fixture-integrity tests for .archgate/fixtures/.
//
// These do not test the harness — no rules exist yet. They assert that the
// fixture is still a COMPLETE test surface: every key in the config vocabulary
// is exercised somewhere, and the fixture obeys the config-validity rules a
// real validator will later enforce. When the vocabulary grows, this fails
// until the fixture grows with it.

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

const CONFIG_URL = new URL('./fixtures/valid-test-config.yml', import.meta.url);
const config = parse(readFileSync(CONFIG_URL, 'utf8')) as OkfConfig;

/** Every key a rule may carry. Grows only by deliberate amendment. */
const RULE_KEYS = [
  'path',
  'fileName',
  'excludeFiles',
  'intent',
  'frontmatter',
  'types',
  'fields',
  'unknownKeys',
  'exactlyOneOf',
  'anyOf',
  'allOf',
] as const;

/** Every key a field constraint may carry. */
const CONSTRAINT_KEYS = [
  'presence',
  'minLength',
  'maxLength',
  'format',
  'pattern',
  'minItems',
  'maxItems',
  'itemMaxLength',
  'allowed',
  'intent',
] as const;

const FORMATS: OkfFormat[] = ['datetime', 'uri', 'actor'];

function everyRuleKey(): Set<string> {
  const seen = new Set<string>();
  for (const rule of config.rules) for (const key of Object.keys(rule)) seen.add(key);
  return seen;
}

function everyConstraint(): OkfFieldConstraints[] {
  return config.rules.flatMap((rule) => Object.values(rule.fields ?? {}));
}

describe('valid-test-config.yml is a complete test surface', () => {
  it('parses into the two top-level keys', () => {
    expect(Object.keys(config).sort()).toEqual(['rules', 'types']);
    expect(config.rules.length).toBeGreaterThan(0);
  });

  it.each(RULE_KEYS)('exercises the rule key %s', (key) => {
    expect(everyRuleKey()).toContain(key);
  });

  it.each(CONSTRAINT_KEYS)('exercises the constraint %s', (key) => {
    expect(everyConstraint().some((c) => key in c)).toBe(true);
  });

  it.each(FORMATS)('exercises the named format %s', (format) => {
    expect(everyConstraint().some((c) => c.format === format)).toBe(true);
  });

  it('reaches both nesting depths', () => {
    const addresses = config.rules.flatMap((r) => Object.keys(r.fields ?? {}));
    expect(addresses.some((a) => a.includes('[].'))).toBe(true);
    expect(addresses.some((a) => a.includes('.') && !a.includes('[]'))).toBe(true);
  });

  it('addresses a list and its entries separately', () => {
    const addresses = new Set(config.rules.flatMap((r) => Object.keys(r.fields ?? {})));
    expect(addresses).toContain('sources');
    expect(addresses).toContain('sources[].resource');
  });
});

describe('valid-test-config.yml obeys the config-validity rules', () => {
  it('gives every rule exactly one selector', () => {
    for (const rule of config.rules) {
      const selectors = ['path', 'fileName'].filter((k) => k in rule);
      expect(selectors, JSON.stringify(rule.intent)).toHaveLength(1);
    }
  });

  it('gives every rule an intent', () => {
    for (const rule of config.rules) expect(rule.intent).toBeTruthy();
  });

  it('gives every pattern a sibling intent', () => {
    for (const constraint of everyConstraint()) {
      if ('pattern' in constraint) expect(constraint.intent).toBeTruthy();
    }
  });

  it('leaves a frontmatter-forbidden rule with no payload', () => {
    const payload = ['types', 'fields', 'unknownKeys', 'exactlyOneOf', 'anyOf', 'allOf'];
    for (const rule of config.rules) {
      if (!('frontmatter' in rule)) continue;
      expect(rule.frontmatter).toBe('forbidden');
      expect(payload.filter((k) => k in rule)).toEqual([]);
    }
  });

  it('subsets every rule-level types to the declared vocabulary', () => {
    const vocabulary = new Set((config.types ?? []).map((t) => t.name));
    for (const rule of config.rules) {
      for (const name of rule.types ?? []) expect(vocabulary).toContain(name);
    }
  });

  it('never writes allowed on the type field', () => {
    for (const rule of config.rules) expect(rule.fields?.type?.allowed).toBeUndefined();
  });

  it('rejects an intent that is present but empty', () => {
    for (const record of config.types ?? []) {
      if ('intent' in record) expect(record.intent).toBeTruthy();
    }
  });
});
