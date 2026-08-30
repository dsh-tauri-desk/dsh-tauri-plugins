import type { UserConfig } from 'tsdown'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

function clientBundleRegistration(): Pick<UserConfig, 'banner' | 'footer'> {
  const packageName = process.env.npm_package_name
  const pkg = packageName
    ? { name: packageName }
    : JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as { name: string }
  const id = JSON.stringify(pkg.name)
  // Only the JS bundle is a runtime script wrapped in the ModuleLoader factory.
  // Declaration files must stay real ES modules (top-level import/export) —
  // wrapping them breaks types ("file is not a module") — so apply the wrapper
  // exclusively to JS outputs via the `{ js }` addon form.
  return {
    banner: {
      js: `window.__ModuleLoader__.load({id:${id},factory:(require)=>{const loaderRequire=require;const resolve=(specifier)=>specifier.endsWith('/client')?specifier.slice(0,-7):specifier;require=(specifier)=>loaderRequire(resolve(specifier));var module={exports:{}};var exports=module.exports;`,
    },
    footer: {
      js: 'return module.exports;}});',
    },
  }
}

export const dshExternal = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  'dsh-tauri',
  'dsh-tauri-utils',
  'dsh-tauri/client',
  /^@deepseek-ai\//,
]

interface DshConfig {
  /**
   * Package-level publint toggle (defaults to `true`). Turn it off for packages
   * whose client bundle inlines CJS deps (e.g. css-render) that publint's static
   * scan mistakes for `exports.__esModule + exports.default` — the assignment
   * lives in a sealed module wrapper and never reaches the real module exports.
   */
  publint?: UserConfig['publint']
  server?: UserConfig
  client?: UserConfig
}

export function defineDshConfig(options: DshConfig = {}): UserConfig[] {
  const common: UserConfig = {
    outDir: 'dist',
    format: 'esm',
    outExtensions: () => ({ js: '.js' }),
    publint: options.publint ?? true,
    external: dshExternal,
  }

  return [
    {
      ...common,
      ...options.server,
      entry: { index: 'src/index.ts' },
      dts: true,
      sourcemap: false,
      clean: true,
    },
    {
      ...common,
      entry: { client: 'src/client/index.ts' },
      // Client bundles are classic scripts consumed by dsh-client-modules.
      // CJS output is required so its exports remain inside the loader factory.
      format: 'cjs',
      // CJS must not use `.js` in a `"type": "module"` package — publint would
      // flag the ESM/CJS mismatch. Emit `.cjs` (declarations pair as `.d.cts`).
      outExtensions: () => ({ js: '.cjs' }),
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      ...clientBundleRegistration(),
      // The client entry is deliberately a classic CJS script wrapped by ModuleLoader;
      // publint's ESM/CJS default-export heuristic is inapplicable.
      publint: false,
      dts: false,
      sourcemap: true,
      minify: true,
      clean: false,
      ...options.client,
    },
  ]
}

export { defineConfig } from 'tsdown'
export type { UserConfig } from 'tsdown'
