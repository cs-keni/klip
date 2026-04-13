import { ipcMain, app } from 'electron'
import { spawn } from 'child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getFFmpegPath } from '../ffmpegExport'

// ── Cache directory ────────────────────────────────────────────────────────────

function getWaveformDir(): string {
  const dir = join(app.getPath('userData'), 'klip-waveforms')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getCachePath(clipId: string): string {
  return join(getWaveformDir(), `${clipId}.json`)
}

// ── Peak extraction via FFmpeg ─────────────────────────────────────────────────

/**
 * Extract audio peaks at 150 peaks/sec (matches PEAKS_PER_SEC in useWaveform.ts).
 * Uses FFmpeg to downsample mono audio to 600Hz, then groups 4 samples per peak.
 * Streaming approach — never buffers the full audio in memory.
 */
async function extractPeaks(filePath: string): Promise<number[] | null> {
  return new Promise((resolve) => {
    const ffmpeg = getFFmpegPath()

    // Mono, 600 Hz, raw float32-LE → pipe
    // 600 ÷ 4 = 150 peaks/sec (PEAKS_PER_SEC)
    const args = [
      '-i',  filePath,
      '-vn',
      '-ac', '1',
      '-ar', '600',
      '-f',  'f32le',
      'pipe:1'
    ]

    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] })

    let tail = Buffer.alloc(0)  // bytes leftover between chunks
    const peaks: number[] = []
    let chunkBuf: number[] = []
    const CHUNK = 4  // 600Hz / 150 peaks = 4 samples per peak

    proc.stdout?.on('data', (incoming: Buffer) => {
      // Prepend any leftover bytes from the previous chunk
      const buf = tail.length > 0 ? Buffer.concat([tail, incoming]) : incoming
      const floatCount = Math.floor(buf.length / 4)

      for (let i = 0; i < floatCount; i++) {
        const abs = Math.abs(buf.readFloatLE(i * 4))
        chunkBuf.push(abs)

        if (chunkBuf.length >= CHUNK) {
          peaks.push(Math.min(1, Math.max(...chunkBuf)))
          chunkBuf = []
        }
      }

      // Keep unprocessed bytes for next data event
      const consumed = floatCount * 4
      tail = consumed < buf.length ? buf.slice(consumed) : Buffer.alloc(0)
    })

    proc.on('close', (code) => {
      // Flush any remaining samples
      if (chunkBuf.length > 0) {
        peaks.push(Math.min(1, Math.max(...chunkBuf)))
      }

      if (code !== 0 && peaks.length === 0) {
        resolve(null)
      } else {
        resolve(peaks)
      }
    })

    proc.on('error', () => resolve(null))
  })
}

// ── Loudness analysis via FFmpeg loudnorm ──────────────────────────────────────

/**
 * Run FFmpeg's loudnorm filter in analysis mode.
 * Returns the integrated loudness (LUFS) of the input file.
 */
async function analyzeLoudness(filePath: string): Promise<{ inputI: number } | null> {
  return new Promise((resolve) => {
    const ffmpeg = getFFmpegPath()
    const args = [
      '-i',        filePath,
      '-vn',
      '-filter:a', 'loudnorm=print_format=json',
      '-f',        'null',
      '-'
    ]

    const proc = spawn(ffmpeg, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stderr = ''

    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString() })

    proc.on('close', () => {
      try {
        // loudnorm JSON block is printed to stderr
        const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/)
        if (!match) { resolve(null); return }
        const json = JSON.parse(match[0]) as { input_i: string }
        resolve({ inputI: parseFloat(json.input_i) })
      } catch {
        resolve(null)
      }
    })

    proc.on('error', () => resolve(null))
  })
}

// ── Register IPC handlers ──────────────────────────────────────────────────────

export function registerWaveformHandlers(): void {

  /**
   * Extract waveform peaks for a video clip.
   * Returns cached peaks immediately if available on disk.
   * Otherwise runs FFmpeg extraction (async, may take a few seconds).
   */
  ipcMain.handle(
    'media:extract-waveform',
    async (_, { clipId, filePath }: { clipId: string; filePath: string }): Promise<number[] | null> => {
      try {
        // Disk cache hit?
        const cachePath = getCachePath(clipId)
        if (existsSync(cachePath)) {
          return JSON.parse(readFileSync(cachePath, 'utf8')) as number[]
        }

        if (!existsSync(filePath)) return null

        const peaks = await extractPeaks(filePath)
        if (!peaks) return null

        // Persist to disk for future sessions
        writeFileSync(cachePath, JSON.stringify(peaks))
        return peaks
      } catch {
        return null
      }
    }
  )

  /**
   * Analyze the integrated loudness of a media file.
   * Returns { inputI } in LUFS, or null on failure.
   */
  ipcMain.handle(
    'media:analyze-loudness',
    async (_, { filePath }: { filePath: string }): Promise<{ inputI: number } | null> => {
      if (!existsSync(filePath)) return null
      return analyzeLoudness(filePath)
    }
  )
}
