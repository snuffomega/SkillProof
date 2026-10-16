import { FlaskConical, HardDrive, LibraryBig, Moon, Search, Settings, Sun, Upload, Waypoints, Workflow } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useScenarios, useSkills, useStacks } from '@/data/hooks';
import { useUI, type Route } from '@/store/ui';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { stackStatus } from '@/domain/versioning';

function NavItem({ icon: Icon, label, active, count, onClick }: { icon: typeof LibraryBig; label: string; active: boolean; count?: number; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={onClick}
          className={cn(
            'group flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] transition-colors',
            active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )}
        >
          <Icon className={cn('size-4 shrink-0', active && 'text-primary')} />
          <span className="hidden flex-1 text-left md:inline">{label}</span>
          {count !== undefined && <span className="hidden text-[11px] tabular-nums text-muted-foreground md:inline">{count}</span>}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="md:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function Sidebar() {
  const route = useUI((s) => s.route);
  const navigate = useUI((s) => s.navigate);
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);
  const openDialog = useUI((s) => s.openDialog);
  const skills = useSkills();
  const stacks = useStacks();
  const scenarios = useScenarios();

  const go = (r: Route) => navigate(r);
  const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);

  return (
    <aside className="flex w-14 shrink-0 flex-col border-r bg-surface/60 md:w-60">
      <div className="flex h-14 items-center gap-2.5 px-3.5 md:px-4">
        <div className="grid size-7 shrink-0 place-items-center rounded-lg bg-foreground text-background">
          <Waypoints className="size-4" />
        </div>
        <div className="hidden min-w-0 md:block">
          <div className="text-[14px] font-semibold leading-tight tracking-tight">SkillProof</div>
          <div className="text-[11px] leading-tight text-muted-foreground">Skill stack studio</div>
        </div>
      </div>

      <div className="px-2.5 pb-2">
        <button
          onClick={() => setPaletteOpen(true)}
          className="flex h-8 w-full items-center gap-2 rounded-md border bg-background px-2 text-[13px] text-muted-foreground transition-colors hover:border-ring/40 hover:text-foreground"
        >
          <Search className="size-3.5 shrink-0" />
          <span className="hidden flex-1 text-left md:inline">Search or jump to…</span>
          <span className="kbd hidden md:inline">{isMac ? '⌘' : 'Ctrl'} K</span>
        </button>
      </div>

      <nav className="space-y-0.5 px-2.5">
        <NavItem icon={LibraryBig} label="Skill Library" active={route.view === 'library'} count={skills?.length} onClick={() => go({ view: 'library' })} />
        <NavItem icon={Workflow} label="Stacks" active={route.view === 'stacks'} count={stacks?.length} onClick={() => go({ view: 'stacks' })} />
        <NavItem icon={FlaskConical} label="Evaluations" active={route.view === 'evals'} count={scenarios?.length} onClick={() => go({ view: 'evals' })} />
        <NavItem icon={Upload} label="Import" active={false} onClick={() => openDialog('import')} />
      </nav>

      <div className="mt-6 hidden min-h-0 flex-1 flex-col md:flex">
        <div className="px-4 pb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground/80">Stacks</div>
        <div className="scrollbar-thin min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2.5">
          {stacks?.map((s) => {
            const active = route.view === 'stacks' && route.stackId === s.id;
            const status = stackStatus(s);
            return (
              <button
                key={s.id}
                onClick={() => go({ view: 'stacks', stackId: s.id })}
                className={cn(
                  'flex h-7 w-full items-center gap-2 rounded-md px-2 text-left text-[13px] transition-colors',
                  active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <span className={cn('size-1.5 shrink-0 rounded-full', status === 'published' ? 'bg-ok' : status === 'modified' ? 'bg-warn' : 'bg-muted-foreground/50')} />
                <span className="truncate">{s.name}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 md:hidden" />

      <div className="space-y-0.5 border-t p-2.5">
        <NavItem icon={Settings} label="Settings" active={route.view === 'settings'} onClick={() => go({ view: 'settings' })} />
        <NavItem icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Light mode' : 'Dark mode'} active={false} onClick={toggleTheme} />
        <div className="hidden items-center gap-2 px-2 pt-2 text-[11px] text-muted-foreground md:flex">
          <HardDrive className="size-3" />
          Saved locally in this browser
        </div>
      </div>
    </aside>
  );
}
