import path from 'node:path';
import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    globals: true,
    root: './',
    include: ['test/e2e/**/*.e2e-spec.ts'],
    environment: 'node',
    // e2e sobe o Nest inteiro contra o Postgres do compose; evita corrida entre módulos.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
    setupFiles: [path.resolve(__dirname, 'e2e/setup.ts')],
  },
  plugins: [swc.vite()],
});
