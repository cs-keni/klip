import { protocol } from 'electron'
import { createReadStream, statSync } from 'fs'
import { extname } from 'path'
import { Readable } from 'stream'

const MIME_TYPES: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.webm': 'video/webm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp'
}

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

/**
 * Must be called synchronously before app.whenReady() so Electron registers
 * the scheme before any BrowserWindow is created.
 */
export function registerKlipScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'klip',
      privileges: {
        secure: true,      // treated like https — allows use in secure contexts
        standard: true,    // enables proper URL parsing (host, pathname, etc.)
        stream: true,      // required for streaming large video files
        bypassCSP: true,   // bypass Content-Security-Policy restrictions
        corsEnabled: true  // allow CORS requests so canvas.toDataURL() works
      }
    }
  ])
}

/**
 * Must be called inside app.whenReady().
 *
 * Serves local files via klip://local/<path> with proper CORS and range-request
 * support so:
 *   - The renderer can load file:// media without cross-origin tainting
 *   - Video elements can seek (requires HTTP 206 partial content)
 *   - canvas.toDataURL() works without SecurityError
 */
export function registerLocalFileProtocol(): void {
  protocol.handle('klip', (request) => {
    try {
      const url = new URL(request.url)
      // pathname looks like:
      //   Windows: /C:/Users/... → strip leading / → C:/Users/...
      //   Unix:   //mnt/c/...   → strip leading / → /mnt/c/...
      let filePath = decodeURIComponent(url.pathname)
      if (/^\/[A-Za-z]:\//.test(filePath)) {
        filePath = filePath.slice(1) // remove leading / before drive letter
      }

      const stat = statSync(filePath)
      const size = stat.size
      const mime = getMimeType(filePath)

      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Content-Type': mime,
        'Accept-Ranges': 'bytes'
      }

      // Handle range requests (required for video seeking)
      const rangeHeader = request.headers.get('range')
      if (rangeHeader) {
        const [, rangeStr] = rangeHeader.split('=')
        const [startStr, endStr] = rangeStr.split('-')
        const start = parseInt(startStr, 10) || 0
        const end = endStr ? parseInt(endStr, 10) : size - 1
        const chunkSize = end - start + 1

        const nodeStream = createReadStream(filePath, { start, end })
        const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

        return new Response(webStream, {
          status: 206,
          headers: {
            ...corsHeaders,
            'Content-Length': String(chunkSize),
            'Content-Range': `bytes ${start}-${end}/${size}`
          }
        })
      }

      // Full file response
      const nodeStream = createReadStream(filePath)
      const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>

      return new Response(webStream, {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Length': String(size)
        }
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return new Response(`File error: ${message}`, { status: 404 })
    }
  })
}
