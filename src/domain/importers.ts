import { readMeta } from './skill-markdown';
import type { SkillFile } from './types';

export interface ImportedFile {
  path: string;
  content: string;
}

export interface SkillCandidate {
  key: string;
  name: string;
  description: string;
  content: string;
  files: SkillFile[];
}

const TEXT_EXT = new Set([
  'md', 'markdown', 'txt', 'json', 'yaml', 'yml', 'toml', 'csv', 'tsv', 'xml', 'html', 'css',
  'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rb', 'go', 'rs', 'java', 'sh', 'bash', 'zsh',
  'sql', 'ini', 'cfg', 'env.example', 'tex', 'rst', 'ipynb',
]);
export const MAX_TEXT_FILE_BYTES = 512 * 1024;

export function isTextPath(path: string): boolean {
  const base = path.split('/').pop() ?? '';
  if (/^(license|readme|makefile|dockerfile)$/i.test(base)) return true;
  const ext = base.includes('.') ? base.split('.').pop()!.toLowerCase() : '';
  return TEXT_EXT.has(ext);
}

export function isIgnoredPath(path: string): boolean {
  return path.split('/').some((seg) => seg.startsWith('.') || seg === 'node_modules' || seg === '__MACOSX');
}

const isSkillFile = (path: string) => /(^|\/)skill\.md$/i.test(path);
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '');
const baseName = (path: string) => path.split('/').pop() ?? path;

/**
 * Group a flat list of files into skills. Every SKILL.md defines a skill rooted at its folder;
 * other files under that folder (and not under a nested skill) become attached resources.
 * If no SKILL.md exists, each loose Markdown file is treated as its own skill.
 */
export function groupFilesIntoSkills(input: ImportedFile[]): SkillCandidate[] {
  const files = input
    .map((f) => ({ ...f, path: f.path.replace(/\\/g, '/').replace(/^\/+/, '') }))
    .filter((f) => !isIgnoredPath(f.path));
  const roots = files.filter((f) => isSkillFile(f.path)).map((f) => dirOf(f.path));

  if (!roots.length) {
    return files
      .filter((f) => /\.(md|markdown)$/i.test(f.path))
      .map((f) => {
        const meta = readMeta(f.content);
        const fallback = baseName(f.path).replace(/\.(md|markdown)$/i, '');
        return { key: f.path, name: meta.name || fallback, description: meta.description, content: f.content, files: [] };
      });
  }

  const sortedRoots = [...new Set(roots)].sort((a, b) => b.length - a.length);
  const ownerOf = (path: string) => sortedRoots.find((r) => r === '' || path.startsWith(r + '/'));

  return [...new Set(roots)].map((root) => {
    const skillFile = files.find((f) => isSkillFile(f.path) && dirOf(f.path) === root)!;
    const attached = files
      .filter((f) => f !== skillFile && ownerOf(f.path) === root && !isSkillFile(f.path))
      .map((f) => ({ path: root ? f.path.slice(root.length + 1) : f.path, content: f.content }))
      .sort((a, b) => a.path.localeCompare(b.path));
    const meta = readMeta(skillFile.content);
    return {
      key: root || skillFile.path,
      name: meta.name || baseName(root) || 'untitled-skill',
      description: meta.description,
      content: skillFile.content,
      files: attached,
    };
  });
}

export interface GitHubTarget {
  owner: string;
  repo: string;
  ref: string | null;
  path: string;
}

export function parseGitHubUrl(input: string): GitHubTarget | null {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '');
  const short = trimmed.match(/^([\w.-]+)\/([\w.-]+)$/);
  if (short) return { owner: short[1], repo: short[2], ref: null, path: '' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
  const [owner, repo, kind, ref, ...rest] = url.pathname.split('/').filter(Boolean);
  if (!owner || !repo) return null;
  if (kind && (kind === 'tree' || kind === 'blob') && ref) {
    let path = rest.join('/');
    if (kind === 'blob') path = dirOf(path);
    return { owner, repo, ref, path };
  }
  return { owner, repo, ref: null, path: '' };
}
