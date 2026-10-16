import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FilePlus, FileText, Paperclip, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/common';
import { CodeEditor } from '@/components/CodeEditor';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository } from '@/data/hooks';
import { isTextPath, MAX_TEXT_FILE_BYTES } from '@/domain/importers';
import { normalizePath } from '@/domain/validation';
import type { Skill, SkillFile } from '@/domain/types';
import { downloadBlob } from '@/lib/download';
import { useDebouncedSave } from '@/features/shared/useDebouncedSave';
import { cn } from '@/lib/utils';

export function SkillFilesTab({ skill }: { skill: Skill }) {
  const repo = useRepository();
  const [selected, setSelected] = useState<string | null>(skill.files[0]?.path ?? null);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState('references/');
  const upload = useRef<HTMLInputElement>(null);
  const [confirm, confirmNode] = useConfirm();

  const current = skill.files.find((f) => f.path === selected) ?? null;
  const save = (files: SkillFile[]) => repo.updateSkill(skill.id, { files });

  const create = async () => {
    const path = normalizePath(newPath.trim());
    if (!path || path.endsWith('/')) return toast.error('Enter a file path such as references/checklist.md');
    if (/^skill\.md$/i.test(path)) return toast.error('SKILL.md is edited on the Instructions tab');
    if (skill.files.some((f) => f.path === path)) return toast.error('A file with that path already exists');
    await save([...skill.files, { path, content: '' }]);
    setSelected(path);
    setCreating(false);
    setNewPath('references/');
  };

  const onUpload = async (list: FileList | null) => {
    if (!list?.length) return;
    const next = [...skill.files];
    const skipped: string[] = [];
    for (const file of Array.from(list)) {
      if (!isTextPath(file.name) || file.size > MAX_TEXT_FILE_BYTES) {
        skipped.push(file.name);
        continue;
      }
      const path = `references/${file.name}`;
      const content = await file.text();
      const i = next.findIndex((f) => f.path === path);
      if (i >= 0) next[i] = { path, content };
      else next.push({ path, content });
    }
    await save(next);
    if (skipped.length) toast.warning(`Skipped ${skipped.length} binary or oversized file${skipped.length === 1 ? '' : 's'}`);
    else toast.success('Files attached');
    if (upload.current) upload.current.value = '';
  };

  const remove = (path: string) =>
    confirm({
      title: `Remove ${path}?`,
      description: 'Links to this file from SKILL.md will be reported as broken.',
      confirmLabel: 'Remove file',
      destructive: true,
      onConfirm: async () => {
        await save(skill.files.filter((f) => f.path !== path));
        if (selected === path) setSelected(null);
      },
    });

  return (
    <div className="flex h-full min-h-0">
      <aside className="flex w-64 shrink-0 flex-col border-r">
        <div className="flex items-center gap-1 border-b px-3 py-2">
          <span className="flex-1 text-xs text-muted-foreground">Supporting files</span>
          <Button variant="ghost" size="icon-sm" onClick={() => setCreating(true)} aria-label="New file">
            <FilePlus />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={() => upload.current?.click()} aria-label="Upload files">
            <Upload />
          </Button>
          <input ref={upload} type="file" multiple hidden onChange={(e) => onUpload(e.target.files)} />
        </div>
        {creating && (
          <form
            className="space-y-2 border-b p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void create();
            }}
          >
            <Input autoFocus value={newPath} onChange={(e) => setNewPath(e.target.value)} className="font-mono text-xs" aria-label="New file path" />
            <div className="flex justify-end gap-1.5">
              <Button type="button" variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm">
                Create
              </Button>
            </div>
          </form>
        )}
        <ul className="scrollbar-thin min-h-0 flex-1 overflow-y-auto p-1.5">
          <li className="flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-xs text-muted-foreground">
            <FileText className="size-3.5" /> SKILL.md
          </li>
          {skill.files.map((f) => (
            <li key={f.path}>
              <button
                onClick={() => setSelected(f.path)}
                className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left font-mono text-xs transition-colors', selected === f.path ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50')}
              >
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div className="min-w-0 flex-1">
        {current ? (
          <FileEditor key={current.path} skill={skill} file={current} onDelete={() => remove(current.path)} />
        ) : (
          <EmptyState
            icon={Paperclip}
            title={skill.files.length ? 'Select a file' : 'No supporting files'}
            action={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => upload.current?.click()}>
                  <Upload /> Upload
                </Button>
                <Button onClick={() => setCreating(true)}>
                  <FilePlus /> New file
                </Button>
              </div>
            }
          >
            References, templates and checklists live next to SKILL.md. Link to them with relative paths like references/checklist.md.
          </EmptyState>
        )}
      </div>
      {confirmNode}
    </div>
  );
}

function FileEditor({ skill, file, onDelete }: { skill: Skill; file: SkillFile; onDelete: () => void }) {
  const repo = useRepository();
  const editor = useDebouncedSave(file.content, `${skill.id}:${file.path}`, async (content: string) => {
    const latest = await repo.getSkill(skill.id);
    if (!latest) return;
    await repo.updateSkill(skill.id, { files: latest.files.map((f) => (f.path === file.path ? { ...f, content } : f)) });
  });
  const referenced = skill.content.includes(file.path);

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 shrink-0 items-center gap-2 border-b px-3">
        <span className="truncate font-mono text-xs">{file.path}</span>
        {!referenced && <span className="rounded bg-info/10 px-1.5 py-px text-[10.5px] text-info">not linked from SKILL.md</span>}
        <span className="ml-auto text-[11px] text-muted-foreground">{editor.saving ? 'Saving…' : 'Saved'}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => downloadBlob(editor.value, file.path.split('/').pop() ?? 'file.txt', 'text/plain')} aria-label="Download file">
          <Download />
        </Button>
        <Button variant="ghost" size="icon-sm" onClick={onDelete} aria-label="Delete file" className="hover:text-err">
          <Trash2 />
        </Button>
      </div>
      <CodeEditor value={editor.value} onChange={editor.update} ariaLabel={`Contents of ${file.path}`} className="min-h-0 flex-1" />
    </div>
  );
}
