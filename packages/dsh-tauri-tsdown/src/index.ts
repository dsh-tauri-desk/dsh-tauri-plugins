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
  return {
    banner: `window.__ModuleLoader__.load({id:${id},factory:(require)=>{const loaderRequire=require;const resolve=(specifier)=>specifier.endsWith('/client')?specifier.slice(0,-7):specifier;require=(specifier)=>loaderRequire(resolve(specifier));var module={exports:{}};var exports=module.exports;`,
    footer: 'return module.exports;}});',
  }
}

export const dshExternal = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  /^@deepseek-ai\//,
]

interface DshConfig {
  server?: UserConfig
  client?: UserConfig
}

export function defineDshConfig(options: DshConfig = {}): UserConfig[] {
  const common: UserConfig = {
    outDir: 'dist',
    format: 'esm',
    outExtensions: () => ({ js: '.js' }),
    publint: true,
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
      ...options.client,
      entry: { client: 'src/client/index.ts' },
      // Client bundles are classic scripts consumed by dsh-client-modules.
      // CJS output is required so its exports remain inside the loader factory.
      format: 'cjs',
      define: { 'process.env.NODE_ENV': JSON.stringify('production') },
      ...clientBundleRegistration(),
      dts: false,
      sourcemap: true,
      minify: true,
      clean: false,
    },
  ]
}

export { defineConfig } from 'tsdown'
export type { UserConfig } from 'tsdown'
