import { useCallback, useEffect, useState } from "react";
import { api } from "../lib/api";
export function useResource(path) {
  const [state, setState] = useState({
    data: null,
    error: null,
    loading: true,
  });
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const abort = new AbortController();
    setState({ data: null, error: null, loading: true });
    api(path, { signal: abort.signal })
      .then((data) => {
        if (!abort.signal.aborted)
          setState({ data, error: null, loading: false });
      })
      .catch((error) => {
        if (!abort.signal.aborted)
          setState({ data: null, error, loading: false });
      });
    return () => abort.abort();
  }, [path, revision]);
  return { ...state, reload };
}
