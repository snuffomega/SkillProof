import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, ArrowLeft, FileArchive, FileText, FolderOpen, Globe, Layers, Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useRepository, useSetting, useSkills } from '@/data/hooks';
import { parseStackBundle } from '@/domain/bundle';
import { groupFilesIntoSkills, parseGitHubUrl, type ImportedFile } from '@/domain/importers';
import type { SkillSourceKind } from '@/domain/types';
import { readSelectedFiles } from '@/services/file-input';
import { fetchGitHubSkillFiles } from '@/services/github';
import { importBundle, importSkills, type DuplicateStrategy } from '@/services/import-service';
import { cn } from '@/lib/utils';
import { useUI } from '@/store/ui';
import { ImportPreview, type PreviewState } from './ImportPreview';

type Source = 'local' | 'github';

export function ImportDialog() {
  const repo = useRepository();
  const dialog = useUI((s) => s.dialog);
  const openDialog = useUI((s) => s.openDialog);
  const navigate = useUI((s) => s.navigate);
  const token = useSetting('githubToken');
  const skills = useSkills() ?? [];
  const open = dialog === 'import';

  const [source, setSource] = useState<Source>('local');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [strategy, setStrategy] = useState<DuplicateStrategy>('skip');
  const [dragging, setDragging] = useState(false);
  const filesRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const zipRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setSource('local');
      setUrl('');
      setBusy(null);
      setError(null);
      setPreview(null);
      setStrategy('skip');
    }
  }, [open]);

  const existingNames = useMemo(() => new Set(skills.map((s) => s.name)), [skills]);

  const analyze = (files: ImportedFile[], skipped: string[], kind: SkillSourceKind, ref?: string) => {
    setError(null);
    try {
      const bundle = parseStackBundle(files);
      if (bundle) {
        setPreview({ type: 'bundle', bundle, skipped });
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'This bundle could not be read.');
      return;
    }
    const candidates = groupFilesIntoSkills(files);
    if (!candidates.length) {
      setError('No SKILL.md files were found. Each skill needs a folder containing a SKILL.md file.');
      return;
    }
    setPreview({ type: 'skills', candidates, selected: new Set(candidates.map((c) => c.key)), skipped, kind, ref });
  };

  const onLocal = async (list: FileList | File[] | null, kind: SkillSourceKind) => {
    if (!list || !list.length) return;
    setBusy('Reading files');
    try {
      const arr = Array.from(list);
      const effective = kind === 'file' && arr.some((f) => /\.zip$/i.test(f.name)) ? 'zip' : kind;
      const { files, skipped } = await readSelectedFiles(arr);
      analyze(files, skipped, effective, arr.length === 1 ? arr[0].name : undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The files could not be read.');
    } finally {
      setBusy(null);
      [filesRef, folderRef, zipRef].forEach((r) => r.current && (r.current.value = ''));
    }
  };

  const onGitHub = async () => {
    setBusy('Contacting GitHub');
    setError(null);
    try {
      const { files, skipped, ref } = await fetchGitHubSkillFiles(url, token || undefined, setBusy);
      analyze(files, skipped, 'github', `${url.trim()}@${ref}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The repository could not be fetched.');
    } finally {
      setBusy(null);
    }
  };

  const runImport = async () => {
    if (!preview) return;
    setBusy('Importing');
    try {
      if (preview.type === 'bundle') {
        const r = await importBundle(repo, preview.bundle, strategy);
        toast.success(`Imported ${preview.bundle.manifest.stack.name}`, {
          description: `${r.skillsCreated} new, ${r.skillsUpdated} updated, ${r.skillsReused} reused skills`,
        });
        openDialog(null);
        navigate({ view: 'stacks', stackId: r.stackId, tab: 'graph' });
      } else {
        const chosen = preview.candidates.filter((c) => preview.selected.has(c.key));
        const r = await importSkills(repo, chosen, strategy, { kind: preview.kind, ref: preview.ref });
        toast.success(`Imported ${chosen.length} skill${chosen.length === 1 ? '' : 's'}`, {
          description: `${r.created} new, ${r.updated} updated, ${r.reused} skipped as duplicates`,
        });
        openDialog(null);
        const firstId = r.idsByKey.get(chosen[0]?.key ?? '');
        navigate({ view: 'library', skillId: chosen.length === 1 ? firstId : undefined });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
    } finally {
      setBusy(null);
    }
  };

  const ghValid = !!parseGitHubUrl(url);
  const selectedCount = preview?.type === 'skills' ? preview.selected.size : preview ? preview.bundle.skills.length : 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && openDialog(o ? 'import' : null)}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import skills</DialogTitle>
          <DialogDescription>Bring in SKILL.md folders, a ZIP, a public GitHub repository, or a SkillProof stack bundle.</DialogDescription>
        </DialogHeader>

        {preview ? (
          <ImportPreview preview={preview} onChange={setPreview} existingNames={existingNames} strategy={strategy} onStrategy={setStrategy} />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-2 p-1">
              {(
                [
                  ['local', 'From your computer', Upload],
                  ['github', 'From GitHub', Globe],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  onClick={() => setSource(id)}
                  className={cn(
                    'flex h-8 items-center justify-center gap-2 rounded-md text-[13px] text-muted-foreground transition-colors',
                    source === id && 'bg-background text-foreground shadow-sm',
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            {source === 'local' ? (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  void onLocal(e.dataTransfer.files, 'file');
                }}
                className={cn('rounded-xl border border-dashed p-6 text-center transition-colors', dragging ? 'border-primary bg-primary/5' : 'bg-surface')}
              >
                <div className="mx-auto mb-3 grid size-10 place-items-center rounded-lg border bg-background">
                  <Upload className="size-4 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-medium">Drop SKILL.md files or a .zip here</p>
                <p className="mt-1 text-xs text-muted-foreground">Stack bundles exported from SkillProof are detected automatically.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => filesRef.current?.click()} disabled={!!busy}>
                    <FileText /> Files
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => folderRef.current?.click()} disabled={!!busy}>
                    <FolderOpen /> Folder
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => zipRef.current?.click()} disabled={!!busy}>
                    <FileArchive /> ZIP or bundle
                  </Button>
                </div>
                <input ref={filesRef} type="file" multiple hidden onChange={(e) => onLocal(e.target.files, 'file')} />
                <input ref={folderRef} type="file" hidden {...{ webkitdirectory: '', directory: '' }} onChange={(e) => onLocal(e.target.files, 'folder')} />
                <input ref={zipRef} type="file" accept=".zip,application/zip" hidden onChange={(e) => onLocal(e.target.files, 'zip')} />
              </div>
            ) : (
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (ghValid && !busy) void onGitHub();
                }}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="gh-url">Repository or folder URL</Label>
                  <Input id="gh-url" autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://github.com/owner/repo/tree/main/skills" className="font-mono text-xs" />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Public repositories only. Every folder with a SKILL.md is found, including nested ones.{' '}
                  {token ? 'Your saved GitHub token is used for higher rate limits.' : (
                    <>
                      Add a token in{' '}
                      <button
                        type="button"
                        className="underline underline-offset-2 hover:text-foreground"
                        onClick={() => {
                          openDialog(null);
                          navigate({ view: 'settings' });
                        }}
                      >
                        Settings
                      </button>{' '}
                      if you hit rate limits.
                    </>
                  )}
                </p>
                <button type="submit" hidden />
              </form>
            )}
          </div>
        )}

        {error && (
          <div role="alert" className="flex gap-2 rounded-lg border border-err/30 bg-err/5 px-3 py-2 text-xs text-err">
            <AlertTriangle className="mt-px size-3.5 shrink-0" /> {error}
          </div>
        )}

        <DialogFooter className="items-center">
          {busy && (
            <span className="mr-auto flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> {busy}
            </span>
          )}
          {preview ? (
            <>
              <Button variant="outline" onClick={() => setPreview(null)} disabled={!!busy}>
                <ArrowLeft /> Back
              </Button>
              <Button onClick={runImport} disabled={!!busy || selectedCount === 0}>
                {preview.type === 'bundle' ? <Layers /> : <Upload />}
                {preview.type === 'bundle' ? 'Import stack' : `Import ${selectedCount} skill${selectedCount === 1 ? '' : 's'}`}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => openDialog(null)} disabled={!!busy}>
                Cancel
              </Button>
              {source === 'github' && (
                <Button onClick={onGitHub} disabled={!ghValid || !!busy}>
                  <Globe /> Fetch skills
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
