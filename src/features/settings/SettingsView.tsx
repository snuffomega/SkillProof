import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Database, Download, Eye, EyeOff, KeyRound, Moon, RotateCcw, Sun, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { PageHeader } from '@/components/common';
import { useConfirm } from '@/components/ConfirmDialog';
import { useRepository, useRuns, useScenarios, useSetting, useSkills, useStacks } from '@/data/hooks';
import { seedDemo } from '@/data/seed';
import { exportSkillsZip } from '@/domain/bundle';
import { downloadBlob } from '@/lib/download';
import { useUI } from '@/store/ui';

function Row({ title, description, children }: { title: string; description: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function Card({ icon: Icon, title, children }: { icon: React.ComponentType<{ className?: string }>; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-surface px-5">
      <h3 className="flex items-center gap-2 border-b py-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Icon className="size-3.5" /> {title}
      </h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}

const formatBytes = (n: number) => (n < 1024 * 1024 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

export function SettingsView() {
  const repo = useRepository();
  const theme = useUI((s) => s.theme);
  const toggleTheme = useUI((s) => s.toggleTheme);
  const navigate = useUI((s) => s.navigate);
  const savedToken = useSetting('githubToken');
  const skills = useSkills() ?? [];
  const stacks = useStacks() ?? [];
  const scenarios = useScenarios() ?? [];
  const runs = useRuns() ?? [];
  const [token, setToken] = useState('');
  const [reveal, setReveal] = useState(false);
  const [usage, setUsage] = useState<{ usage: number; quota: number } | null>(null);
  const [working, setWorking] = useState(false);
  const [confirm, confirmNode] = useConfirm();

  useEffect(() => setToken(savedToken ?? ''), [savedToken]);

  useEffect(() => {
    navigator.storage
      ?.estimate?.()
      .then((e) => setUsage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }))
      .catch(() => setUsage(null));
  }, [skills.length, stacks.length, runs.length]);

  const saveToken = async () => {
    await repo.setSetting('githubToken', token.trim());
    toast.success(token.trim() ? 'GitHub token saved on this device' : 'GitHub token removed');
  };

  const exportLibrary = async () => {
    const data = await exportSkillsZip(skills);
    downloadBlob(data, `skillproof-library-${new Date().toISOString().slice(0, 10)}.zip`, 'application/zip');
    toast.success(`Exported ${skills.length} skills`);
  };

  const wipe = async (reseed: boolean) => {
    setWorking(true);
    try {
      const keep = await repo.getSetting('githubToken');
      await repo.clearAll();
      if (keep) await repo.setSetting('githubToken', keep);
      if (reseed) await seedDemo(repo);
      else await repo.setSetting('seededAt', String(Date.now()));
      toast.success(reseed ? 'Demo workspace restored' : 'Workspace cleared');
      navigate({ view: 'library' });
    } catch (e) {
      toast.error('Something went wrong', { description: e instanceof Error ? e.message : undefined });
    } finally {
      setWorking(false);
    }
  };

  const dirty = token.trim() !== (savedToken ?? '');

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Settings" subtitle="Everything is stored locally in this browser. Nothing is sent to a server." />
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-5 p-5 fade-up">
          <Card icon={theme === 'dark' ? Moon : Sun} title="Appearance">
            <Row title="Dark mode" description="Switch between the dark and light themes. You can also use the command palette.">
              <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} aria-label="Dark mode" />
            </Row>
          </Card>

          <Card icon={KeyRound} title="GitHub">
            <Row
              title="Personal access token"
              description="Optional. Raises GitHub's limit on how many requests you can make when importing from public repositories. A token without any scopes is enough. Stored only on this device."
            >
              <form
                className="flex w-full items-center gap-2 sm:w-auto"
                onSubmit={(e) => {
                  e.preventDefault();
                  void saveToken();
                }}
              >
                <div className="relative w-full sm:w-60">
                  <Input
                    type={reveal ? 'text' : 'password'}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_..."
                    autoComplete="off"
                    aria-label="GitHub token"
                    className="pr-8 font-mono text-xs"
                  />
                  <button type="button" onClick={() => setReveal((v) => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={reveal ? 'Hide token' : 'Show token'}>
                    {reveal ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </button>
                </div>
                <Button size="sm" type="submit" disabled={!dirty}>
                  Save
                </Button>
              </form>
            </Row>
          </Card>

          <Card icon={Database} title="Data">
            <Row
              title="Local storage"
              description={
                <>
                  {skills.length} skills · {stacks.length} stacks · {scenarios.length} scenarios · {runs.length} runs
                  {usage && usage.quota > 0 && ` · ${formatBytes(usage.usage)} used`}
                </>
              }
            >
              <Button size="sm" variant="outline" onClick={exportLibrary} disabled={!skills.length}>
                <Download /> Export library
              </Button>
            </Row>
            <Row title="Restore demo workspace" description="Replace everything with the sample skills, stacks and evaluations. Your GitHub token is kept.">
              <Button
                size="sm"
                variant="outline"
                disabled={working}
                onClick={() =>
                  confirm({
                    title: 'Restore the demo workspace?',
                    description: 'All current skills, stacks, versions and evaluations are replaced with the demo content. Export anything you want to keep first.',
                    confirmLabel: 'Restore demo',
                    onConfirm: () => wipe(true),
                  })
                }
              >
                <RotateCcw /> Restore demo
              </Button>
            </Row>
            <Row title="Clear everything" description="Delete all skills, stacks, published versions and evaluations from this browser.">
              <Button
                size="sm"
                variant="destructive"
                disabled={working}
                onClick={() =>
                  confirm({
                    title: 'Clear the entire workspace?',
                    description: 'This permanently deletes every skill, stack, version and evaluation stored in this browser.',
                    confirmLabel: 'Clear everything',
                    destructive: true,
                    onConfirm: () => wipe(false),
                  })
                }
              >
                <Trash2 /> Clear
              </Button>
            </Row>
          </Card>
        </div>
      </div>
      {confirmNode}
    </div>
  );
}
