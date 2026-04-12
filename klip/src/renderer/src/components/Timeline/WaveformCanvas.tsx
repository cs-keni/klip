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

/**
 * Canvas-based waveform renderer.
 * One vertical bar per pixel — redraws automatically when resized via ResizeObserver.
 */
export default function WaveformCanvas({
  peaks,
  trimStart,
  duration,
  color,
  opacity = 0.45
}: WaveformCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function draw() {
      const w = canvas!.offsetWidth
      const h = canvas!.offsetHeight
      if (w === 0 || h === 0) return

      canvas!.width  = w
      canvas!.height = h

      const ctx = canvas!.getContext('2d')
      if (!ctx) return

      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = color

      const startIdx  = Math.floor(trimStart * PEAKS_PER_SEC)
      const numPeaks  = Math.ceil(duration   * PEAKS_PER_SEC)
      const centerY   = h / 2

      for (let px = 0; px < w; px++) {
        const peakIdx = startIdx + Math.floor((px / w) * numPeaks)
        if (peakIdx >= peaks.length) break

        const amp  = peaks[peakIdx]
        const barH = Math.max(1, amp * h * 0.9)
        ctx.fillRect(px, centerY - barH / 2, 1, barH)
      }
    }

    draw()

    const ro = new ResizeObserver(draw)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [peaks, trimStart, duration, color])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity }}
    />
  )
}
