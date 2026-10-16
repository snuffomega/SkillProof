import type {
  Contract,
  EvalRun,
  EvalTargetType,
  ID,
  Scenario,
  Skill,
  SkillFile,
  SkillSourceKind,
  SkillVersion,
  Stack,
  StackEdge,
  StackNode,
  StackVersion,
} from '@/domain/types';

export interface NewSkillInput {
  content: string;
  files?: SkillFile[];
  tags?: string[];
  folder?: string;
  source?: { kind: SkillSourceKind; ref?: string };
}

export type SkillPatch = Partial<Pick<Skill, 'content' | 'files' | 'tags' | 'folder'>>;

export interface NewStackInput {
  name: string;
  description?: string;
  nodes?: StackNode[];
  edges?: StackEdge[];
  contract?: Contract;
}

export type StackPatch = Partial<Pick<Stack, 'name' | 'description' | 'nodes' | 'edges' | 'contract'>>;

export type ScenarioInput = Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };
export type RunInput = Omit<EvalRun, 'id' | 'recordedAt'>;

export type SettingKey = 'githubToken' | 'seededAt';

/**
 * Storage contract for SkillProof. The UI depends only on this interface,
 * so a remote or file-system backed implementation can replace the IndexedDB one.
 */
export interface SkillProofRepository {
  listSkills(): Promise<Skill[]>;
  getSkill(id: ID): Promise<Skill | undefined>;
  createSkill(input: NewSkillInput): Promise<Skill>;
  updateSkill(id: ID, patch: SkillPatch): Promise<Skill>;
  deleteSkill(id: ID): Promise<void>;
  listSkillVersions(skillId: ID): Promise<SkillVersion[]>;
  publishSkill(id: ID, note: string): Promise<SkillVersion>;
  restoreSkillVersion(versionId: ID): Promise<Skill>;

  listStacks(): Promise<Stack[]>;
  getStack(id: ID): Promise<Stack | undefined>;
  createStack(input: NewStackInput): Promise<Stack>;
  updateStack(id: ID, patch: StackPatch): Promise<Stack>;
  duplicateStack(id: ID): Promise<Stack>;
  deleteStack(id: ID): Promise<void>;
  listStackVersions(stackId: ID): Promise<StackVersion[]>;
  publishStack(id: ID, note: string): Promise<StackVersion>;
  restoreStackVersion(versionId: ID): Promise<Stack>;

  listScenarios(target?: { type: EvalTargetType; id: ID }): Promise<Scenario[]>;
  saveScenario(input: ScenarioInput): Promise<Scenario>;
  deleteScenario(id: ID): Promise<void>;
  listRuns(scenarioId?: ID): Promise<EvalRun[]>;
  addRun(input: RunInput): Promise<EvalRun>;
  deleteRun(id: ID): Promise<void>;

  getSetting(key: SettingKey): Promise<string | undefined>;
  setSetting(key: SettingKey, value: string): Promise<void>;
  clearAll(): Promise<void>;
}

export class PublishBlockedError extends Error {
  constructor(public errorCount: number) {
    super(`Fix ${errorCount} validation error${errorCount === 1 ? '' : 's'} before publishing.`);
    this.name = 'PublishBlockedError';
  }
}
