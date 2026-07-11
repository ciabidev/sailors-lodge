import { createContext, useContext, type HTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

const DialogContext = createContext<{ close: () => void }>({ close: () => undefined });
export function Dialog({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  if (!open) return null;
  return <DialogContext.Provider value={{ close: () => onOpenChange(false) }}>{children}</DialogContext.Provider>;
}
export function DialogContent({ className, children }: HTMLAttributes<HTMLDivElement>) {
  const { close } = useContext(DialogContext);
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && close()}><div role="dialog" aria-modal="true" className={cn('relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-white/10 bg-[#0b1b21] p-6 text-white shadow-2xl outline-none', className)}><button className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-300" onClick={close} aria-label="Close"><X className="size-4" /></button>{children}</div></div>;
}
export const DialogHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cn('mb-5 space-y-1.5 pr-8', className)} {...props} />;
export const DialogTitle = ({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) => <h2 className={cn('font-display text-2xl font-semibold', className)} {...props} />;
export const DialogDescription = ({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) => <p className={cn('text-sm leading-6 text-slate-400', className)} {...props} />;
export const DialogFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => <div className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />;
