import assert from 'node:assert/strict'

let registration
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      registration = definition
    },
  },
}

await import(`../dist/client.cjs?bundle-check=${Date.now()}`)

assert.ok(registration, 'client bundle did not register with ModuleLoader')
assert.equal(registration.id, 'dsh-tauri')

const api = registration.factory((specifier) => {
  throw new Error(`unexpected external dependency: ${specifier}`)
})
const expectedExports = [
  'CssRender',
  'apply',
  'compat',
  'createExternalStore',
  'createRevisionSignal',
  'inject',
  'name',
]

assert.deepEqual(Object.keys(api).sort(), expectedExports)
assert.equal(Object.hasOwn(api, 'default'), false)
assert.equal(typeof api.CssRender, 'function')

const rendered = new api.CssRender()
  .c('.dsh-bundle-check', { color: 'red' })
  .render()
assert.match(rendered, /\.dsh-bundle-check/)
assert.match(rendered, /color: red/)

console.log('dsh-tauri client bundle contract passed')
