import { useState } from 'react';
import { toast } from 'sonner';
import { CircleAlert, Lock } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subject: string;
  nextVersion: number;
  errors: number;
  warnings: number;
  onPublish: (note: string) => Promise<unknown>;
}

export function PublishDialog({ open, onOpenChange, subject, nextVersion, errors, warnings, onPublish }: PublishDialogProps) {
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      await onPublish(note.trim());
      toast.success(`Published ${subject} v${nextVersion}`);
      setNote('');
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Publishing failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Publish v{nextVersion}</DialogTitle>
          <DialogDescription>Creates an immutable snapshot of {subject}. You can keep editing the draft afterwards.</DialogDescription>
        </DialogHeader>
        {errors > 0 ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-err/30 bg-err/10 px-3 py-2.5 text-[13px] text-err">
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
            Fix {errors} validation error{errors === 1 ? '' : 's'} before publishing.
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="publish-note">Release note</Label>
            <Textarea id="publish-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed in this version?" autoFocus />
            {warnings > 0 && <p className="text-xs text-warn">{warnings} warning{warnings === 1 ? '' : 's'} will be published as-is.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy || errors > 0}>
            <Lock /> Publish snapshot
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
