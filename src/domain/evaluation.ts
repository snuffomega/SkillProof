import type { ContractItem, EvalRun, RunOutcome } from './types';

const STOP = new Set(['about', 'after', 'agent', 'should', 'would', 'could', 'their', 'there', 'these', 'those', 'which', 'while', 'where', 'every', 'least', 'without', 'within', 'being', 'other']);

export function outcomeFor(results: { passed: boolean }[]): RunOutcome {
  if (!results.length) return 'fail';
  const passed = results.filter((r) => r.passed).length;
  if (passed === results.length) return 'pass';
  return passed === 0 ? 'fail' : 'partial';
}

function keywords(text: string): string[] {
  return [...new Set(text.toLowerCase().match(/[a-z][a-z0-9-]{4,}/g) ?? [])].filter((w) => !STOP.has(w));
}

/**
 * Simulated run: a static coverage heuristic, NOT an agent execution.
 * A criterion "passes" when the instructions under test mention at least half of its key terms.
 */
export function simulateCriteria(criteria: ContractItem[], instructions: string): { criterionId: string; passed: boolean; coverage: number }[] {
  const haystack = instructions.toLowerCase();
  return criteria.map((c) => {
    const words = keywords(c.text);
    const hits = words.filter((w) => haystack.includes(w.replace(/s$/, ''))).length;
    const coverage = words.length ? hits / words.length : 0;
    return { criterionId: c.id, passed: coverage >= 0.5, coverage };
  });
}

export function passRate(runs: EvalRun[]): number {
  if (!runs.length) return 0;
  const total = runs.reduce((acc, r) => acc + r.results.length, 0);
  const passed = runs.reduce((acc, r) => acc + r.results.filter((x) => x.passed).length, 0);
  return total ? passed / total : 0;
}
