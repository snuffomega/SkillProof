import { useMemo } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { parseSkillMarkdown } from '@/domain/skill-markdown';
import { cn } from '@/lib/utils';

export function MarkdownPreview({ content, className, showFrontmatter = true }: { content: string; className?: string; showFrontmatter?: boolean }) {
  const parsed = useMemo(() => parseSkillMarkdown(content), [content]);
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(parsed.body, { gfm: true, async: false }) as string), [parsed.body]);
  const entries = Object.entries(parsed.frontmatter);

  return (
    <div className={cn('prose-skill', className)}>
      {showFrontmatter && entries.length > 0 && (
        <dl className="not-prose mb-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg border bg-surface-2/60 px-4 py-3 text-[12.5px]">
          {entries.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="font-mono text-muted-foreground">{k}</dt>
              <dd className="min-w-0 break-words">{typeof v === 'string' ? v : JSON.stringify(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
