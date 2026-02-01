/**
 * Example utils sub-package: simple string helpers
 */
export function capitalize(s: string): string {
  if (!s)
    return s
  return s[0]!.toUpperCase() + s.slice(1)
}

export function join(parts: string[], sep = ' '): string {
  return parts.filter(Boolean).join(sep)
}
