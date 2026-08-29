// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    type: 'lib',
    pnpm: true,
  },
  {
    // Vendored skills are shipped as-is (never linted); mirror the `skills`
    // ignore in .gitignore so CI (fresh installs) and local runs agree.
    ignores: ['**/skills/**'],
  },
)
