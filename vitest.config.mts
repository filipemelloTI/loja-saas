import { defineConfig } from 'vitest/config'

// `.mts` para o Vite ler como ESM nativo (o `.ts` caía em CJS e disparava o aviso
// `ESM syntax in a file loaded as CommonJS`).
// `resolve.tsconfigPaths: true` substitui o plugin `vite-tsconfig-paths` — o Vite
// resolve os paths do `tsconfig.json` sem plugin desde a 7.x.
export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/unit/**/*.test.ts'],
  },
})
