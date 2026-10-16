import { useMemo, useState } from 'react';
import { GripVertical, Plus, Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Skill } from '@/domain/types';

export const SKILL_DRAG_TYPE = 'application/x-skillproof-skill';

export function SkillPalette({ skills, usedIds, onAdd, onClose }: { skills: Skill[]; usedIds: Set<string>; onAdd: (skillId: string) => void; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const available = useMemo(() => {
    const q = query.trim().toLowerCase();
    return skills
      .filter((s) => !usedIds.has(s.id))
      .filter((s) => !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.tags.some((t) => t.includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [skills, usedIds, query]);

  return (
    <div className="flex max-h-[min(520px,calc(100vh-220px))] w-72 flex-col overflow-hidden rounded-xl border bg-popover shadow-xl fade-up">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <span className="flex-1 text-xs font-medium">Add from library</span>
        <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close skill palette">
          <X />
        </Button>
      </div>
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search skills" className="pl-7" aria-label="Search skills to add" />
      </div>
      <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
        {available.length === 0 && <li className="px-3 py-6 text-center text-xs text-muted-foreground">{usedIds.size && !query ? 'Every library skill is already in this stack.' : 'No matching skills.'}</li>}
        {available.map((s) => (
          <li
            key={s.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(SKILL_DRAG_TYPE, s.id);
              e.dataTransfer.effectAllowed = 'move';
            }}
            className="group flex cursor-grab items-start gap-1.5 rounded-md px-1.5 py-1.5 hover:bg-accent active:cursor-grabbing"
          >
            <GripVertical className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-xs">{s.name || 'unnamed-skill'}</div>
              <div className="line-clamp-1 text-[11px] text-muted-foreground">{s.description}</div>
            </div>
            <Button variant="ghost" size="icon-sm" className="size-6 opacity-0 group-hover:opacity-100 focus:opacity-100" onClick={() => onAdd(s.id)} aria-label={`Add ${s.name}`}>
              <Plus />
            </Button>
          </li>
        ))}
      </ul>
      <p className="border-t px-3 py-2 text-[11px] text-muted-foreground">Drag onto the canvas, or click + to place it.</p>
    </div>
  );
}
