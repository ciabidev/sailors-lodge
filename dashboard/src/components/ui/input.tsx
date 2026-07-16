import * as React from 'react';
import { cn } from '@/lib/utils';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn('flex h-11 w-full rounded-lg border border-[#626880]/70 bg-[#414559] px-3.5 py-2 text-sm text-[#c6d0f5] outline-none transition placeholder:text-[#838ba7] focus:border-[#8caaee] focus:ring-2 focus:ring-[#8caaee]/20 disabled:opacity-50', className)} {...props} />
));
Input.displayName = 'Input';
