import { useEffect, useState } from 'react';
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<T>,
  dependencies: unknown[],
  keepPreviousData = false,
) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setState((previous) => ({
      data: keepPreviousData ? previous.data : null,
      loading: true,
      error: null,
    }));
    void load(controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState((previous) => ({
            data: keepPreviousData ? previous.data : null,
            loading: false,
            error: error instanceof Error ? error.message : 'Errore inatteso.',
          }));
      });
    return () => controller.abort();
  }, [...dependencies, revision]);
  return { ...state, retry: () => setRevision((v) => v + 1) };
}
