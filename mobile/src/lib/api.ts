export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://10.0.2.2:8000'

export async function checkHealth(): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/health`, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: data.status === 'ok', detail: JSON.stringify(data) }
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : 'unknown error' }
  }
}
