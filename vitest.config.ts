import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['e2e/**', 'node_modules/**'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      include: [
        'src/utils.ts',
        'src/services/**',
        'src/hooks/**',
        'src/components/**',
        'server.ts',
      ],
    },
  },
});
