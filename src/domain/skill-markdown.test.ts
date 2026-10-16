import { describe, expect, it } from 'vitest';
import { extractLinks, parseSkillMarkdown, readMeta, setFrontmatterField, skillTemplate } from './skill-markdown';

describe('parseSkillMarkdown', () => {
  it('reads frontmatter and body', () => {
    const p = parseSkillMarkdown('---\nname: demo\ndescription: Does things\n---\n\n# Title\n');
    expect(p.hasFrontmatter).toBe(true);
    expect(p.frontmatter).toEqual({ name: 'demo', description: 'Does things' });
    expect(p.body.trim()).toBe('# Title');
    expect(p.bodyLine).toBe(5);
  });

  it('reports invalid YAML without throwing', () => {
    const p = parseSkillMarkdown('---\nname: [unclosed\n---\nbody');
    expect(p.frontmatterError).toBeTruthy();
  });

  it('treats files without frontmatter as body only', () => {
    expect(parseSkillMarkdown('# Hello').hasFrontmatter).toBe(false);
  });
});

describe('setFrontmatterField', () => {
  it('updates a field and keeps the body intact', () => {
    const src = skillTemplate('alpha', 'First description that is long enough.');
    const next = setFrontmatterField(src, 'description', 'Changed');
    expect(readMeta(next)).toEqual({ name: 'alpha', description: 'Changed' });
    expect(next.endsWith(parseSkillMarkdown(src).body)).toBe(true);
  });

  it('creates frontmatter when absent', () => {
    const next = setFrontmatterField('# Body', 'name', 'new-skill');
    expect(readMeta(next).name).toBe('new-skill');
    expect(next).toContain('# Body');
  });
});

describe('extractLinks', () => {
  it('ignores images and fenced code', () => {
    const links = extractLinks('[a](one.md)\n![img](pic.png)\n```\n[b](two.md)\n```\n[c](three.md "t")');
    expect(links.map((l) => l.href)).toEqual(['one.md', 'three.md']);
    expect(links[1].line).toBe(6);
  });
});
