import { describe, it, expect } from 'vitest';
import { buildLandscape } from './landscape';
import { layoutLandscape } from './landscape-layout';
import type { Skill, Stack, StackNode, StackEdge } from './types';

function makeSkill(id: string, name: string, content: string, folder = '', tags: string[] = [], files: { path: string; content: string }[] = []): Skill {
  return {
    id,
    name,
    description: '',
    content,
    files,
    tags,
    folder,
    source: { kind: 'manual' },
    createdAt: 0,
    updatedAt: 0,
    publishedVersion: null,
    publishedHash: null,
  };
}

describe('landscape: verified relationships', () => {
  it('does not create false verified relationships when a skill has an empty folder', () => {
    const skills = [
      makeSkill('a', 'skill-a', 'No links here', '', ['security']),
      makeSkill('b', 'skill-b', 'A link to [docs](https://example.com/docs)', 'docs', ['documentation']),
    ];
    const landscape = buildLandscape(skills);
    const verified = landscape.relationships.filter((r) => r.trust === 'verified');
    // skill-a has empty folder — must not match every link in skill-b
    expect(verified).toHaveLength(0);
  });

  it('creates a verified relationship when a skill explicitly links to another by name', () => {
    const skills = [
      makeSkill('a', 'deploy-skill', 'See [deploy guide](deploy-guide) for details', 'deploy'),
      makeSkill('b', 'deploy-guide', 'Deployment instructions', 'deploy-guide'),
    ];
    const landscape = buildLandscape(skills);
    const verified = landscape.relationships.filter((r) => r.trust === 'verified');
    expect(verified.length).toBeGreaterThanOrEqual(1);
    expect(verified.some((r) => (r.source === 'a' && r.target === 'b') || (r.source === 'b' && r.target === 'a'))).toBe(true);
  });

  it('creates a verified relationship for shared file references', () => {
    const skills = [
      makeSkill('a', 'skill-a', 'Content', 'a', [], [{ path: 'shared/config.yml', content: 'key: value' }]),
      makeSkill('b', 'skill-b', 'Content', 'b', [], [{ path: 'shared/config.yml', content: 'key: value' }]),
    ];
    const landscape = buildLandscape(skills);
    const verified = landscape.relationships.filter((r) => r.trust === 'verified' && r.kind === 'shared-policy');
    expect(verified.length).toBeGreaterThanOrEqual(1);
  });
});

describe('landscape: manual relationships use skill IDs not node IDs', () => {
  it('maps stack node IDs to skill IDs for manual edges', () => {
    const skills = [
      makeSkill('skill-1', 'code-review', 'Code review content', 'review', ['code-quality']),
      makeSkill('skill-2', 'security-audit', 'Security audit content', 'security', ['security-and-compliance']),
    ];
    // Stack edges reference node IDs, not skill IDs
    const nodes: StackNode[] = [
      { id: 'node-x', skillId: 'skill-1', position: { x: 0, y: 0 }, role: '' },
      { id: 'node-y', skillId: 'skill-2', position: { x: 100, y: 0 }, role: '' },
    ];
    const edges: StackEdge[] = [
      { id: 'edge-1', source: 'node-x', target: 'node-y', kind: 'handoff', label: 'review to audit', notes: '', detail: '' },
    ];
    const stacks: Stack[] = [
      { id: 'stack-1', name: 'Test Stack', description: '', nodes, edges, contract: { goals: [], expectations: [], standards: [], checkpoints: [], outputs: [] }, createdAt: 0, updatedAt: 0, publishedVersion: null, publishedHash: null },
    ];

    // Simulate what useLandscape does: map node IDs to skill IDs
    const manualEdges = stacks.flatMap((st) => {
      const nodeToSkill = new Map(st.nodes.map((n) => [n.id, n.skillId]));
      return st.edges.map((e) => ({
        source: nodeToSkill.get(e.source) ?? e.source,
        target: nodeToSkill.get(e.target) ?? e.target,
        kind: e.kind,
        label: e.label,
      }));
    });

    const landscape = buildLandscape(skills, manualEdges);
    const manual = landscape.relationships.filter((r) => r.trust === 'manual');
    expect(manual).toHaveLength(1);
    expect(manual[0].source).toBe('skill-1');
    expect(manual[0].target).toBe('skill-2');
  });

  it('does not create manual relationships when node IDs do not map to skills', () => {
    const skills = [
      makeSkill('skill-1', 'code-review', 'Code review content', 'review', ['code-quality']),
    ];
    const manualEdges = [
      { source: 'node-x', target: 'node-y', kind: 'handoff', label: 'test' },
    ];
    const landscape = buildLandscape(skills, manualEdges);
    const manual = landscape.relationships.filter((r) => r.trust === 'manual');
    expect(manual).toHaveLength(0);
  });
});

describe('landscape: inferred relationships are labeled as suggestions', () => {
  it('uses suggestive language in inferred relationship reasons', () => {
    const skills = [
      makeSkill('a', 'skill-a', '## When to use\n- Security review\n- Vulnerability scanning\n- Access control\n- Compliance audit\n- Encryption standards\n', 'security', ['security']),
      makeSkill('b', 'skill-b', '## When to use\n- Security review\n- Vulnerability scanning\n- Access control\n- Compliance audit\n- Penetration testing\n', 'security', ['security']),
    ];
    const landscape = buildLandscape(skills);
    const inferred = landscape.relationships.filter((r) => r.trust === 'inferred');
    expect(inferred.length).toBeGreaterThanOrEqual(1);
    for (const r of inferred) {
      const lower = r.reason.toLowerCase();
      const hasSuggestiveLanguage =
        lower.includes('suggest') ||
        lower.includes('may') ||
        lower.includes('appear') ||
        lower.includes('possibly') ||
        lower.includes('review to confirm');
      expect(hasSuggestiveLanguage, `Reason "${r.reason}" should use suggestive language`).toBe(true);
    }
  });
});

describe('landscape: layout handles multi-area skills', () => {
  it('assigns each skill exactly one position even when it belongs to multiple areas', () => {
    const skills = [
      makeSkill('a', 'skill-a', 'Security testing code review deployment pipeline', '', ['security', 'code-quality', 'deployment-and-release']),
      makeSkill('b', 'skill-b', 'Security audit compliance', '', ['security']),
      makeSkill('c', 'skill-c', 'Code review linting testing', '', ['code-quality']),
    ];
    const landscape = buildLandscape(skills);
    // skill-a should belong to multiple areas
    const aMemberships = landscape.memberships.get('a') ?? [];
    expect(aMemberships.length).toBeGreaterThan(1);

    // Run layout
    const { skillPositions } = layoutLandscape(landscape);

    // Every skill should have exactly one position
    expect(skillPositions.has('a')).toBe(true);
    expect(skillPositions.has('b')).toBe(true);
    expect(skillPositions.has('c')).toBe(true);

    // No two skills should share the same position
    const positions = [...skillPositions.values()];
    const uniquePositions = new Set(positions.map((p) => `${p.x},${p.y}`));
    expect(uniquePositions.size).toBe(positions.length);
  });
});
