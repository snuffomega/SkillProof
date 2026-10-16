import { useEffect, useRef, useState } from 'react';

interface Pending<T> {
  value: T;
  save: (value: T) => Promise<unknown>;
}

/**
 * Local editable copy of a persisted value, flushed after a pause in typing.
 * External changes (restores, imports) are adopted whenever no local edit is pending.
 * Changing `resetKey` flushes unsaved edits to the record they belong to.
 */
export function useDebouncedSave<T>(source: T, resetKey: string, save: (value: T) => Promise<unknown>, delay = 400) {
  const [value, setValue] = useState(source);
  const [saving, setSaving] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Pending<T> | null>(null);

  const flush = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const p = pending.current;
    pending.current = null;
    return p ? p.save(p.value) : Promise.resolve();
  };

  useEffect(
    () => () => {
      void flush();
    },
    [resetKey],
  );

  useEffect(() => {
    if (pending.current === null) setValue(source);
  }, [source, resetKey]);

  const update = (next: T) => {
    setValue(next);
    pending.current = { value: next, save };
    setSaving(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      await flush();
      setSaving(false);
    }, delay);
  };

  return { value, update, saving, flush };
}
