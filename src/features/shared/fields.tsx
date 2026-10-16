import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** Text input that keeps local state while focused, so derived values can't fight the user's typing. */
export function MetaField({ value, onCommit, className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setLocal(value);
  }, [value, focused]);
  return (
    <Input
      {...props}
      className={className}
      value={local}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        setLocal(e.target.value);
        onCommit(e.target.value);
      }}
    />
  );
}

export function TagInput({ tags, onChange, suggestions = [], className }: { tags: string[]; onChange: (tags: string[]) => void; suggestions?: string[]; className?: string }) {
  const [draft, setDraft] = useState('');
  const listId = 'tag-suggestions';

  const add = (raw: string) => {
    const t = raw.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setDraft('');
  };

  return (
    <div className={cn('flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-input bg-surface px-1.5 py-1 focus-within:ring-2 focus-within:ring-ring/40', className)}>
      {tags.map((t) => (
        <span key={t} className="inline-flex h-5 items-center gap-1 rounded bg-muted pl-1.5 pr-0.5 font-mono text-[11px]">
          #{t}
          <button onClick={() => onChange(tags.filter((x) => x !== t))} className="rounded p-0.5 text-muted-foreground hover:text-foreground" aria-label={`Remove tag ${t}`}>
            <X className="size-2.5" />
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          } else if (e.key === 'Backspace' && !draft && tags.length) onChange(tags.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={tags.length ? '' : 'Add tag…'}
        aria-label="Add tag"
        className="h-5 min-w-16 flex-1 bg-transparent px-1 text-xs outline-none placeholder:text-muted-foreground"
      />
      <datalist id={listId}>
        {suggestions.filter((s) => !tags.includes(s)).map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>
    </div>
  );
}

/** Edits locally and saves on blur or Enter, so every keystroke doesn't become an undo step. */
export function CommitInput({ value, onCommit, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  const commit = () => local !== value && onCommit(local.trim());
  return (
    <Input
      {...props}
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        if (e.key === 'Escape') {
          setLocal(value);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
    />
  );
}

export function CommitTextarea({ value, onCommit, ...props }: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string; onCommit: (v: string) => void }) {
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <Textarea {...props} value={local} onChange={(e) => setLocal(e.target.value)} onBlur={() => local !== value && onCommit(local.trim())} />;
}
