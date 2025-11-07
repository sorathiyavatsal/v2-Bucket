'use client';

import { forwardRef, HTMLAttributes, useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export interface DropdownProps extends HTMLAttributes<HTMLDivElement> {
  trigger: React.ReactNode;
  align?: 'start' | 'center' | 'end';
}

const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  ({ className, trigger, align = 'start', children, ...props }, ref) => {
    const [open, setOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on click outside
    useEffect(() => {
      if (!open) return;

      const handleClickOutside = (e: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
          setOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    // Close on ESC key
    useEffect(() => {
      if (!open) return;

      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setOpen(false);
        }
      };

      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }, [open]);

    return (
      <div ref={dropdownRef} className="relative inline-block" {...props}>
        {/* Trigger */}
        <div onClick={() => setOpen(!open)} className="cursor-pointer">
          {trigger}
        </div>

        {/* Menu */}
        {open && (
          <div
            ref={ref}
            className={cn(
              'absolute z-50 mt-2 min-w-[8rem] overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95',
              {
                'left-0': align === 'start',
                'left-1/2 -translate-x-1/2': align === 'center',
                'right-0': align === 'end',
              },
              className
            )}
          >
            {children}
          </div>
        )}
      </div>
    );
  }
);

Dropdown.displayName = 'Dropdown';

// Dropdown Item
export interface DropdownItemProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
  destructive?: boolean;
}

const DropdownItem = forwardRef<HTMLDivElement, DropdownItemProps>(
  ({ className, disabled, destructive, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground',
          disabled && 'pointer-events-none opacity-50',
          destructive && 'text-destructive focus:text-destructive',
          className
        )}
        {...props}
      />
    );
  }
);

DropdownItem.displayName = 'DropdownItem';

// Dropdown Label
export interface DropdownLabelProps extends HTMLAttributes<HTMLDivElement> {}

const DropdownLabel = forwardRef<HTMLDivElement, DropdownLabelProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('px-2 py-1.5 text-sm font-semibold', className)}
        {...props}
      />
    );
  }
);

DropdownLabel.displayName = 'DropdownLabel';

// Dropdown Separator
export interface DropdownSeparatorProps extends HTMLAttributes<HTMLDivElement> {}

const DropdownSeparator = forwardRef<HTMLDivElement, DropdownSeparatorProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('-mx-1 my-1 h-px bg-muted', className)}
        {...props}
      />
    );
  }
);

DropdownSeparator.displayName = 'DropdownSeparator';

// Dropdown Shortcut
export interface DropdownShortcutProps extends HTMLAttributes<HTMLSpanElement> {}

const DropdownShortcut = forwardRef<HTMLSpanElement, DropdownShortcutProps>(
  ({ className, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn('ml-auto text-xs tracking-widest opacity-60', className)}
        {...props}
      />
    );
  }
);

DropdownShortcut.displayName = 'DropdownShortcut';

export {
  Dropdown,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownShortcut,
};
