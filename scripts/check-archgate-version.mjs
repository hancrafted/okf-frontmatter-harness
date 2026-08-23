#!/usr/bin/env node
/**
 * Assert that the archgate binary actually on PATH satisfies the version range
 * this repo declares in `devDependencies.archgate`.
 *
 * Why this exists (GEN-001 Consequences §2): the npm package ships no binary —
 * it is a 274-line shim that runs `~/.archgate/bin/archgate`, a single global,
 * unversioned cache shared by every project on the machine. The shim consults
 * its own package version only when that cache is *empty*; if a binary is
 * already there, it executes it with no version comparison. So the declared
 * range governs what a clean machine downloads, and nothing at all on a machine
 * that already has some other project's archgate cached.
 *
 * This check cannot be an archgate rule: a rule runs inside archgate, so a
 * wrong-version binary would be grading its own homework. The gate has to sit
 * outside the tool it is gating.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import semver from 'semver';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const range = pkg.devDependencies?.archgate;

if (!range) {
  console.error('✖ archgate is not declared in devDependencies — nothing to check against.');
  process.exit(1);
}

let installed;
try {
  // Bare `archgate`: npm puts node_modules/.bin on PATH, so this resolves to the
  // very same shim — and therefore the same binary — that `archgate check` will use.
  installed = execFileSync('archgate', ['--version'], { encoding: 'utf8' }).trim();
} catch (err) {
  console.error(`✖ could not run \`archgate --version\`: ${err.message}`);
  console.error('  Install it with `npm ci`, or see https://cli.archgate.dev/getting-started/installation/');
  process.exit(1);
}

if (!semver.valid(installed)) {
  console.error(`✖ \`archgate --version\` returned "${installed}", which is not a semver version.`);
  process.exit(1);
}

if (!semver.satisfies(installed, range)) {
  console.error(`✖ archgate ${installed} is outside the supported range "${range}".`);
  console.error('');
  console.error('  The ADR rules in .archgate/adrs have only been verified against that range.');
  console.error('  archgate 0.55 silently changed symlink resolution and inverted a rule that');
  console.error('  0.54 satisfied, so a version outside the range can pass or fail incorrectly.');
  console.error('');
  console.error('  The binary is a single global cache, not a per-repo install, so another');
  console.error(`  project on this machine may have replaced it. To restore a supported one:`);
  console.error('');
  console.error('      rm ~/.archgate/bin/archgate && npx archgate --version');
  console.error('');
  console.error(`  Or, if ${installed} is genuinely wanted: verify the rules against it`);
  console.error(`  (\`npm run verify\`) and widen "archgate" in package.json deliberately.`);
  process.exit(1);
}
