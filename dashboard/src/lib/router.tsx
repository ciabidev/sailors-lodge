import { useEffect, useState, type AnchorHTMLAttributes, type ReactNode } from 'react';

export function usePath() {
  const [path, setPath] = useState(window.location.pathname);
  useEffect(() => {
    const update = () => setPath(window.location.pathname);
    window.addEventListener('popstate', update);
    window.addEventListener('app:navigate', update);
    return () => { window.removeEventListener('popstate', update); window.removeEventListener('app:navigate', update); };
  }, []);
  return path;
}

export function navigate(to: string, replace = false) {
  window.history[replace ? 'replaceState' : 'pushState']({}, '', to);
  window.dispatchEvent(new Event('app:navigate'));
  window.scrollTo({ top: 0, behavior: 'instant' });
}

export function Link({ to, children, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string; children: ReactNode }) {
  return <a href={to} {...props} onClick={(event) => { onClick?.(event); if (!event.defaultPrevented && event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey) { event.preventDefault(); navigate(to); } }}>{children}</a>;
}
