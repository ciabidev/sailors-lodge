import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const listeners = new Set<(key?: unknown[]) => void>();
export class QueryClient {
  constructor(_options?: unknown) {}
  invalidateQueries({ queryKey }: { queryKey?: unknown[] } = {}) { listeners.forEach((listener) => listener(queryKey)); }
}
const client = new QueryClient();
export function QueryClientProvider({ children }: { client: QueryClient; children: ReactNode }) { return children; }
export function useQueryClient() { return client; }

export function useQuery<T>({ queryKey, queryFn, enabled = true }: { queryKey: unknown[]; queryFn: () => Promise<T>; enabled?: boolean }) {
  const [data, setData] = useState<T>(); const [error, setError] = useState<Error>(); const [isLoading, setLoading] = useState(enabled);
  const key = JSON.stringify(queryKey); const fn = useRef(queryFn); fn.current = queryFn;
  const refetch = useCallback(async () => { if (!enabled) return; setLoading(true); setError(undefined); try { const value = await fn.current(); setData(value); return value; } catch (reason) { setError(reason as Error); } finally { setLoading(false); } }, [enabled, key]);
  useEffect(() => { if (enabled) void refetch(); else setLoading(false); }, [refetch, enabled]);
  useEffect(() => { const listener = (target?: unknown[]) => { if (!target || JSON.stringify(queryKey.slice(0, target.length)) === JSON.stringify(target)) void refetch(); }; listeners.add(listener); return () => { listeners.delete(listener); }; }, [key, refetch]);
  return { data, error, isLoading, isError: Boolean(error), refetch };
}

export function useMutation<TInput = void, TResult = unknown>({ mutationFn, onSuccess, onError }: { mutationFn: (input: TInput) => Promise<TResult>; onSuccess?: (result: TResult) => void; onError?: (error: Error) => void }) {
  const [isPending, setPending] = useState(false);
  const mutate = async (input: TInput) => { setPending(true); try { const result = await mutationFn(input); onSuccess?.(result); return result; } catch (reason) { onError?.(reason as Error); } finally { setPending(false); } };
  return { mutate, isPending };
}
