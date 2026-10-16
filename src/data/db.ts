import Dexie, { type EntityTable } from 'dexie';
import type { EvalRun, Scenario, Skill, SkillVersion, Stack, StackVersion } from '@/domain/types';

export interface SettingRow {
  key: string;
  value: string;
}

export class SkillProofDB extends Dexie {
  skills!: EntityTable<Skill, 'id'>;
  skillVersions!: EntityTable<SkillVersion, 'id'>;
  stacks!: EntityTable<Stack, 'id'>;
  stackVersions!: EntityTable<StackVersion, 'id'>;
  scenarios!: EntityTable<Scenario, 'id'>;
  runs!: EntityTable<EvalRun, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor(name = 'skillproof') {
    super(name);
    this.version(1).stores({
      skills: 'id, name, folder, updatedAt, *tags',
      skillVersions: 'id, skillId, [skillId+version]',
      stacks: 'id, name, updatedAt',
      stackVersions: 'id, stackId, [stackId+version]',
      scenarios: 'id, [targetType+targetId], updatedAt',
      runs: 'id, scenarioId, recordedAt',
      settings: 'key',
    });
    const immutable = () => {
      throw new Error('Published snapshots are immutable.');
    };
    this.skillVersions.hook('updating', immutable);
    this.stackVersions.hook('updating', immutable);
  }
}
