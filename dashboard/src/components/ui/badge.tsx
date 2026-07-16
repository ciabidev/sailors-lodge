import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export function Badge({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn('inline-flex items-center rounded-full border border-[#8caaee]/30 bg-[#8caaee]/12 px-2.5 py-1 text-xs font-medium text-[#c6d0f5]', className)} {...props} />;
}
