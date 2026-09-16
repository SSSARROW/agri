import { Html5Qrcode } from 'html5-qrcode'
import { useEffect, useRef, useState } from 'react'

export type ScanStatus = 'idle' | 'starting' | 'scanning' | 'error' | 'unsupported'

interface UseScannerOptions {
  onScan: (code: string) => void
  /** Minimum time between accepted scans, so the same label isn't queued twice per pass. */
  debounceMs?: number
}

function hasNativeBarcodeDetector(): boolean {
  return 'BarcodeDetector' in window
}

function beep() {
  try {
    const ctx = new AudioContext()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.15, ctx.currentTime)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.12)
    osc.onended = () => ctx.close()
  } catch {
    // Audio isn't essential to a successful scan; ignore if the platform blocks it.
  }
}

function confirmScan(code: string, onScan: (code: string) => void) {
  beep()
  if (navigator.vibrate) navigator.vibrate(80)
  onScan(code)
}

/**
 * Continuous QR/barcode scanning. Prefers the native BarcodeDetector API (fast,
 * no extra decode library); falls back to html5-qrcode's camera pipeline on
 * browsers/WebViews that lack it.
 */
export function useBarcodeScanner({ onScan, debounceMs = 1500 }: UseScannerOptions) {
  const [status, setStatus] = useState<ScanStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerId = useRef(`scanner-${Math.random().toString(36).slice(2)}`)
  const lastScanRef = useRef<{ code: string; at: number } | null>(null)
  const stopNativeRef = useRef<(() => void) | null>(null)
  const html5QrRef = useRef<Html5Qrcode | null>(null)

  function acceptScan(code: string) {
    const last = lastScanRef.current
    const now = Date.now()
    if (last && last.code === code && now - last.at < debounceMs) return
    lastScanRef.current = { code, at: now }
    confirmScan(code, onScan)
  }

  useEffect(() => {
    let cancelled = false

    async function startNative(stream: MediaStream) {
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play()

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] })
      let raf = 0
      let stopped = false

      async function tick() {
        if (stopped || !video) return
        try {
          const codes = await detector.detect(video)
          if (codes.length > 0) acceptScan(codes[0].rawValue)
        } catch {
          // Transient decode errors are expected between frames; keep scanning.
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)

      stopNativeRef.current = () => {
        stopped = true
        cancelAnimationFrame(raf)
        stream.getTracks().forEach((t) => t.stop())
      }
    }

    async function startFallback() {
      const html5Qr = new Html5Qrcode(containerId.current)
      html5QrRef.current = html5Qr
      await html5Qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => acceptScan(decodedText),
        () => {
          // Per-frame "no code found" callback — expected on almost every frame.
        },
      )
    }

    async function start() {
      setStatus('starting')
      setError(null)
      try {
        if (hasNativeBarcodeDetector()) {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          })
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          await startNative(stream)
        } else {
          await startFallback()
        }
        if (!cancelled) setStatus('scanning')
      } catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Could not start the camera.')
        }
      }
    }

    start()

    return () => {
      cancelled = true
      stopNativeRef.current?.()
      html5QrRef.current
        ?.stop()
        .then(() => html5QrRef.current?.clear())
        .catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return { status, error, videoRef, containerId: containerId.current }
}
