import type { UserConfig } from 'tsdown'

export const dshExternal = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  /^@deepseek-ai\//,
]

export function defineDshConfig(options: UserConfig = {}): UserConfig[] {
  const common: UserConfig = {
    outDir: 'dist',
    format: 'esm',
    outExtensions: () => ({ js: '.js' }),
    publint: true,
    external: dshExternal,
    ...options,
  }

  return [
    {
      ...common,
      entry: { index: 'src/index.ts' },
      dts: true,
      sourcemap: false,
      clean: true,
    },
    {
      ...common,
      entry: { client: 'src/client/index.ts' },
      dts: false,
      sourcemap: true,
      minify: true,
      clean: false,
    },
  ]
}

export { defineConfig } from 'tsdown'
export type { UserConfig } from 'tsdown'
