import { describe, expect, it } from 'vitest';
import { outcomeFor, passRate, simulateCriteria } from './evaluation';
import type { EvalRun } from './types';

const run = (results: boolean[]): EvalRun => ({
  id: 'r',
  scenarioId: 's',
  version: null,
  mode: 'manual',
  outcome: outcomeFor(results.map((passed) => ({ passed }))),
  results: results.map((passed, i) => ({ criterionId: String(i), passed })),
  notes: '',
  recordedAt: 0,
});

describe('evaluation', () => {
  it('derives an outcome from criterion results', () => {
    expect(outcomeFor([])).toBe('fail');
    expect(outcomeFor([{ passed: true }, { passed: true }])).toBe('pass');
    expect(outcomeFor([{ passed: true }, { passed: false }])).toBe('partial');
    expect(outcomeFor([{ passed: false }])).toBe('fail');
  });

  it('computes pass rate across all criteria of all runs', () => {
    expect(passRate([])).toBe(0);
    expect(passRate([run([true, false]), run([true, true])])).toBe(0.75);
  });

  it('simulates coverage from key terms in the instructions', () => {
    const criteria = [
      { id: 'a', text: 'Includes a rollback plan for the migration' },
      { id: 'b', text: 'Benchmarks latency against production traffic' },
    ];
    const results = simulateCriteria(criteria, 'Always write a rollback plan before running any migration.');
    expect(results.find((r) => r.criterionId === 'a')?.passed).toBe(true);
    expect(results.find((r) => r.criterionId === 'b')?.passed).toBe(false);
    expect(results.find((r) => r.criterionId === 'b')?.coverage).toBe(0);
  });
});
