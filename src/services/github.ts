import { isIgnoredPath, isTextPath, MAX_TEXT_FILE_BYTES, parseGitHubUrl, type ImportedFile } from '@/domain/importers';

const MAX_FILES = 300;

interface TreeEntry {
  path: string;
  type: 'blob' | 'tree';
  size?: number;
}

export class GitHubImportError extends Error {}

async function api<T>(url: string, token?: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (res.status === 404) throw new GitHubImportError('Repository or path not found. Only public repositories can be imported without an access token.');
  if (res.status === 403 || res.status === 429) {
    const reset = res.headers.get('x-ratelimit-reset');
    const when = reset ? ` Try again after ${new Date(Number(reset) * 1000).toLocaleTimeString()}.` : '';
    throw new GitHubImportError(`GitHub rate limit reached.${when} Adding a personal access token in Settings raises the limit.`);
  }
  if (!res.ok) throw new GitHubImportError(`GitHub responded with ${res.status}.`);
  return res.json() as Promise<T>;
}

export async function fetchGitHubSkillFiles(
  url: string,
  token: string | undefined,
  onProgress?: (msg: string) => void,
): Promise<{ files: ImportedFile[]; skipped: string[]; ref: string }> {
  const target = parseGitHubUrl(url);
  if (!target) throw new GitHubImportError('Enter a GitHub URL like https://github.com/owner/repo or owner/repo.');
  const { owner, repo } = target;
  onProgress?.('Reading repository…');
  const ref = target.ref ?? (await api<{ default_branch: string }>(`https://api.github.com/repos/${owner}/${repo}`, token)).default_branch;
  onProgress?.('Listing files…');
  const tree = await api<{ tree: TreeEntry[]; truncated: boolean }>(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(ref)}?recursive=1`,
    token,
  );
  const prefix = target.path ? target.path.replace(/\/+$/, '') + '/' : '';
  const blobs = tree.tree.filter((e) => e.type === 'blob' && (prefix ? e.path.startsWith(prefix) || e.path === target.path : true) && !isIgnoredPath(e.path));
  const roots = blobs.filter((b) => /(^|\/)SKILL\.md$/i.test(b.path)).map((b) => (b.path.includes('/') ? b.path.slice(0, b.path.lastIndexOf('/')) : ''));
  if (!roots.length) throw new GitHubImportError('No SKILL.md files found at that location.');

  const skipped: string[] = [];
  const wanted = blobs.filter((b) => roots.some((r) => r === '' || b.path.startsWith(r + '/')));
  const selected = wanted.filter((b) => {
    const ok = isTextPath(b.path) && (b.size ?? 0) <= MAX_TEXT_FILE_BYTES;
    if (!ok) skipped.push(b.path);
    return ok;
  });
  if (selected.length > MAX_FILES) throw new GitHubImportError(`Found ${selected.length} files; narrow the URL to a folder with fewer than ${MAX_FILES}.`);

  const files: ImportedFile[] = [];
  let done = 0;
  const queue = [...selected];
  const worker = async () => {
    while (queue.length) {
      const entry = queue.shift()!;
      const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${encodeURIComponent(ref)}/${entry.path.split('/').map(encodeURIComponent).join('/')}`;
      const res = await fetch(raw);
      if (res.ok) files.push({ path: prefix ? entry.path.slice(prefix.length) : entry.path, content: await res.text() });
      else skipped.push(entry.path);
      onProgress?.(`Downloading files ${++done}/${selected.length}`);
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { files, skipped, ref };
}
