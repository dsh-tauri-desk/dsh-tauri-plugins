/** Stable client-side identifiers shared by the panel implementation. */
export const PANEL_PROTOCOL_SERVICE = 'panel.protocol'
export const PANEL_VIEW_SLOT = 'conversation'
export const PANEL_VIEW_COMPONENT_ID = 'dsh-tauri-panel-conversation-seat'
export const PANEL_STYLE_ID = 'dsh-tauri-panel-styles'
export const COLLAPSE_SETTLE_MS = 150
export const SCROLLBAR_LINGER_MS = 2000

export const PANEL_CLASSES = {
  root: 'dshp-root',
  collapsed: 'dshp-collapsed',
  railIn: 'dshp-railIn',
  fading: 'dshp-fading',
  quietBars: 'dshp-quietBars',
  wide: 'dshp-wide',
  logoRow: 'dshp-logoRow',
  brand: 'dshp-brand',
  brandIdentity: 'dshp-brandIdentity',
  brandMark: 'dshp-brandMark',
  brandName: 'dshp-brandName',
  fallbackBrandName: 'dshp-fallbackBrandName',
  iconButton: 'dshp-iconButton',
  toggle: 'dshp-toggle',
  railMark: 'dshp-railMark',
  panelArea: 'dshp-panelArea',
  menuItem: 'dshp-menuItem',
  menuItemSelected: 'dshp-menuItemSelected',
  newSession: 'dshp-newSession',
  menuItemIcon: 'dshp-menuItemIcon',
  menuItemLabel: 'dshp-menuItemLabel',
  regionArea: 'dshp-regionArea',
  footArea: 'dshp-footArea',
  footerActions: 'dshp-footerActions',
  settingsArea: 'dshp-settingsArea',
  panelView: 'dshp-panelView',
  panelViewColumn: 'dshp-panelViewColumn',
} as const

export const PANEL_DATA_ATTRIBUTES = {
  sidebar: 'data-dshp-panel-sidebar',
  action: 'data-dshp-panel-action',
  view: 'data-dshp-panel-view',
} as const
