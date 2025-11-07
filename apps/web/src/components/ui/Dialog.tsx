'use client';

import { forwardRef, HTMLAttributes, useEffect } from 'react';
import { cn } from '@/lib/utils';

export interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const Dialog = forwardRef<HTMLDivElement, DialogProps>(
  ({ className, open, onOpenChange, children, ...props }, ref) => {
    // Handle ESC key press
    useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onOpenChange?.(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open, onOpenChange]);

    // Lock body scroll when dialog is open
    useEffect(() => {
      if (open) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }

      return () => {
        document.body.style.overflow = '';
      };
    }, [open]);

    if (!open) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={() => onOpenChange?.(false)}
          aria-hidden="true"
        />

        {/* Dialog */}
        <div
          ref={ref}
          role="dialog"
          aria-modal="true"
          className={cn(
            'relative z-50 w-full max-w-lg rounded-lg border bg-background p-6 shadow-lg animate-in fade-in-0 zoom-in-95',
            className
          )}
          {...props}
        >
          {children}
        </div>
      </div>
    );
  }
);

Dialog.displayName = 'Dialog';

// Dialog Header
export interface DialogHeaderProps extends HTMLAttributes<HTMLDivElement> {}

const DialogHeader = forwardRef<HTMLDivElement, DialogHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)}
        {...props}
      />
    );
  }
);

DialogHeader.displayName = 'DialogHeader';

// Dialog Title
export interface DialogTitleProps extends HTMLAttributes<HTMLHeadingElement> {}

const DialogTitle = forwardRef<HTMLHeadingElement, DialogTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h2
        ref={ref}
        className={cn(
          'text-lg font-semibold leading-none tracking-tight',
          className
        )}
        {...props}
      />
    );
  }
);

DialogTitle.displayName = 'DialogTitle';

// Dialog Description
export interface DialogDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

const DialogDescription = forwardRef<HTMLParagraphElement, DialogDescriptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <p
        ref={ref}
        className={cn('text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  }
);

DialogDescription.displayName = 'DialogDescription';

// Dialog Content (body)
export interface DialogContentProps extends HTMLAttributes<HTMLDivElement> {}

const DialogContent = forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('py-4', className)} {...props} />;
  }
);

DialogContent.displayName = 'DialogContent';

// Dialog Footer
export interface DialogFooterProps extends HTMLAttributes<HTMLDivElement> {}

const DialogFooter = forwardRef<HTMLDivElement, DialogFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
          className
        )}
        {...props}
      />
    );
  }
);

DialogFooter.displayName = 'DialogFooter';

export {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogContent,
  DialogFooter,
};
