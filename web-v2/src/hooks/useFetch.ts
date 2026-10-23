"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { parseError } from "@/lib/api";

export interface FetchState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  status?: number;
  reload: () => void;
  setData: (d: T | null) => void;
}

/** Runs `fn` on mount and whenever `deps` change; ignores stale responses. */
export function useFetch<T>(fn: () => Promise<T>, deps: unknown[] = []): FetchState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | undefined>();
  const [tick, setTick] = useState(0);
  const run = useRef(0);

  useEffect(() => {
    const id = ++run.current;
    setLoading(true);
    setError(null);
    fn()
      .then((d) => { if (id === run.current) { setData(d); setStatus(undefined); } })
      .catch((e) => {
        if (id !== run.current) return;
        const p = parseError(e);
        setError(p.message);
        setStatus(p.status);
      })
      .finally(() => { if (id === run.current) setLoading(false); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, status, reload, setData };
}
