export function uid(prefix = ''): string {
  const raw = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  return prefix ? `${prefix}_${raw}` : raw;
}

/** FNV-1a, enough to detect content drift between a draft and its published snapshot. */
export function hashString(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
