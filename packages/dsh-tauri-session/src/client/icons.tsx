import type { ReactElement } from 'react'

/** gravity-ui 风格的小图标（16px viewBox，currentColor）。 */

export function TrashIcon(): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M6.5 1.75c-.45 0-.93.2-1.26.56L4.4 3.25H2.5a.75.75 0 0 0 0 1.5h11a.75.75 0 0 0 0-1.5h-1.9l-.84-.94A1.83 1.83 0 0 0 9.5 1.75h-3Zm4.63 4H4.87L4.05 12.5A1.5 1.5 0 0 0 5.54 14h4.92a1.5 1.5 0 0 0 1.49-1.5l-.82-6.75Z" clipRule="evenodd" /></svg>
  )
}

export function FolderIcon(): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.09c.4 0 .78.16 1.06.44l.9.9a.5.5 0 0 0 .36.16H12.5A1.5 1.5 0 0 1 14 5v7a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12V3.5Z" clipRule="evenodd" /></svg>
  )
}

export function RestoreIcon(): ReactElement {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="none" viewBox="0 0 16 16"><path fill="currentColor" fillRule="evenodd" d="M8 2.25a5.75 5.75 0 1 0 5.75 5.75.75.75 0 0 0-1.5 0A4.25 4.25 0 1 1 8 3.75c.9 0 1.73.28 2.42.75H9.25a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 .75-.75v-3.5a.75.75 0 0 0-1.5 0v.9A5.72 5.72 0 0 0 8 2.25Z" clipRule="evenodd" /></svg>
  )
}
