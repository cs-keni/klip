import { useRef, useEffect } from 'react'
import { PEAKS_PER_SEC } from '@/hooks/useWaveform'

interface WaveformCanvasProps {
  peaks: Float32Array
  trimStart: number
  duration: number
  /** CSS color string for the waveform bars. */
  color: string
  opacity?: number
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

/**
 * Canvas-based waveform renderer.
 * Bars grow up from the baseline when peaks first arrive (450ms ease-out),
 * then redraw instantly on resize. One bar per pixel.
 */
export default function WaveformCanvas({
  peaks,
  trimStart,
  duration,
  color,
  opacity = 0.45
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // Cancel any in-progress grow animation from a previous peaks value
    cancelAnimationFrame(rafRef.current)

    const GROW_DURATION = 450 // ms
    const startTime = performance.now()

    function drawAtScale(scale: number) {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      if (w === 0 || h === 0) return

      canvas!.width  = w
      canvas!.height = h

      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color

      const startIdx = Math.floor(trimStart * PEAKS_PER_SEC)
      const numPeaks = Math.ceil(duration   * PEAKS_PER_SEC)
      const centerY  = h / 2

      for (let px = 0; px < w; px++) {
        const peakIdx = startIdx + Math.floor((px / w) * numPeaks)
        if (peakIdx >= peaks.length) break
        const amp  = peaks[peakIdx]
        const barH = Math.max(1, amp * h * 0.9 * scale)
        ctx.fillRect(px, centerY - barH / 2, 1, barH)
      }
    }

    function growFrame(now: number) {
      const elapsed  = now - startTime
      const progress = Math.min(1, elapsed / GROW_DURATION)
      const scale    = easeOutCubic(progress)

      drawAtScale(scale)

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(growFrame)
      }
    }

    // Kick off the grow animation
    rafRef.current = requestAnimationFrame(growFrame)

    // On resize, draw at full scale immediately (skip grow)
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(rafRef.current)
      drawAtScale(1)
    })
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(rafRef.current)
      ro.disconnect()
    }
  }, [peaks, trimStart, duration, color])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
    />
  )
}
