export type ID = string;

export interface SkillFile {
  path: string;
  content: string;
}

export type SkillSourceKind = 'manual' | 'file' | 'folder' | 'zip' | 'github' | 'bundle' | 'demo';

export interface Skill {
  id: ID;
  /** Cached from frontmatter for search and lookups. */
  name: string;
  description: string;
  content: string;
  files: SkillFile[];
  tags: string[];
  folder: string;
  source: { kind: SkillSourceKind; ref?: string };
  createdAt: number;
  updatedAt: number;
  publishedVersion: number | null;
  publishedHash: string | null;
}

export interface SkillVersion {
  id: ID;
  skillId: ID;
  version: number;
  name: string;
  description: string;
  content: string;
  files: SkillFile[];
  note: string;
  publishedAt: number;
}

export type RelationKind = 'depends' | 'handoff' | 'policy' | 'conflict';

export interface StackNode {
  id: ID;
  skillId: ID;
  position: { x: number; y: number };
  role: string;
}

export interface StackEdge {
  id: ID;
  source: ID;
  target: ID;
  kind: RelationKind;
  label: string;
  notes: string;
  /** Handoffs: the artifact passed downstream. Conflicts: how the conflict is resolved. */
  detail: string;
}

export interface ContractItem {
  id: ID;
  text: string;
}

export interface Checkpoint {
  id: ID;
  title: string;
  afterNodeId: ID | null;
  approver: string;
}

export interface RequiredOutput {
  id: ID;
  name: string;
  description: string;
  producedBy: ID | null;
}

export interface Contract {
  goals: ContractItem[];
  expectations: ContractItem[];
  standards: ContractItem[];
  checkpoints: Checkpoint[];
  outputs: RequiredOutput[];
}

export interface Stack {
  id: ID;
  name: string;
  description: string;
  nodes: StackNode[];
  edges: StackEdge[];
  contract: Contract;
  createdAt: number;
  updatedAt: number;
  publishedVersion: number | null;
  publishedHash: string | null;
}

export interface StackSnapshotSkill {
  skillId: ID;
  name: string;
  content: string;
  files: SkillFile[];
}

export interface StackVersion {
  id: ID;
  stackId: ID;
  version: number;
  name: string;
  description: string;
  nodes: StackNode[];
  edges: StackEdge[];
  contract: Contract;
  skills: StackSnapshotSkill[];
  note: string;
  publishedAt: number;
}

export type EvalTargetType = 'skill' | 'stack';

export interface Scenario {
  id: ID;
  targetType: EvalTargetType;
  targetId: ID;
  title: string;
  input: string;
  expected: string;
  criteria: ContractItem[];
  createdAt: number;
  updatedAt: number;
}

export type RunMode = 'manual' | 'simulated';
export type RunOutcome = 'pass' | 'partial' | 'fail';

export interface EvalRun {
  id: ID;
  scenarioId: ID;
  /** null = the working draft at the time of recording. */
  version: number | null;
  mode: RunMode;
  outcome: RunOutcome;
  results: { criterionId: ID; passed: boolean }[];
  notes: string;
  recordedAt: number;
}

export type Severity = 'error' | 'warning' | 'info';

export type IssueTarget =
  | { type: 'skill'; skillId: ID }
  | { type: 'node'; nodeId: ID; skillId?: ID }
  | { type: 'edge'; edgeId: ID }
  | { type: 'contract'; section: keyof Contract; itemId?: ID };

export interface Issue {
  id: string;
  code: string;
  severity: Severity;
  message: string;
  target: IssueTarget;
}

export type PublishStatus = 'draft' | 'published' | 'modified';

export const RELATION_KINDS: RelationKind[] = ['depends', 'handoff', 'policy', 'conflict'];

export const RELATION_META: Record<RelationKind, { label: string; verb: string; description: string }> = {
  depends: { label: 'Depends on', verb: 'depends on', description: 'Source requires the target skill to be available and applied first.' },
  handoff: { label: 'Hands off to', verb: 'hands off to', description: 'Source produces an artifact the target picks up and continues.' },
  policy: { label: 'Shares policy', verb: 'shares policy with', description: 'Both skills are governed by the same standard or constraint.' },
  conflict: { label: 'Conflicts with', verb: 'conflicts with', description: 'Instructions disagree. Needs an explicit resolution rule.' },
};

export function emptyContract(): Contract {
  return { goals: [], expectations: [], standards: [], checkpoints: [], outputs: [] };
}
