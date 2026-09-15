import Dexie, { type EntityTable } from 'dexie'

export interface QueuedEvent {
  id: string // client-generated UUID, doubles as the idempotency key
  eventType: string
  payload: Record<string, unknown>
  occurredAt: string
  status: 'pending' | 'synced' | 'failed'
  createdAt: string
}

export const db = new Dexie('agri-field') as Dexie & {
  events: EntityTable<QueuedEvent, 'id'>
}

db.version(1).stores({
  events: 'id, status, createdAt',
})
