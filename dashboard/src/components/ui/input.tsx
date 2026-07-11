import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('flex h-11 w-full rounded-xl border border-white/10 bg-black/20 px-3.5 py-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/10 disabled:opacity-50', className)} {...props} />
));
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-24 w-full resize-y rounded-xl border border-white/10 bg-black/20 px-3.5 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-teal-300/40 focus:ring-2 focus:ring-teal-300/10 disabled:opacity-50', className)} {...props} />
));
Textarea.displayName = 'Textarea';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(({ className, ...props }, ref) => (
  <label ref={ref} className={cn('text-sm font-medium text-slate-200', className)} {...props} />
));
Label.displayName = 'Label';
