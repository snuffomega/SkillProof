import { parse as parseYaml, parseDocument } from 'yaml';

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

export interface ParsedSkill {
  hasFrontmatter: boolean;
  frontmatter: Record<string, unknown>;
  frontmatterError: string | null;
  body: string;
  /** 1-based line where the body starts in the original content. */
  bodyLine: number;
}

export function parseSkillMarkdown(content: string): ParsedSkill {
  const match = content.match(FRONTMATTER);
  if (!match) {
    return { hasFrontmatter: false, frontmatter: {}, frontmatterError: null, body: content, bodyLine: 1 };
  }
  const body = content.slice(match[0].length);
  const bodyLine = match[0].split('\n').length;
  try {
    const data = parseYaml(match[1]);
    if (data !== null && (typeof data !== 'object' || Array.isArray(data))) {
      return { hasFrontmatter: true, frontmatter: {}, frontmatterError: 'Frontmatter must be a key/value mapping', body, bodyLine };
    }
    return { hasFrontmatter: true, frontmatter: (data ?? {}) as Record<string, unknown>, frontmatterError: null, body, bodyLine };
  } catch (e) {
    const msg = e instanceof Error ? e.message.split('\n')[0] : 'Invalid YAML';
    return { hasFrontmatter: true, frontmatter: {}, frontmatterError: msg, body, bodyLine };
  }
}

export function readMeta(content: string): { name: string; description: string } {
  const { frontmatter } = parseSkillMarkdown(content);
  return {
    name: typeof frontmatter.name === 'string' ? frontmatter.name.trim() : '',
    description: typeof frontmatter.description === 'string' ? frontmatter.description.trim() : '',
  };
}

/** Set a top-level frontmatter field, preserving other keys and comments. Empty string removes the key. */
export function setFrontmatterField(content: string, key: string, value: string): string {
  const match = content.match(FRONTMATTER);
  if (!match) {
    if (!value) return content;
    const doc = parseDocument('');
    doc.set(key, value);
    return `---\n${doc.toString().trimEnd()}\n---\n\n${content.replace(/^\n+/, '')}`;
  }
  const doc = parseDocument(match[1]);
  if (doc.errors.length) return content;
  if (value) doc.set(key, value);
  else doc.delete(key);
  const yaml = doc.toString({ lineWidth: 0 }).trimEnd();
  return `---\n${yaml}\n---\n${content.slice(match[0].length)}`;
}

export function skillTemplate(name: string, description: string): string {
  return `---
name: ${name}
description: ${description || 'Describe what this skill does and when an agent should use it.'}
---

# ${titleCase(name)}

## When to use
- Describe the situations that should trigger this skill.

## Expectations
- State the outcome the agent is accountable for, not the steps to take.

## Quality bar
- List the standards a reviewer will check the result against.

## Outputs
- Name the artifacts this skill must produce.
`;
}

export function titleCase(slug: string): string {
  return slug
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

export interface MarkdownLink {
  text: string;
  href: string;
  line: number;
}

export function extractLinks(markdown: string, lineOffset = 1): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const lines = markdown.split('\n');
  let inFence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
    if (inFence) return;
    const re = /(?<!!)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line))) links.push({ text: m[1], href: m[2], line: i + lineOffset });
  });
  return links;
}

export function extractHeadings(markdown: string): string[] {
  return markdown
    .split('\n')
    .filter((l) => /^#{1,6}\s+/.test(l))
    .map((l) => l.replace(/^#{1,6}\s+/, '').trim());
}
