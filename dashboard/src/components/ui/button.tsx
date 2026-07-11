import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-amber-300 text-slate-950 shadow-[0_10px_30px_-12px_rgba(252,211,77,.8)] hover:bg-amber-200',
        secondary: 'border border-white/10 bg-white/[.06] text-slate-100 hover:bg-white/[.1] hover:border-white/20',
        ghost: 'text-slate-300 hover:bg-white/[.06] hover:text-white',
        outline: 'border border-teal-200/25 bg-teal-200/[.04] text-teal-100 hover:bg-teal-200/[.1]',
        destructive: 'bg-rose-500/15 text-rose-200 ring-1 ring-inset ring-rose-400/25 hover:bg-rose-500/25',
      },
      size: { default: 'h-11 px-5', sm: 'h-9 rounded-lg px-3', lg: 'h-13 px-7 text-base', icon: 'size-10 p-0' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Component = asChild ? Slot : 'button';
  return <Component ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
});
Button.displayName = 'Button';

export { buttonVariants };
