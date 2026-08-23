import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**', '**/.archgate/rules.d.ts'],
    coverage: {
      provider: 'v8',
    },
  },
});
