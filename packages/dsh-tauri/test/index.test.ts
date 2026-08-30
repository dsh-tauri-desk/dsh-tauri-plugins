import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

interface PackageManifest {
  exports: Record<string, string | Record<string, string>>
}

const manifest = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageManifest

describe('package exports', () => {
  it('keeps a default client export for DSH client-module discovery', () => {
    expect(manifest.exports['./client']).toMatchObject({
      types: './dist/client.d.cts',
      import: './dist/client.cjs',
      require: './dist/client.cjs',
      default: './dist/client.cjs',
    })
  })
})
