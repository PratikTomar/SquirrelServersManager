import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    setupFiles: './vitest.setup.ts',
    env: {
      SECRET: 'test',
      NODE_ENV: 'test',
    },
  },
});
