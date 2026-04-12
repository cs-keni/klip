import { useState, useEffect } from 'react'
import { pathToFileUrl } from '@/lib/mediaUtils'

export interface WaveformState {
  peaks: Float32Array | null
  loading: boolean
}

/** Number of peak samples stored per second of audio. */
export const PEAKS_PER_SEC = 150

// ── Module-level cache (survives re-renders / remounts) ───────────────────────
const peaksCache  = new Map<string, Float32Array>()
const pendingReqs = new Map<string, Promise<Float32Array | null>>()

async function computePeaks(filePath: string): Promise<Float32Array | null> {
  try {
    const url      = pathToFileUrl(filePath)
    const response = await fetch(url)
    const buffer   = await response.arrayBuffer()

    const audioCtx    = new AudioContext()
    const audioBuffer = await audioCtx.decodeAudioData(buffer)
    await audioCtx.close()

    // Mix all channels down to mono
    const numChannels = audioBuffer.numberOfChannels
    const length      = audioBuffer.length
    const mono        = new Float32Array(length)
    for (let ch = 0; ch < numChannels; ch++) {
      const data = audioBuffer.getChannelData(ch)
      for (let i = 0; i < length; i++) mono[i] += data[i] / numChannels
    }

    const samplesPerPeak = Math.max(1, Math.floor(audioBuffer.sampleRate / PEAKS_PER_SEC))
    const numPeaks       = Math.ceil(length / samplesPerPeak)
    const peaks          = new Float32Array(numPeaks)

    for (let i = 0; i < numPeaks; i++) {
      const start = i * samplesPerPeak
      const end   = Math.min(start + samplesPerPeak, length)
      let   max   = 0
      for (let j = start; j < end; j++) {
        const abs = Math.abs(mono[j])
        if (abs > max) max = abs
      }
      peaks[i] = max
    }

    return peaks
  } catch {
    return null
  }
}

/**
 * Generates and caches audio waveform peaks for a media file.
 *
 * Only runs for 'audio' type clips — video waveforms require FFmpeg (Phase 7).
 * Uses a module-level cache so the same file is never decoded twice.
 */
export function useWaveform(path: string | null, type: string): WaveformState {
  const [state, setState] = useState<WaveformState>({ peaks: null, loading: false })

  useEffect(() => {
    if (!path || type !== 'audio') {
      setState({ peaks: null, loading: false })
      return
    }

    // Serve from cache immediately
    const cached = peaksCache.get(path)
    if (cached) {
      setState({ peaks: cached, loading: false })
      return
    }

    setState({ peaks: null, loading: true })
    let cancelled = false

    // Deduplicate concurrent requests for the same file
    let req = pendingReqs.get(path)
    if (!req) {
      req = computePeaks(path).then((p) => {
        pendingReqs.delete(path)
        if (p) peaksCache.set(path, p)
        return p
      })
      pendingReqs.set(path, req)
    }

    req.then((peaks) => {
      if (!cancelled) setState({ peaks: peaks ?? null, loading: false })
    })

    return () => { cancelled = true }
  }, [path, type])

  return state
}
