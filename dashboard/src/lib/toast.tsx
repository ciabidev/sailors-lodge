import { useEffect, useState } from 'react';

type Notice = { id: number; message: string; type: 'success' | 'error' };
function send(type: Notice['type'], message: string) { window.dispatchEvent(new CustomEvent('app:toast', { detail: { id: Date.now(), type, message } })); }
export const toast = { success: (message: string) => send('success', message), error: (message: string) => send('error', message) };
export function Toaster() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => { const listener = (event: Event) => { const notice = (event as CustomEvent<Notice>).detail; setNotices((current) => [...current.slice(-2), notice]); setTimeout(() => setNotices((current) => current.filter((item) => item.id !== notice.id)), 4200); }; window.addEventListener('app:toast', listener); return () => window.removeEventListener('app:toast', listener); }, []);
  return <div className="fixed bottom-5 right-5 z-[100] grid w-[calc(100%-2.5rem)] max-w-sm gap-2" aria-live="polite">{notices.map((notice) => <div key={notice.id} className={`rounded-xl border px-4 py-3 text-sm shadow-2xl backdrop-blur ${notice.type === 'error' ? 'border-rose-300/20 bg-rose-950/90 text-rose-100' : 'border-teal-200/20 bg-[#102b2b]/95 text-teal-50'}`}>{notice.message}</div>)}</div>;
}
