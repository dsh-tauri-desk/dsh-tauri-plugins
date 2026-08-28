import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // happy-dom 同时覆盖 DOM 对账测试与 node:fs 宿主测试（仍运行于 Node）。
    environment: 'happy-dom',
    include: ['test/**/*.test.ts', 'src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
})
