import { isAbsolute } from 'path'

/**
 * Returns true only for http:// and https:// URLs.
 *
 * Used by setWindowOpenHandler to prevent shell.openExternal from launching
 * local files (file://), executing JS (javascript:), or leaking data (data:).
 */
export function isAllowedExternalUrl(url: string): boolean {
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Returns true when outputPath is a safe absolute path with no traversal segments.
 *
 * Rejects:
 *   - Relative paths (not under a user-controlled absolute root)
 *   - Paths containing ".." segments (directory traversal)
 *   - Empty strings
 */
export function isExportPathSafe(outputPath: string): boolean {
  if (!outputPath) return false
  if (!isAbsolute(outputPath)) return false
  const segments = outputPath.replace(/\\/g, '/').split('/')
  return !segments.includes('..')
}
