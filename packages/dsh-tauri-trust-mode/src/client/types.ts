/** 本插件自有界面文案键集合（zh/en 双语齐全）。 */
export type LocaleKey
  = | 'trustMode'
    | 'trustModeDesc'
    | 'trustModeOn'
    | 'trustModeOff'
    | 'trustModeHint'
    | 'saving'
    | 'error'

/** 设置分区内容组件的 props（由 dsh-tauri-ui 经 ownerProps 注入 close）。 */
export interface TrustModeSectionProps {
  close?: () => void
}
