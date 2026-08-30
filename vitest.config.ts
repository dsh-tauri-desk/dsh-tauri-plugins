import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      'dsh-tauri-utils': resolve(__dirname, 'packages/dsh-tauri-utils/src/index.ts'),
    },
  },
  test: {
    projects: [
      // root level test/**/*.test.ts
      {
        test: {
          name: 'root',
          include: ['test/**/*.test.ts'],
        },
      },
      // each sub package: use the vitest.config in the sub package directory
      'packages/*',
    ],
  },
})
