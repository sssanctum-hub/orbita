import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

// Node's test runner owns scripts/*.test.mjs; Vitest owns the frontend tests.
export default mergeConfig(viteConfig, defineConfig({
  test: { include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] },
}));
