import { Toaster as Sonner } from 'sonner';
import { useUI } from '@/store/ui';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = (props: ToasterProps) => {
  const theme = useUI((s) => s.theme);
  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: 'group toast !bg-popover !text-popover-foreground !border-border !shadow-xl !rounded-lg !text-[13px]',
          description: '!text-muted-foreground',
          actionButton: '!bg-primary !text-primary-foreground',
          cancelButton: '!bg-muted !text-muted-foreground',
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
