import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: [
      'tests/unit/**/*.test.js',
      'tests/property/**/*.property.test.js',
      'tests/integration/**/*.test.js',
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
    },
  },
});
