import { useEffect } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { useUI } from '@/store/ui';
import { Sidebar } from '@/features/shell/Sidebar';
import { CommandPalette } from '@/features/shell/CommandPalette';
import { LibraryView } from '@/features/library/LibraryView';
import { StacksView } from '@/features/stacks/StacksView';
import { EvalsView } from '@/features/evals/EvalsView';
import { SettingsView } from '@/features/settings/SettingsView';
import { ImportDialog } from '@/features/import/ImportDialog';
import { NewSkillDialog } from '@/features/library/NewSkillDialog';
import { NewStackDialog } from '@/features/stacks/NewStackDialog';

export default function App() {
  const route = useUI((s) => s.route);
  const syncFromHash = useUI((s) => s.syncFromHash);
  const setPaletteOpen = useUI((s) => s.setPaletteOpen);

  useEffect(() => {
    window.addEventListener('popstate', syncFromHash);
    window.addEventListener('hashchange', syncFromHash);
    return () => {
      window.removeEventListener('popstate', syncFromHash);
      window.removeEventListener('hashchange', syncFromHash);
    };
  }, [syncFromHash]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(!useUI.getState().paletteOpen);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setPaletteOpen]);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-full overflow-hidden bg-background">
        <Sidebar />
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {route.view === 'library' && <LibraryView skillId={route.skillId} tab={route.tab ?? 'edit'} />}
          {route.view === 'stacks' && <StacksView stackId={route.stackId} tab={route.tab ?? 'graph'} />}
          {route.view === 'evals' && <EvalsView scenarioId={route.scenarioId} />}
          {route.view === 'settings' && <SettingsView />}
        </main>
      </div>
      <CommandPalette />
      <ImportDialog />
      <NewSkillDialog />
      <NewStackDialog />
      <Toaster />
    </TooltipProvider>
  );
}
