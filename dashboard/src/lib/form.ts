import { useRef, useState } from 'react';

export function useForm<T extends Record<string, unknown>>({ defaultValues }: { defaultValues: T; resolver?: unknown }) {
  const [values, setValues] = useState<T>(defaultValues); const [dirty, setDirty] = useState(false); const defaults = useRef(defaultValues);
  return {
    register: (name: keyof T) => ({ name, value: String(values[name] ?? ''), onChange: (event: { target: { value: string } }) => { setValues((current) => ({ ...current, [name]: event.target.value })); setDirty(true); } }),
    watch: <K extends keyof T>(name: K): T[K] => values[name],
    setValue: <K extends keyof T>(name: K, value: T[K], options?: { shouldDirty?: boolean }) => { setValues((current) => ({ ...current, [name]: value })); if (options?.shouldDirty !== false) setDirty(true); },
    reset: (next: T) => { defaults.current = next; setValues(next); setDirty(false); },
    handleSubmit: (submit: (values: T) => void) => (event?: { preventDefault?: () => void }) => { event?.preventDefault?.(); submit(values); },
    formState: { isDirty: dirty },
  };
}
