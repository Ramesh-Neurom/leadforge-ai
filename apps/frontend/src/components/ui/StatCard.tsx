import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type Accent = 'indigo' | 'blue' | 'violet' | 'emerald' | 'amber' | 'rose' | 'sky' | 'slate';

const accentStyles: Record<Accent, { icon: string; ring: string }> = {
  indigo: { icon: 'bg-indigo-50 text-indigo-600', ring: 'from-indigo-500/10' },
  blue: { icon: 'bg-blue-50 text-blue-600', ring: 'from-blue-500/10' },
  violet: { icon: 'bg-violet-50 text-violet-600', ring: 'from-violet-500/10' },
  emerald: { icon: 'bg-emerald-50 text-emerald-600', ring: 'from-emerald-500/10' },
  amber: { icon: 'bg-amber-50 text-amber-600', ring: 'from-amber-500/10' },
  rose: { icon: 'bg-rose-50 text-rose-600', ring: 'from-rose-500/10' },
  sky: { icon: 'bg-sky-50 text-sky-600', ring: 'from-sky-500/10' },
  slate: { icon: 'bg-slate-100 text-slate-600', ring: 'from-slate-500/10' },
};

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = 'indigo',
  hint,
  className,
}: {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  accent?: Accent;
  hint?: React.ReactNode;
  className?: string;
}) {
  const styles = accentStyles[accent];

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-gradient-to-br to-transparent',
          styles.ring,
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
            {value}
          </p>
          {hint ? (
            <p className="mt-1 text-xs text-slate-400">{hint}</p>
          ) : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
              styles.icon,
            )}
          >
            <Icon className="h-5 w-5" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
