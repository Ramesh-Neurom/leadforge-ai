import { cn } from '@/lib/utils';

/**
 * TableWrapper — a clean, horizontally scrollable surface for tables.
 * Use with the exported Table / Th / Td helpers or any raw <table>.
 */
export function TableWrapper({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card',
        className,
      )}
    >
      <div className="scrollbar-thin overflow-x-auto">{children}</div>
    </div>
  );
}

export function Table({
  children,
  minWidth = 'min-w-[900px]',
  className,
}: {
  children: React.ReactNode;
  minWidth?: string;
  className?: string;
}) {
  return (
    <table className={cn('w-full text-left text-sm', minWidth, className)}>
      {children}
    </table>
  );
}

export function Thead({ children }: { children: React.ReactNode }) {
  return (
    <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium uppercase tracking-wide text-slate-500">
      {children}
    </thead>
  );
}

export function Th({
  children,
  className,
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return <th className={cn('px-4 py-3 font-medium', className)}>{children}</th>;
}

export function Td({
  children,
  className,
  colSpan,
}: {
  children?: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td className={cn('px-4 py-3', className)} colSpan={colSpan}>
      {children}
    </td>
  );
}
