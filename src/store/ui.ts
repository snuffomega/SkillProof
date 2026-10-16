import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type StackTab = 'graph' | 'contract' | 'validation' | 'versions';
export type SkillTab = 'edit' | 'files' | 'versions' | 'evals';
export type LandscapeTab = 'map' | 'areas' | 'relationships' | 'gaps';

export type Route =
  | { view: 'landscape'; tab?: LandscapeTab; areaId?: string; skillId?: string }
  | { view: 'library'; skillId?: string; tab?: SkillTab }
  | { view: 'stacks'; stackId?: string; tab?: StackTab }
  | { view: 'evals'; scenarioId?: string }
  | { view: 'settings' };

export function routeToHash(r: Route): string {
  switch (r.view) {
    case 'landscape':
      return `#/landscape${r.tab && r.tab !== 'map' ? `/${r.tab}` : ''}${r.areaId ? `/area/${r.areaId}` : ''}${r.skillId ? `/skill/${r.skillId}` : ''}`;
    case 'library':
      return `#/library${r.skillId ? `/${r.skillId}${r.tab && r.tab !== 'edit' ? `/${r.tab}` : ''}` : ''}`;
    case 'stacks':
      return `#/stacks${r.stackId ? `/${r.stackId}${r.tab && r.tab !== 'graph' ? `/${r.tab}` : ''}` : ''}`;
    case 'evals':
      return `#/evals${r.scenarioId ? `/${r.scenarioId}` : ''}`;
    case 'settings':
      return '#/settings';
  }
}

export function hashToRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/');
  const view = parts[0];
  if (view === 'landscape') {
    const tab = (parts[1] as LandscapeTab) || 'map';
    const areaIdx = parts.indexOf('area');
    const skillIdx = parts.indexOf('skill');
    return {
      view: 'landscape',
      tab: ['map', 'areas', 'relationships', 'gaps'].includes(tab) ? tab : 'map',
      areaId: areaIdx >= 0 ? parts[areaIdx + 1] : undefined,
      skillId: skillIdx >= 0 ? parts[skillIdx + 1] : undefined,
    };
  }
  if (view === 'stacks') return { view, stackId: parts[1] || undefined, tab: (parts[2] as StackTab) || 'graph' };
  if (view === 'evals') return { view, scenarioId: parts[1] || undefined };
  if (view === 'library') return { view, skillId: parts[1] || undefined, tab: (parts[2] as SkillTab) || 'edit' };
  if (view === 'settings') return { view };
  return { view: 'landscape', tab: 'map' };
}

export type Dialog = 'import' | 'new-skill' | 'new-stack' | null;

export interface GraphFocus {
  nodeId?: string;
  edgeId?: string;
  nonce: number;
}

interface UIState {
  route: Route;
  theme: 'dark' | 'light';
  paletteOpen: boolean;
  dialog: Dialog;
  graphFocus: GraphFocus | null;
  navigate: (r: Route) => void;
  syncFromHash: () => void;
  toggleTheme: () => void;
  setPaletteOpen: (open: boolean) => void;
  openDialog: (d: Dialog) => void;
  focusGraph: (f: Omit<GraphFocus, 'nonce'>) => void;
}

export const useUI = create<UIState>()(
  persist(
    (set, get) => ({
      route: hashToRoute(typeof location !== 'undefined' ? location.hash : ''),
      theme: 'dark',
      paletteOpen: false,
      dialog: null,
      graphFocus: null,
      navigate: (route) => {
        const hash = routeToHash(route);
        if (location.hash !== hash) history.pushState(null, '', hash);
        set({ route });
      },
      syncFromHash: () => set({ route: hashToRoute(location.hash) }),
      toggleTheme: () => {
        const theme = get().theme === 'dark' ? 'light' : 'dark';
        document.documentElement.classList.toggle('dark', theme === 'dark');
        set({ theme });
      },
      setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
      openDialog: (dialog) => set({ dialog }),
      focusGraph: (f) => set({ graphFocus: { ...f, nonce: Date.now() } }),
    }),
    { name: 'skillproof-ui', partialize: (s) => ({ theme: s.theme }) },
  ),
);
