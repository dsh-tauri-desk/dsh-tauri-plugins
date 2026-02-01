import { defineConfig } from 'vitest/config'

export default defineConfig({
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
