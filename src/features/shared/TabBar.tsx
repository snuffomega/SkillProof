import { cn } from '@/lib/utils';

export interface TabDef<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: 'err' | 'warn';
}

export function TabBar<T extends string>({ tabs, active, onChange, className }: { tabs: TabDef<T>[]; active: T; onChange: (id: T) => void; className?: string }) {
  return (
    <nav role="tablist" className={cn('flex shrink-0 items-center gap-1 overflow-x-auto border-b px-4', className)}>
      {tabs.map((t) => {
        const selected = t.id === active;
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(t.id)}
            className={cn(
              'relative flex h-10 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] transition-colors',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="size-3.5" />}
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span
                className={cn(
                  'rounded px-1.5 py-px text-[10.5px] tabular-nums',
                  t.tone === 'err' ? 'bg-err/15 text-err' : t.tone === 'warn' ? 'bg-warn/15 text-warn' : 'bg-muted text-muted-foreground',
                )}
              >
                {t.count}
              </span>
            )}
            <span className={cn('absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-primary transition-opacity', selected ? 'opacity-100' : 'opacity-0')} />
          </button>
        );
      })}
    </nav>
  );
}
