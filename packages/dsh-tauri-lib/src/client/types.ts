/** Shared client type exports backed by the installed DSH client contracts. */
import type { Context } from '@deepseek-ai/cordis'
import type {
  ISessions,
  IWorkspaces,
  SessionListState,
  SessionSummary,
  SlotRegistry,
  WorkspaceId,
} from '@deepseek-ai/dsh-client-runtime/client'
import type { ILayout } from '@deepseek-ai/dsh-client-ui-layout/client'

/** Cordis context with the client services consumed by the Tauri plugins. */
export type ClientContext = Context & {
  locale: LocaleService
  layout: ILayout
}

/** Real runtime slot registry contract. */
export type { SlotRegistry }
/** Real runtime session list state and summary contracts. */
export type { SessionListState, SessionSummary }
/** Real runtime workspace identifier contract. */
export type { WorkspaceId }
/** Real runtime outward session/workspace faces. */
export type { ISessions, IWorkspaces }
/** Locale face used by the installed locale plugin. */
export interface LocaleService {
  register: (namespace: string, locale: string, dict: Record<string, unknown>) => () => void
  getLocale: () => { active: string }
  subscribe: (onChange: () => void) => () => void
}
/** Layout action face exported by dsh-client-ui-layout. */
export type { ILayout }

/** Runtime session service projection used by legacy plugin helpers. */
export interface SessionsRuntime {
  list: {
    getSnapshot: () => unknown
    subscribe: (listener: () => void) => () => void
  }
}

/** Runtime workspace service projection used by legacy plugin helpers. */
export interface WorkspacesRuntime {
  list: {
    getSnapshot: () => unknown
    subscribe: (listener: () => void) => () => void
  }
  startSession: (workspaceId?: WorkspaceId) => void
}

/** Compatibility alias for callers that need only the layout action. */
export type LayoutService = ILayout
