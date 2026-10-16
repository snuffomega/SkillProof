import { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { buttonVariants } from '@/components/ui/button';

interface ConfirmOptions {
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** Imperative confirm dialog: `const [confirm, dialog] = useConfirm(); confirm({...}); return <>{dialog}</>` */
export function useConfirm(): [(o: ConfirmOptions) => void, React.ReactNode] {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const node = (
    <AlertDialog open={!!opts} onOpenChange={(o) => !o && setOpts(null)}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-base">{opts?.title}</AlertDialogTitle>
          <AlertDialogDescription className="text-[13px]">{opts?.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className={buttonVariants({ variant: 'outline' })}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className={buttonVariants({ variant: opts?.destructive ? 'destructive' : 'default' })}
            onClick={() => {
              void opts?.onConfirm();
              setOpts(null);
            }}
          >
            {opts?.confirmLabel ?? 'Confirm'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
  return [setOpts, node];
}
