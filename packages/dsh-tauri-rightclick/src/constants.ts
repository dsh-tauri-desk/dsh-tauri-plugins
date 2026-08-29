/** Host-half protocol constants for dsh-tauri-rightclick. */

export const RIGHTCLICK_PLUGIN_NAME = 'dsh-tauri-rightclick'
export const RIGHTCLICK_API_PREFIX = '/api/dsh-rightclick-menu'
/** 用系统默认浏览器打开外链（POST，同源 JSON）。 */
export const OPEN_URL_ROUTE = `${RIGHTCLICK_API_PREFIX}/open-url`

/** 请求体上限（删除/开链都只传一个小 JSON）。 */
export const MAX_BODY_BYTES = 64 * 1024

/** 会话 id 的允许字符集（宿主生成的 id 恒为 [A-Za-z0-9_-]）。 */
export const SESSION_ID_RE = /^[\w-]+$/
