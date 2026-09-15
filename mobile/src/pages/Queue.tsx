import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'

function newId(): string {
  return crypto.randomUUID()
}

export default function Queue() {
  const events = useLiveQuery(() => db.events.orderBy('createdAt').reverse().toArray(), [])

  async function addTestEvent() {
    const now = new Date().toISOString()
    await db.events.add({
      id: newId(),
      eventType: 'collect',
      payload: { note: 'test capture', createdOffline: true },
      occurredAt: now,
      status: 'pending',
      createdAt: now,
    })
  }

  async function clearAll() {
    await db.events.clear()
  }

  return (
    <section className="screen">
      <h1>Offline Queue</h1>
      <p className="muted">
        Events captured here are written to IndexedDB immediately and synced when connectivity
        returns. This is the foundation for the offline write queue (M-03).
      </p>

      <div className="button-row">
        <button onClick={addTestEvent}>Add test event</button>
        <button onClick={clearAll} className="secondary">
          Clear
        </button>
      </div>

      <ul className="event-list">
        {events?.length === 0 && <li className="muted">No queued events yet.</li>}
        {events?.map((e) => (
          <li key={e.id}>
            <span className={`badge badge-${e.status}`}>{e.status}</span>
            <strong>{e.eventType}</strong>
            <span className="muted small"> {new Date(e.createdAt).toLocaleTimeString()}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
