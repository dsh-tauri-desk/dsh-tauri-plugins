import { defineDshConfig } from 'dsh-tauri-tsdown'

export default defineDshConfig({
  server: {
    // Client exports are deliberate classic CJS ModuleLoader bundles. Publint's
    // default-export warning does not apply and must not become a CI error.
    publint: { level: 'error' },
  },
  client: {
    dts: true,
  },
})
