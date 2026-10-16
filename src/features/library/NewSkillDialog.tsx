import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRepository, useSkills } from '@/data/hooks';
import { setFrontmatterField, skillTemplate } from '@/domain/skill-markdown';
import { NAME_PATTERN } from '@/domain/validation';
import { slugify } from '@/lib/id';
import { useUI } from '@/store/ui';

export function NewSkillDialog() {
  const repo = useRepository();
  const skills = useSkills() ?? [];
  const dialog = useUI((s) => s.dialog);
  const openDialog = useUI((s) => s.openDialog);
  const navigate = useUI((s) => s.navigate);
  const open = dialog === 'new-skill';
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folder, setFolder] = useState('');

  useEffect(() => {
    if (open) {
      setName('');
      setDescription('');
      setFolder('');
    }
  }, [open]);

  const slug = slugify(name);
  const taken = skills.some((s) => s.name === slug);
  const error = !slug ? null : !NAME_PATTERN.test(slug) ? 'Use lowercase letters, numbers and hyphens' : slug.length > 64 ? 'Keep names to 64 characters' : taken ? 'A skill with this name already exists' : null;
  const folders = [...new Set(skills.map((s) => s.folder).filter(Boolean))].sort();

  const create = async () => {
    if (!slug || error) return;
    let content = skillTemplate(slug, '');
    if (description.trim()) content = setFrontmatterField(content, 'description', description.trim().replace(/\s+/g, ' '));
    const skill = await repo.createSkill({ content, folder: folder.trim(), source: { kind: 'manual' } });
    openDialog(null);
    toast.success(`Created ${slug}`);
    navigate({ view: 'library', skillId: skill.id, tab: 'edit' });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => openDialog(o ? 'new-skill' : null)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New skill</DialogTitle>
          <DialogDescription>Starts as a draft SKILL.md with sections for intent, expectations, quality bar and outputs.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="ns-name">Name</Label>
            <Input id="ns-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="incident-postmortem" className="font-mono" />
            <p className={error ? 'text-xs text-err' : 'text-xs text-muted-foreground'}>{error ?? (slug && slug !== name ? `Saved as ${slug}` : 'Lowercase, hyphen-separated. This is how agents refer to it.')}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-desc">Description</Label>
            <Textarea id="ns-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What the skill achieves and when an agent should reach for it." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ns-folder">Folder</Label>
            <Input id="ns-folder" list="ns-folders" value={folder} onChange={(e) => setFolder(e.target.value)} placeholder="Unsorted" />
            <datalist id="ns-folders">
              {folders.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
          </div>
          <button type="submit" hidden />
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => openDialog(null)}>
            Cancel
          </Button>
          <Button onClick={create} disabled={!slug || !!error}>
            Create skill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
