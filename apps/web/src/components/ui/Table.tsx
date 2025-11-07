import { forwardRef, HTMLAttributes, ThHTMLAttributes, TdHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

// Main Table Container
export interface TableProps extends HTMLAttributes<HTMLTableElement> {}

const Table = forwardRef<HTMLTableElement, TableProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn('w-full caption-bottom text-sm', className)}
          {...props}
        />
      </div>
    );
  }
);

Table.displayName = 'Table';

// Table Header
export interface TableHeaderProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableHeader = forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={cn('[&_tr]:border-b', className)}
        {...props}
      />
    );
  }
);

TableHeader.displayName = 'TableHeader';

// Table Body
export interface TableBodyProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableBody = forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ className, ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={cn('[&_tr:last-child]:border-0', className)}
        {...props}
      />
    );
  }
);

TableBody.displayName = 'TableBody';

// Table Footer
export interface TableFooterProps extends HTMLAttributes<HTMLTableSectionElement> {}

const TableFooter = forwardRef<HTMLTableSectionElement, TableFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <tfoot
        ref={ref}
        className={cn(
          'border-t bg-muted/50 font-medium [&>tr]:last:border-b-0',
          className
        )}
        {...props}
      />
    );
  }
);

TableFooter.displayName = 'TableFooter';

// Table Row
export interface TableRowProps extends HTMLAttributes<HTMLTableRowElement> {
  selectable?: boolean;
}

const TableRow = forwardRef<HTMLTableRowElement, TableRowProps>(
  ({ className, selectable, ...props }, ref) => {
    return (
      <tr
        ref={ref}
        className={cn(
          'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
          selectable && 'cursor-pointer',
          className
        )}
        {...props}
      />
    );
  }
);

TableRow.displayName = 'TableRow';

// Table Head Cell
export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
}

const TableHead = forwardRef<HTMLTableCellElement, TableHeadProps>(
  ({ className, sortable, sortDirection, children, ...props }, ref) => {
    return (
      <th
        ref={ref}
        className={cn(
          'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
          sortable && 'cursor-pointer select-none hover:text-foreground',
          className
        )}
        {...props}
      >
        <div className="flex items-center gap-2">
          {children}
          {sortable && (
            <span className="inline-flex flex-col text-xs">
              <span className={cn(sortDirection === 'asc' && 'text-foreground')}>▲</span>
              <span className={cn(sortDirection === 'desc' && 'text-foreground')}>▼</span>
            </span>
          )}
        </div>
      </th>
    );
  }
);

TableHead.displayName = 'TableHead';

// Table Cell
export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {}

const TableCell = forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ className, ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
        {...props}
      />
    );
  }
);

TableCell.displayName = 'TableCell';

// Table Caption
export interface TableCaptionProps extends HTMLAttributes<HTMLTableCaptionElement> {}

const TableCaption = forwardRef<HTMLTableCaptionElement, TableCaptionProps>(
  ({ className, ...props }, ref) => {
    return (
      <caption
        ref={ref}
        className={cn('mt-4 text-sm text-muted-foreground', className)}
        {...props}
      />
    );
  }
);

TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
};
