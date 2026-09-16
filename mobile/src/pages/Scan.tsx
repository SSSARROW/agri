import { useState } from 'react'
import { db } from '../lib/db'
import { useBarcodeScanner } from '../lib/scanner'

interface RecentScan {
  code: string
  at: number
}

export default function Scan() {
  const [recent, setRecent] = useState<RecentScan[]>([])

  async function handleScan(code: string) {
    setRecent((prev) => [{ code, at: Date.now() }, ...prev].slice(0, 10))
    const now = new Date().toISOString()
    await db.events.add({
      id: crypto.randomUUID(),
      eventType: 'scan',
      payload: { code },
      occurredAt: now,
      status: 'pending',
      createdAt: now,
    })
  }

  const { status, error, videoRef, containerId } = useBarcodeScanner({ onScan: handleScan })
  const usingNative = 'BarcodeDetector' in window

  return (
    <section className="screen">
      <h1>Scan</h1>
      <p className="muted">Point the camera at a batch or plot QR label. Scanning continues automatically.</p>

      <div className="scan-viewport">
        {usingNative ? (
          <video ref={videoRef} className="scan-video" muted playsInline />
        ) : (
          <div id={containerId} className="scan-video" />
        )}
        {status === 'starting' && <div className="scan-overlay">Starting camera…</div>}
        {status === 'error' && (
          <div className="scan-overlay scan-overlay-error">
            Camera unavailable{error ? `: ${error}` : ''}
          </div>
        )}
      </div>

      <p className="muted small">
        {recent.length} scanned this session · queued for sync
      </p>

      <ul className="event-list">
        {recent.map((r) => (
          <li key={r.at}>
            <span className="badge badge-pending">new</span>
            <strong>{r.code}</strong>
          </li>
        ))}
      </ul>
    </section>
  )
}
