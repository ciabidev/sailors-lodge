import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8caaee]/80 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px',
  {
    variants: {
      variant: {
        default: 'bg-[#8caaee] text-[#232634] hover:bg-[#babbf1]',
        secondary: 'border border-[#626880] bg-[#414559] text-[#c6d0f5] hover:border-[#737994] hover:bg-[#51576d]',
        ghost: 'text-[#b5bfe2] hover:bg-[#414559] hover:text-[#c6d0f5]',
        outline: 'border border-[#8caaee]/45 bg-transparent text-[#c6d0f5] hover:bg-[#8caaee]/12',
        destructive: 'bg-[#e78284]/15 text-[#f2d5cf] ring-1 ring-inset ring-[#e78284]/35 hover:bg-[#e78284]/25',
      },
      size: { default: 'h-11 px-5', sm: 'h-9 px-3', lg: 'h-13 px-7 text-base', icon: 'size-10 p-0' },
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
