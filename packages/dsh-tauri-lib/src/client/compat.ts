import type { ClientContext } from './types'

/**
 * The small rc.2 surface consumed by the Tauri plugins.  Alpha moved the
 * session list store below `sessions.list` and moved workspace navigation to
 * `uiWorkspace`; keep that translation at the boundary instead of making each
 * plugin know which core it is running on.
 *
 * IMPORTANT (alpha `cordis-client-runner` `dynamicCordisContext`): the ctx a
 * client plugin's `apply` receives is a STRICT Proxy:
 *   - `ctx.<service>` for a service NOT in the plugin's `inject` array THROWS;
 *   - `ctx.get(name)` is the safe OPTIONAL lookup (returns `undefined`, never throws);
 *   - `{...ctx}` on that Proxy yields `{}` (the target is empty), so NEVER spread it.
 * This adapter therefore reads non-declared services via `ctx.get(...)` and
 * returns a forwarding Proxy (never a spread copy) so every ctx member/method
 * keeps working.
 */
type RuntimeObject = Record<string, unknown>

/** Optional service lookup that never throws (prefers `ctx.get(name)`). */
function lookup(ctx: ClientContext, name: string): unknown {
  const anyCtx = ctx as unknown as RuntimeObject
  const get = anyCtx.get as ((n: string) => unknown) | undefined
  if (typeof get === 'function')
    return get(name)
  return anyCtx[name]
}

function bindSnapshotService(value: unknown): RuntimeObject | undefined {
  if (!value || (typeof value !== 'object' && typeof value !== 'function'))
    return undefined
  return new Proxy(value as object, {
    get(target, prop) {
      const member = Reflect.get(target, prop)
      if (typeof member === 'function')
        return member.bind(target)
      return member
    },
  }) as RuntimeObject
}

function isAlpha(ctx: ClientContext): boolean {
  // `sessions` is a declared service in every plugin that reaches here, so a
  // direct read is safe on BOTH cores.  Alpha nests the store under `.list` and
  // drops the root `getSnapshot`; older cores expose the root shape.
  const sessions = lookup(ctx, 'sessions') as RuntimeObject | undefined
  if (
    sessions !== undefined
    && sessions.list !== undefined
    && typeof sessions.getSnapshot !== 'function'
  ) {
    return true
  }
  // uiWorkspace is NEVER declared by the plugins, so only the optional lookup
  // may read it (a direct read would throw on the strict alpha ctx).
  return lookup(ctx, 'uiWorkspace') !== undefined
}

/** Adapt alpha's nested list/navigation services to the rc.2 plugin contract. */
export function compatCtx(ctx: ClientContext): ClientContext {
  if (!isAlpha(ctx))
    return ctx

  const alphaSessions = (lookup(ctx, 'sessions') ?? {}) as RuntimeObject
  const alphaWorkspaces = (lookup(ctx, 'workspaces') ?? {}) as RuntimeObject
  const uiWorkspace = lookup(ctx, 'uiWorkspace') as RuntimeObject | undefined
  const uiSession = lookup(ctx, 'uiSession') as RuntimeObject | undefined
  const list = bindSnapshotService(alphaSessions.list)
  const workspaceList = bindSnapshotService(alphaWorkspaces.list)

  const sessions = new Proxy(alphaSessions as object, {
    get(target, prop) {
      if (prop === 'list')
        return list
      if (prop === 'getSnapshot')
        return () => (list?.getSnapshot as () => unknown | undefined)?.()
      if (prop === 'subscribe')
        return (listener: () => void) => (list?.subscribe as (l: () => void) => () => void | undefined)?.(listener)
      if (prop === 'provideInfo')
        return (id: string): unknown => provideInfo(alphaSessions, id, uiSession)
      const member = Reflect.get(target, prop)
      return typeof member === 'function' ? member.bind(target) : member
    },
  }) as unknown as RuntimeObject

  const workspaces = new Proxy(alphaWorkspaces as object, {
    get(target, prop) {
      if (prop === 'startSession') {
        return typeof (uiWorkspace as { startSession?: unknown } | undefined)?.startSession === 'function'
          ? (id?: string) => ((uiWorkspace as RuntimeObject).startSession as (id?: string) => void).call(uiWorkspace, id)
          : undefined
      }
      if (prop === 'connectWorkspace') {
        return typeof (uiWorkspace as { connectWorkspace?: unknown } | undefined)?.connectWorkspace === 'function'
          ? (id: string) => ((uiWorkspace as RuntimeObject).connectWorkspace as (id: string) => Promise<string>).call(uiWorkspace, id)
          : undefined
      }
      if (prop === 'list')
        return workspaceList
      return Reflect.get(target, prop)
    },
  }) as unknown as RuntimeObject

  return new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'sessions')
        return sessions
      if (prop === 'workspaces')
        return workspaces
      return Reflect.get(target, prop)
    },
  }) as unknown as ClientContext
}

/**
 * Alpha deliberately does not expose the old per-session info lookup.  Try
 * documented scope/provide implementations when a shell supplies one, but
 * never make a plugin fail merely because that optional bridge is absent.
 */
function provideInfo(sessions: RuntimeObject, id: string, uiSession: RuntimeObject | undefined): unknown {
  const binding = typeof sessions.binding === 'function'
    ? (sessions.binding as (id: string) => RuntimeObject | undefined).call(sessions, id)
    : undefined
  if (!binding)
    return undefined

  // Alpha publishes inputActions through UiSession.adapter.resolve(), not on
  // binding.ctx. Keep this lookup optional: uiSession is not part of the old
  // plugin inject roster and may be unavailable during session creation.
  const adapter = uiSession?.adapter as RuntimeObject | undefined
  const resolve = adapter?.resolve
  if (typeof resolve === 'function') {
    try {
      const projected = (resolve as (sessionId: string) => RuntimeObject | undefined).call(adapter, id)
      const props = projected?.props as RuntimeObject | undefined
      const inputActions = props?.inputActions
      if (inputActions !== undefined)
        return { props: { inputActions } }
    }
    catch {
      // The binding can disappear while a newly-created session is materialized.
    }
  }
  return undefined
}
