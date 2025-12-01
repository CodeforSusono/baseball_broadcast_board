import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Test environment for Node.js (main process, server tests)
    environment: 'node',

    // Enable global APIs (describe, it, expect) without imports
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: [
        'main.js',
        'server.js',
        'scripts/**/*.js',
      ],
      exclude: [
        'node_modules/**',
        'dist/**',
        'test/**',
        '**/*.test.js',
        '**/*.spec.js',
        'public/**',  // Exclude browser-side code for now
      ],
      // Thresholds for coverage
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    // Test file patterns
    include: ['test/**/*.test.js', 'test/**/*.spec.js'],

    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,

    // Exclude patterns
    exclude: [
      'node_modules/**',
      'dist/**',
      '.git/**',
      'test/unit/path-traversal.test.js', // Exclude old test file
    ],
  },
});
