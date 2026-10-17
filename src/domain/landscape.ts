import { extractHeadings, extractLinks, readMeta } from './skill-markdown';
import type { Skill } from './types';

/** Trust level: how a relationship was established. */
export type TrustLevel = 'verified' | 'inferred' | 'manual';

/** Landscape relationships are semantic, not execution-order. */
export type LandscapeKind = 'complement' | 'overlap' | 'conflict' | 'depends' | 'handoff' | 'shared-policy';

export interface LandscapeRelationship {
  id: string;
  source: string;
  target: string;
  kind: LandscapeKind;
  trust: TrustLevel;
  /** Human-readable explanation of why this relationship exists. */
  reason: string;
  /** 0–1 confidence score for inferred relationships; 1 for verified/manual. */
  confidence: number;
}

export interface WorkArea {
  id: string;
  label: string;
  /** Skills that belong to this area, with a 0–1 membership strength. */
  members: { skillId: string; strength: number }[];
  /** Keywords that define this area. */
  keywords: string[];
  /** Areas that share skills with this one. */
  overlapsWith: string[];
}

export interface SkillAreaMembership {
  areaId: string;
  areaLabel: string;
  strength: number;
}

export interface Gap {
  id: string;
  areaId: string;
  areaLabel: string;
  description: string;
  /** Skills that partially address this gap. */
  relatedSkills: string[];
  severity: 'warning' | 'info';
}

export interface Landscape {
  areas: WorkArea[];
  /** Map of skillId → areas it belongs to. */
  memberships: Map<string, SkillAreaMembership[]>;
  relationships: LandscapeRelationship[];
  gaps: Gap[];
  /** Skill IDs that have no area membership. */
  unclassified: string[];
}

// ── Keyword extraction ─────────────────────────────────────────────────

const STOP = new Set([
  'about', 'after', 'agent', 'should', 'would', 'could', 'their', 'there', 'these', 'those',
  'which', 'while', 'where', 'every', 'least', 'without', 'within', 'being', 'other', 'this',
  'that', 'then', 'when', 'what', 'with', 'from', 'have', 'they', 'will', 'been', 'more',
  'such', 'than', 'them', 'into', 'also', 'only', 'some', 'each', 'must', 'shall', 'may',
  'using', 'used', 'uses', 'use', 'make', 'made', 'like', 'need', 'needs', 'here', 'your',
  'skill', 'section', 'below', 'above', 'following', 'example', 'note', 'notes', 'important',
  'expectations', 'expectation', 'quality', 'outputs', 'output', 'when', 'description',
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-z][a-z0-9-]{3,}/g) ?? []).filter((w) => !STOP.has(w));
}

function termFrequency(text: string): Map<string, number> {
  const tokens = tokenize(text);
  const tf = new Map<string, number>();
  for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
  return tf;
}

function topTerms(tf: Map<string, number>, n: number): string[] {
  return [...tf.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([w]) => w);
}

/** Full text of a skill including its files, for analysis. */
function skillCorpus(skill: Skill): string {
  const meta = readMeta(skill.content);
  const headings = extractHeadings(skill.content);
  const fileContents = skill.files.map((f) => f.content).join('\n');
  return [skill.name, meta.description, headings.join(' '), skill.content, fileContents].join('\n');
}

// ── Work area detection ────────────────────────────────────────────────

const AREA_KEYWORDS: Record<string, string[]> = {
  'security-and-compliance': ['security', 'vulnerability', 'audit', 'compliance', 'auth', 'authentication', 'authorization', 'encryption', 'secret', 'credential', 'access-control', 'privacy', 'gdpr', 'policy', 'permission'],
  'code-quality': ['lint', 'format', 'refactor', 'code-review', 'testing', 'test', 'coverage', 'typecheck', 'static-analysis', 'clean-code', 'complexity', 'maintainability'],
  'deployment-and-release': ['deploy', 'deployment', 'release', 'rollback', 'ci', 'cd', 'pipeline', 'staging', 'production', 'canary', 'blue-green', 'infrastructure', 'terraform', 'helm'],
  'incident-and-ops': ['incident', 'alert', 'monitoring', 'observability', 'oncall', 'outage', 'postmortem', 'runbook', 'debugging', 'troubleshoot', 'sre', 'reliability'],
  'data-and-persistence': ['database', 'migration', 'schema', 'query', 'sql', 'indexeddb', 'storage', 'cache', 'redis', 'data-model', 'orm', 'transaction'],
  'frontend-and-ui': ['component', 'ui', 'ux', 'react', 'css', 'tailwind', 'design-system', 'accessibility', 'responsive', 'render', 'dom', 'layout'],
  'documentation': ['documentation', 'readme', 'docs', 'guide', 'tutorial', 'onboarding', 'explain', 'writing', 'markdown', 'reference'],
  'api-and-integration': ['api', 'endpoint', 'rest', 'graphql', 'webhook', 'integration', 'service', 'microservice', 'rpc', 'grpc', 'swagger', 'openapi'],
  'version-control': ['git', 'branch', 'merge', 'commit', 'pr', 'pull-request', 'rebase', 'cherry-pick', 'conflict', 'diff'],
  'project-and-process': ['project', 'sprint', 'backlog', 'roadmap', 'planning', 'estimation', 'stakeholder', 'milestone', 'timeline', 'priority', 'triage'],
};

function detectAreas(skills: Skill[]): { areas: WorkArea[]; memberships: Map<string, SkillAreaMembership[]> } {
  const areaTerms = new Map<string, Map<string, number>>();
  for (const [areaId, keywords] of Object.entries(AREA_KEYWORDS)) {
    areaTerms.set(areaId, termFrequency(keywords.join(' ')));
  }

  const rawMembers: Record<string, { skillId: string; strength: number }[]> = {};
  const memberships = new Map<string, SkillAreaMembership[]>();

  for (const skill of skills) {
    const tf = termFrequency(skillCorpus(skill));
    const skillMemberships: SkillAreaMembership[] = [];

    for (const [areaId, areaTf] of areaTerms) {
      let overlap = 0;
      let areaTotal = 0;
      for (const [term, count] of areaTf) {
        areaTotal += count;
        const hits = tf.get(term) ?? 0;
        if (hits > 0) overlap += Math.min(hits, count);
      }
      const strength = areaTotal > 0 ? overlap / areaTotal : 0;
      if (strength >= 0.08) {
        const label = areaIdToLabel(areaId);
        if (!rawMembers[areaId]) rawMembers[areaId] = [];
        rawMembers[areaId].push({ skillId: skill.id, strength });
        skillMemberships.push({ areaId, areaLabel: label, strength });
      }
    }

    // Folder-based area detection: if the folder name matches an area keyword
    const folderLower = skill.folder.toLowerCase();
    for (const areaId of Object.keys(AREA_KEYWORDS)) {
      const keywords = AREA_KEYWORDS[areaId];
      if (keywords.some((k) => folderLower.includes(k.replace(/-/g, '')) || folderLower.includes(k))) {
        const label = areaIdToLabel(areaId);
        if (!skillMemberships.some((m) => m.areaId === areaId)) {
          if (!rawMembers[areaId]) rawMembers[areaId] = [];
          rawMembers[areaId].push({ skillId: skill.id, strength: 0.7 });
          skillMemberships.push({ areaId, areaLabel: label, strength: 0.7 });
        } else {
          const existing = skillMemberships.find((m) => m.areaId === areaId)!;
          if (existing.strength < 0.7) {
            existing.strength = 0.7;
            const arr = rawMembers[areaId];
            const idx = arr.findIndex((m) => m.skillId === skill.id);
            if (idx >= 0) arr[idx].strength = 0.7;
          }
        }
      }
    }

    // Tag-based detection
    for (const tag of skill.tags) {
      const tagLower = tag.toLowerCase();
      for (const areaId of Object.keys(AREA_KEYWORDS)) {
        const keywords = AREA_KEYWORDS[areaId];
        if (keywords.some((k) => tagLower.includes(k.replace(/-/g, '')) || tagLower.includes(k))) {
          if (!skillMemberships.some((m) => m.areaId === areaId)) {
            const label = areaIdToLabel(areaId);
            if (!rawMembers[areaId]) rawMembers[areaId] = [];
            rawMembers[areaId].push({ skillId: skill.id, strength: 0.6 });
            skillMemberships.push({ areaId, areaLabel: label, strength: 0.6 });
          }
        }
      }
    }

    memberships.set(skill.id, skillMemberships.sort((a, b) => b.strength - a.strength));
  }

  const areas: WorkArea[] = Object.entries(rawMembers)
    .filter(([, members]) => members.length > 0)
    .map(([areaId, members]) => {
      const sorted = members.sort((a, b) => b.strength - a.strength);
      return {
        id: areaId,
        label: areaIdToLabel(areaId),
        members: sorted,
        keywords: AREA_KEYWORDS[areaId].slice(0, 8),
        overlapsWith: [],
      };
    })
    .sort((a, b) => b.members.length - a.members.length);

  // Compute area overlaps (areas sharing skills)
  for (const area of areas) {
    const shared = new Set<string>();
    for (const m of area.members) {
      const skillAreas = memberships.get(m.skillId) ?? [];
      for (const sa of skillAreas) {
        if (sa.areaId !== area.id) shared.add(sa.areaId);
      }
    }
    area.overlapsWith = [...shared];
  }

  return { areas, memberships };
}

function areaIdToLabel(areaId: string): string {
  return areaId
    .split('-')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

// ── Relationship inference ─────────────────────────────────────────────

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const [term, val] of a) {
    magA += val * val;
    const bv = b.get(term);
    if (bv) dot += val * bv;
  }
  for (const [, val] of b) magB += val * val;
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

interface ManualEdge {
  source: string;
  target: string;
  kind: string;
  label: string;
}

/** Verified relationships: explicit markdown links or shared file references between skills. */
function findVerifiedRelationships(skills: Skill[]): LandscapeRelationship[] {
  const rels: LandscapeRelationship[] = [];

  for (const skill of skills) {
    const links = extractLinks(skill.content);
    for (const link of links) {
      const href = link.href.toLowerCase();
      const linkText = link.text.toLowerCase();
      // Link to another skill by name or path
      for (const other of skills) {
        if (other.id === skill.id) continue;
        const otherName = other.name.toLowerCase();
        const otherSlug = otherName.replace(/[^a-z0-9]+/g, '-');
        const otherFolder = other.folder.toLowerCase();
        const matchesName = otherName.length > 0 && (href.includes(otherName) || linkText.includes(otherName));
        const matchesSlug = otherSlug.length > 1 && href.includes(otherSlug);
        const matchesFolder = otherFolder.length > 1 && href.includes(otherFolder);
        if (matchesName || matchesSlug || matchesFolder) {
          rels.push({
            id: `vrf-${skill.id}-${other.id}`,
            source: skill.id,
            target: other.id,
            kind: 'complement',
            trust: 'verified',
            reason: `"${skill.name}" links to "${other.name}" (${link.text || link.href}).`,
            confidence: 1,
          });
        }
      }
    }

    // Shared file references: two skills reference the same file path
    const skillPaths = new Set(skill.files.map((f) => f.path.toLowerCase()));
    for (const other of skills) {
      if (other.id === skill.id) continue;
      const shared = other.files.filter((f) => skillPaths.has(f.path.toLowerCase()));
      if (shared.length > 0) {
        rels.push({
          id: `vrf-file-${skill.id}-${other.id}`,
          source: skill.id,
          target: other.id,
          kind: 'shared-policy',
          trust: 'verified',
          reason: `Both skills reference shared file(s): ${shared.map((f) => f.path).join(', ')}.`,
          confidence: 1,
        });
      }
    }
  }

  // Deduplicate: keep one verified rel per pair, prefer complement over shared-policy
  const seen = new Map<string, LandscapeRelationship>();
  for (const r of rels) {
    const key = [r.source, r.target].sort().join('|');
    const existing = seen.get(key);
    if (!existing || (existing.kind === 'shared-policy' && r.kind === 'complement')) {
      seen.set(key, r);
    }
  }
  return [...seen.values()];
}

/** Inferred relationships: content similarity, shared tags, heading overlap. */
function findInferredRelationships(
  skills: Skill[],
  verified: LandscapeRelationship[],
  termFreqs: Map<string, Map<string, number>>,
): LandscapeRelationship[] {
  const verifiedPairs = new Set(verified.map((r) => [r.source, r.target].sort().join('|')));
  const rels: LandscapeRelationship[] = [];

  for (let i = 0; i < skills.length; i++) {
    for (let j = i + 1; j < skills.length; j++) {
      const a = skills[i];
      const b = skills[j];
      const pairKey = [a.id, b.id].sort().join('|');
      if (verifiedPairs.has(pairKey)) continue;

      const tfA = termFreqs.get(a.id)!;
      const tfB = termFreqs.get(b.id)!;
      const sim = cosineSimilarity(tfA, tfB);

      // Shared tags
      const sharedTags = a.tags.filter((t) => b.tags.includes(t));

      // Shared headings
      const headingsA = new Set(extractHeadings(a.content).map((h) => h.toLowerCase()));
      const headingsB = new Set(extractHeadings(b.content).map((h) => h.toLowerCase()));
      const sharedHeadings = [...headingsA].filter((h) => headingsB.has(h));

      // Conflict detection: same headings but divergent keywords
      const aTerms = topTerms(tfA, 15);
      const bTerms = topTerms(tfB, 15);
      const sharedTerms = aTerms.filter((t) => bTerms.includes(t));
      const uniqueTermsA = aTerms.filter((t) => !bTerms.includes(t));
      const uniqueTermsB = bTerms.filter((t) => !aTerms.includes(t));

      // High similarity + many shared headings + significant unique terms → potential overlap or conflict
      if (sim > 0.15 || sharedTags.length > 0) {
        let kind: LandscapeKind = 'complement';
        let reason = '';

        if (sim > 0.55 && sharedHeadings.length >= 2 && uniqueTermsA.length > 3 && uniqueTermsB.length > 3) {
          // Very similar but with divergent vocabularies → suggested conflict
          kind = 'conflict';
          reason = `Suggested conflict: high content similarity (${Math.round(sim * 100)}%) with shared structure but divergent terminology. These skills may give contradictory guidance — review to confirm.`;
        } else if (sim > 0.4 && sharedHeadings.length >= 2) {
          kind = 'overlap';
          reason = `Suggested overlap: significant content similarity (${Math.round(sim * 100)}%). Both skills appear to cover similar ground${sharedHeadings.length ? ` in sections like "${sharedHeadings.slice(0, 2).join('", "')}"` : ''} — review whether this is redundant or complementary.`;
        } else if (sharedTags.length > 0 && sim < 0.3) {
          kind = 'complement';
          reason = `Suggested complement: shares tag(s) ${sharedTags.join(', ')}. Different focus but possibly related domain.`;
        } else {
          kind = 'complement';
          reason = `Suggested complement: related content (${Math.round(sim * 100)}% similarity). These skills may work together in adjacent responsibilities.`;
        }

        const confidence = Math.min(1, Math.max(sim, sharedTags.length * 0.15));
        rels.push({
          id: `inf-${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          kind,
          trust: 'inferred',
          reason,
          confidence,
        });
      }

      // Shared heading sections with different content → handoff
      if (sim < 0.25 && sharedHeadings.length >= 1 && sharedTerms.length >= 2) {
        rels.push({
          id: `inf-hnd-${a.id}-${b.id}`,
          source: a.id,
          target: b.id,
          kind: 'handoff',
          trust: 'inferred',
          reason: `Suggested handoff: addresses similar sections ("${sharedHeadings[0]}") with different vocabulary. One may feed into the other — review to confirm.`,
          confidence: 0.4,
        });
      }
    }
  }

  // Sort by confidence and limit per skill to avoid clutter
  rels.sort((a, b) => b.confidence - a.confidence);
  const perSkillLimit = new Map<string, number>();
  const filtered: LandscapeRelationship[] = [];
  for (const r of rels) {
    const count = (perSkillLimit.get(r.source) ?? 0) + (perSkillLimit.get(r.target) ?? 0);
    if (count < 8) {
      filtered.push(r);
      perSkillLimit.set(r.source, (perSkillLimit.get(r.source) ?? 0) + 1);
      perSkillLimit.set(r.target, (perSkillLimit.get(r.target) ?? 0) + 1);
    }
  }
  return filtered;
}

/** Manual relationships: user-defined edges from stacks. */
function findManualRelationships(skills: Skill[], manualEdges: ManualEdge[]): LandscapeRelationship[] {
  const skillIds = new Set(skills.map((s) => s.id));
  const kindMap: Record<string, LandscapeKind> = {
    depends: 'depends',
    handoff: 'handoff',
    policy: 'shared-policy',
    conflict: 'conflict',
  };
  const seen = new Set<string>();
  const rels: LandscapeRelationship[] = [];
  for (const e of manualEdges) {
    if (!skillIds.has(e.source) || !skillIds.has(e.target)) continue;
    const key = [e.source, e.target, e.kind].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    rels.push({
      id: `man-${e.source}-${e.target}-${e.kind}`,
      source: e.source,
      target: e.target,
      kind: kindMap[e.kind] ?? 'complement',
      trust: 'manual',
      reason: e.label ? `User-defined: ${e.label}` : 'User-defined relationship.',
      confidence: 1,
    });
  }
  return rels;
}

// ── Gap detection ──────────────────────────────────────────────────────

function detectGaps(skills: Skill[], areas: WorkArea[], memberships: Map<string, SkillAreaMembership[]>): Gap[] {
  const gaps: Gap[] = [];

  for (const area of areas) {
    // Area with only one weak member → gap
    const strongMembers = area.members.filter((m) => m.strength > 0.3);
    if (strongMembers.length === 0 && area.members.length > 0) {
      gaps.push({
        id: `gap-weak-${area.id}`,
        areaId: area.id,
        areaLabel: area.label,
        description: `Skills touch ${area.label.toLowerCase()} but none strongly own it. Consider a dedicated skill or clearer responsibility.`,
        relatedSkills: area.members.map((m) => m.skillId),
        severity: 'warning',
      });
    }

    // Area with many overlapping skills but no clear ownership → potential redundancy gap
    if (area.members.length >= 3) {
      const allStrong = area.members.every((m) => m.strength > 0.5);
      if (allStrong) {
        gaps.push({
          id: `gap-overlap-${area.id}`,
          areaId: area.id,
          areaLabel: area.label,
          description: `${area.members.length} skills cover ${area.label.toLowerCase()} with high overlap. Check for redundant or conflicting guidance.`,
          relatedSkills: area.members.map((m) => m.skillId),
          severity: 'info',
        });
      }
    }
  }

  // Check for skills with no area membership at all
  const unclassified = skills.filter((s) => !memberships.has(s.id) || memberships.get(s.id)!.length === 0);
  if (unclassified.length > 0) {
    gaps.push({
      id: 'gap-unclassified',
      areaId: 'none',
      areaLabel: 'Unclassified',
      description: `${unclassified.length} skill${unclassified.length === 1 ? '' : 's'} couldn't be mapped to a work area. Review their content or tags.`,
      relatedSkills: unclassified.map((s) => s.id),
      severity: 'info',
    });
  }

  return gaps;
}

// ── Main entry point ───────────────────────────────────────────────────

/**
 * Build a landscape from a set of skills and any user-defined edges.
 * The analysis is deterministic and runs entirely on skill content.
 */
export function buildLandscape(skills: Skill[], manualEdges: ManualEdge[] = []): Landscape {
  if (skills.length === 0) {
    return { areas: [], memberships: new Map(), relationships: [], gaps: [], unclassified: [] };
  }

  const { areas, memberships } = detectAreas(skills);

  // Precompute term frequencies
  const termFreqs = new Map<string, Map<string, number>>();
  for (const skill of skills) {
    termFreqs.set(skill.id, termFrequency(skillCorpus(skill)));
  }

  const verified = findVerifiedRelationships(skills);
  const inferred = findInferredRelationships(skills, verified, termFreqs);
  const manual = findManualRelationships(skills, manualEdges);

  // Merge, deduplicate by pair (verified > manual > inferred)
  const byPair = new Map<string, LandscapeRelationship>();
  const priority = { verified: 0, manual: 1, inferred: 2 };
  for (const r of [...verified, ...manual, ...inferred]) {
    const key = [r.source, r.target].sort().join('|');
    const existing = byPair.get(key);
    if (!existing || priority[r.trust] < priority[existing.trust]) {
      byPair.set(key, r);
    }
  }
  const relationships = [...byPair.values()].sort((a, b) => {
    const tp = priority[a.trust] - priority[b.trust];
    if (tp !== 0) return tp;
    return b.confidence - a.confidence;
  });

  const gaps = detectGaps(skills, areas, memberships);
  const unclassified = skills.filter((s) => !memberships.has(s.id) || memberships.get(s.id)!.length === 0).map((s) => s.id);

  return { areas, memberships, relationships, gaps, unclassified };
}

// ── Landscape metadata for display ─────────────────────────────────────

export const LANDSCAPE_KIND_META: Record<LandscapeKind, { label: string; verb: string; color: string; description: string }> = {
  complement: { label: 'Complements', verb: 'complements', color: 'var(--rel-handoff)', description: 'These skills address different but related responsibilities and work well together.' },
  overlap: { label: 'Overlaps', verb: 'overlaps with', color: 'var(--rel-policy)', description: 'These skills cover similar ground. Check for redundancy or clarify boundaries.' },
  conflict: { label: 'Conflicts', verb: 'conflicts with', color: 'var(--rel-conflict)', description: 'These skills may give contradictory guidance. A resolution rule is needed.' },
  depends: { label: 'Depends on', verb: 'depends on', color: 'var(--rel-depends)', description: 'One skill requires the other to be available first.' },
  handoff: { label: 'Hands off to', verb: 'hands off to', color: 'var(--rel-handoff)', description: 'One skill produces an artifact the other picks up.' },
  'shared-policy': { label: 'Shares policy', verb: 'shares policy with', color: 'var(--rel-policy)', description: 'Both skills are governed by the same standard.' },
};

export const TRUST_META: Record<TrustLevel, { label: string; description: string; cls: string }> = {
  verified: { label: 'Verified', description: 'Found an explicit reference in the skill content.', cls: 'text-ok border-ok/30 bg-ok/10' },
  inferred: { label: 'Inferred', description: 'Suggested from content similarity, tags, and structure. Not confirmed — review before relying on it.', cls: 'text-warn border-warn/30 bg-warn/10 border-dashed' },
  manual: { label: 'Manual', description: 'Defined by a user in a stack.', cls: 'text-info border-info/30 bg-info/10' },
};

/** Get all relationships involving a skill. */
export function relationshipsForSkill(landscape: Landscape, skillId: string): LandscapeRelationship[] {
  return landscape.relationships.filter((r) => r.source === skillId || r.target === skillId);
}

/** Get skills that share an area with the given skill. */
export function areaPeers(landscape: Landscape, skillId: string): string[] {
  const areas = landscape.memberships.get(skillId) ?? [];
  const areaIds = new Set(areas.map((a) => a.areaId));
  const peers = new Set<string>();
  for (const area of landscape.areas) {
    if (areaIds.has(area.id)) {
      for (const m of area.members) {
        if (m.skillId !== skillId) peers.add(m.skillId);
      }
    }
  }
  return [...peers];
}
