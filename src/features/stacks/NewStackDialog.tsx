import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRepository, useSkills } from '@/data/hooks';
import { autoLayout } from '@/domain/graph';
import { uid } from '@/lib/id';
import { useUI } from '@/store/ui';

export function NewStackDialog() {
  const repo = useRepository();
  const skills = useSkills() ?? [];
  const dialog = useUI((s) => s.dialog);
  const openDialog = useUI((s) => s.openDialog);
  const navigate = useUI((s) => s.navigate);
  const open = dialog === 'new-stack';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setPicked(new Set());
      setQuery('');
    }
  }, [open]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...skills].sort((a, b) => a.name.localeCompare(b.name)).filter((s) => !q || s.name.includes(q) || s.folder.toLowerCase().includes(q));
  }, [skills, query]);

  const create = async () => {
    if (!name.trim()) return;
    const nodes = autoLayout(
      [...picked].map((skillId, i) => ({ id: uid('n'), skillId, role: '', position: { x: 0, y: i } })),
      [],
    );
    const stack = await repo.createStack({ name: name.trim(), description: description.trim(), nodes });
    openDialog(null);
    toast.success(`Created ${stack.name}`);
    navigate({ view: 'stacks', stackId: stack.id, tab: 'graph' });
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={(o) => openDialog(o ? 'new-stack' : null)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New stack</DialogTitle>
          <DialogDescription>Pick a few skills to start with. You'll connect them on the canvas.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="nst-name">Name</Label>
            <Input id="nst-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Incident Response" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nst-desc">Description</Label>
            <Textarea id="nst-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What this system of skills delivers" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center">
              <Label className="flex-1">Starting skills</Label>
              <span className="text-xs tabular-nums text-muted-foreground">{picked.size} selected</span>
            </div>
            <div className="overflow-hidden rounded-lg border">
              <div className="relative border-b">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filter" aria-label="Filter skills" className="h-8 w-full bg-transparent pl-8 pr-3 text-xs outline-none" />
              </div>
              <ul className="scrollbar-thin max-h-52 overflow-y-auto p-1">
                {visible.map((s) => (
                  <li key={s.id}>
                    <label className="flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 hover:bg-accent/60">
                      <Checkbox checked={picked.has(s.id)} onCheckedChange={() => toggle(s.id)} />
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{s.name || 'unnamed-skill'}</span>
                      <span className="text-[11px] text-muted-foreground">{s.folder}</span>
                    </label>
                  </li>
                ))}
                {visible.length === 0 && <li className="px-2 py-4 text-center text-xs text-muted-foreground">No skills found.</li>}
              </ul>
            </div>
          </div>
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => openDialog(null)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!name.trim()}>
            Create stack
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
