import { forwardRef, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning';
  size?: 'sm' | 'default' | 'lg';
}

const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'inline-flex items-center rounded-full border font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          {
            'border-transparent bg-primary text-primary-foreground hover:bg-primary/80':
              variant === 'default',
            'border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80':
              variant === 'secondary',
            'border-border bg-background text-foreground': variant === 'outline',
            'border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80':
              variant === 'destructive',
            'border-transparent bg-green-500 text-white hover:bg-green-600':
              variant === 'success',
            'border-transparent bg-yellow-500 text-white hover:bg-yellow-600':
              variant === 'warning',
          },
          {
            'px-2 py-0.5 text-xs': size === 'sm',
            'px-2.5 py-0.5 text-sm': size === 'default',
            'px-3 py-1 text-base': size === 'lg',
          },
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = 'Badge';

export { Badge };
