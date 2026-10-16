import { FilePlus, FlaskConical, LibraryBig, Moon, Network, Settings, Sun, Upload, Workflow, FileText, Plus, Layers, GitCompareArrows } from 'lucide-react';
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { useLandscape, useSkills, useStacks } from '@/data/hooks';
import { useUI } from '@/store/ui';

export function CommandPalette() {
  const open = useUI((s) => s.paletteOpen);
  const setOpen = useUI((s) => s.setPaletteOpen);
  const navigate = useUI((s) => s.navigate);
  const openDialog = useUI((s) => s.openDialog);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const theme = useUI((s) => s.theme);
  const skills = useSkills() ?? [];
  const stacks = useStacks() ?? [];
  const landscape = useLandscape();

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  const areas = landscape?.areas ?? [];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search skills, areas, stacks and actions…" />
      <CommandList className="scrollbar-thin max-h-[420px]">
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Actions">
          <CommandItem onSelect={() => run(() => openDialog('import'))}>
            <Upload /> Import skills or a stack bundle
          </CommandItem>
          <CommandItem onSelect={() => run(() => openDialog('new-skill'))}>
            <FilePlus /> New skill
          </CommandItem>
          <CommandItem onSelect={() => run(() => openDialog('new-stack'))}>
            <Plus /> New stack
          </CommandItem>
          <CommandItem onSelect={() => run(toggleTheme)}>
            {theme === 'dark' ? <Sun /> : <Moon />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => run(() => navigate({ view: 'landscape' }))}>
            <Network /> Skill Landscape
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'landscape', tab: 'areas' }))}>
            <Layers /> Browse work areas
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'landscape', tab: 'relationships' }))}>
            <GitCompareArrows /> Browse relationships
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'library' }))}>
            <LibraryBig /> Skill Library
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'stacks' }))}>
            <Workflow /> Stacks
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'evals' }))}>
            <FlaskConical /> Evaluations
          </CommandItem>
          <CommandItem onSelect={() => run(() => navigate({ view: 'settings' }))}>
            <Settings /> Settings
          </CommandItem>
        </CommandGroup>
        {areas.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Work areas">
              {areas.map((a) => (
                <CommandItem key={a.id} value={`area ${a.label} ${a.id}`} onSelect={() => run(() => navigate({ view: 'landscape', tab: 'areas', areaId: a.id }))}>
                  <Layers />
                  <span>{a.label}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{a.members.length}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {stacks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Stacks">
              {stacks.map((s) => (
                <CommandItem key={s.id} value={`stack ${s.name} ${s.id}`} onSelect={() => run(() => navigate({ view: 'stacks', stackId: s.id }))}>
                  <Workflow /> {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
        {skills.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Skills">
              {skills.map((s) => (
                <CommandItem key={s.id} value={`skill ${s.name} ${s.description} ${s.id}`} onSelect={() => run(() => navigate({ view: 'library', skillId: s.id }))}>
                  <FileText />
                  <span className="font-mono text-[12.5px]">{s.name || 'untitled'}</span>
                  <span className="ml-2 truncate text-xs text-muted-foreground">{s.description}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
