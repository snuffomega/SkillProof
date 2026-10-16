import { useRef } from 'react';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  ariaLabel: string;
}

export function CodeEditor({ value, onChange, className, placeholder, ariaLabel }: CodeEditorProps) {
  const gutter = useRef<HTMLDivElement>(null);
  const lines = value.split('\n').length;

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Tab') return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: end } = el;
    const next = value.slice(0, s) + '  ' + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };

  return (
    <div className={cn('relative flex min-h-0 overflow-hidden bg-surface font-mono text-[12.5px] leading-[20px]', className)}>
      <div ref={gutter} aria-hidden className="select-none overflow-hidden border-r bg-surface-2/50 px-2.5 py-3 text-right text-muted-foreground/60 tabular-nums">
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        aria-label={ariaLabel}
        value={value}
        spellCheck={false}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(e) => {
          if (gutter.current) gutter.current.scrollTop = e.currentTarget.scrollTop;
        }}
        className="scrollbar-thin min-h-0 flex-1 resize-none overflow-auto whitespace-pre bg-transparent px-4 py-3 text-foreground outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}
