import * as React from 'react';
import { cn } from '@/lib/utils';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn('flex min-h-24 w-full resize-y rounded-lg border border-[#626880]/70 bg-[#414559] px-3.5 py-3 text-sm text-[#c6d0f5] outline-none transition placeholder:text-[#838ba7] focus:border-[#8caaee] focus:ring-2 focus:ring-[#8caaee]/20 disabled:opacity-50', className)} {...props} />
));
Textarea.displayName = 'Textarea';
