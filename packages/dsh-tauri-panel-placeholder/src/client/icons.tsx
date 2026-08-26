import type { ReactElement } from 'react'

/**
 * icons.tsx — 自绘内联 SVG 图标（Gravity 风格描边，currentColor）。
 * 不依赖 @deepseek-ai/dsh-client-ui-primitives 的类型/运行时（loader 模块表
 * 虽提供该模块，但自绘零外部表面、跨部署更稳）。
 */

export interface IconProps {
  size?: number
  className?: string
}

export function IconPlaceholder({ size = 16, className }: IconProps): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 16 16" fill="none" className={className} aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.5V8l2.5 1.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
