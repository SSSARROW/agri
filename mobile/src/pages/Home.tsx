import { useEffect, useState } from 'react'
import { checkHealth } from '../lib/api'

export default function Home() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking')
  const [detail, setDetail] = useState('')

  useEffect(() => {
    let cancelled = false
    checkHealth().then((result) => {
      if (cancelled) return
      setStatus(result.ok ? 'ok' : 'down')
      setDetail(result.detail)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <section className="screen">
      <h1>Agri Field Capture</h1>
      <p className="muted">Collector and field officer capture app.</p>

      <div className={`status-card status-${status}`}>
        <strong>Backend:</strong>{' '}
        {status === 'checking' && 'checking…'}
        {status === 'ok' && 'connected'}
        {status === 'down' && `unreachable (${detail})`}
      </div>

      <p className="muted small">
        Running in an emulator, the API is reached at <code>10.0.2.2</code>, which the Android
        emulator maps back to your dev machine's <code>localhost</code>.
      </p>
    </section>
  )
}
