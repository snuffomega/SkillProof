import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { PublishStatus, RelationKind, Severity } from '@/domain/types';

export function StatusBadge({ status, version, className }: { status: PublishStatus; version?: number | null; className?: string }) {
  const map = {
    draft: { label: 'Draft', cls: 'text-muted-foreground border-border bg-muted/60', dot: 'bg-muted-foreground/60' },
    published: { label: version ? `v${version}` : 'Published', cls: 'text-ok border-ok/25 bg-ok/10', dot: 'bg-ok' },
    modified: { label: version ? `v${version} · edited` : 'Edited', cls: 'text-warn border-warn/30 bg-warn/10', dot: 'bg-warn' },
  }[status];
  return (
    <span className={cn('inline-flex h-5 items-center gap-1.5 rounded-full border px-2 text-[11px] font-medium', map.cls, className)}>
      <span className={cn('size-1.5 rounded-full', map.dot)} />
      {map.label}
    </span>
  );
}

export function SeverityIcon({ severity, className }: { severity: Severity; className?: string }) {
  if (severity === 'error') return <CircleAlert className={cn('size-3.5 text-err', className)} />;
  if (severity === 'warning') return <TriangleAlert className={cn('size-3.5 text-warn', className)} />;
  return <Info className={cn('size-3.5 text-info', className)} />;
}

export function HealthPill({ errors, warnings, className }: { errors: number; warnings: number; className?: string }) {
  if (!errors && !warnings)
    return (
      <span className={cn('inline-flex items-center gap-1 text-[11px] text-ok', className)}>
        <CircleCheck className="size-3" /> Valid
      </span>
    );
  return (
    <span className={cn('inline-flex items-center gap-2 text-[11px] tabular-nums', className)}>
      {errors > 0 && (
        <span className="inline-flex items-center gap-1 text-err">
          <CircleAlert className="size-3" />
          {errors}
        </span>
      )}
      {warnings > 0 && (
        <span className="inline-flex items-center gap-1 text-warn">
          <TriangleAlert className="size-3" />
          {warnings}
        </span>
      )}
    </span>
  );
}

export const RELATION_COLOR: Record<RelationKind, string> = {
  depends: 'var(--rel-depends)',
  handoff: 'var(--rel-handoff)',
  policy: 'var(--rel-policy)',
  conflict: 'var(--rel-conflict)',
};

export function RelationSwatch({ kind, className }: { kind: RelationKind; className?: string }) {
  const dashed = kind === 'policy' || kind === 'conflict';
  return (
    <svg width="22" height="8" className={className} aria-hidden>
      <line x1="1" y1="4" x2="21" y2="4" stroke={RELATION_COLOR[kind]} strokeWidth="2" strokeLinecap="round" strokeDasharray={dashed ? (kind === 'conflict' ? '2 3' : '5 3') : undefined} />
    </svg>
  );
}

export function SourceLabel({ kind }: { kind: 'real' | 'manual' | 'simulated' }) {
  const map = {
    real: { label: 'Real check', cls: 'text-ok border-ok/30 bg-ok/10' },
    manual: { label: 'Recorded', cls: 'text-info border-info/30 bg-info/10' },
    simulated: { label: 'Simulated', cls: 'text-warn border-warn/30 bg-warn/10 border-dashed' },
  }[kind];
  return <span className={cn('inline-flex h-5 items-center rounded border px-1.5 text-[10.5px] font-medium uppercase tracking-wide', map.cls)}>{map.label}</span>;
}

export function EmptyState({ icon: Icon, title, children, action }: { icon: React.ComponentType<{ className?: string }>; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center fade-up">
      <div className="mb-4 grid size-11 place-items-center rounded-xl border bg-surface">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      {children && <p className="mt-1.5 max-w-sm text-[13px] text-muted-foreground">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, actions, children }: { title: React.ReactNode; subtitle?: React.ReactNode; actions?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <header className="flex min-h-14 shrink-0 flex-wrap items-center gap-3 border-b px-5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2.5 text-[15px] font-semibold">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {children}
      {actions && <div className="flex items-center gap-1.5">{actions}</div>}
    </header>
  );
}
