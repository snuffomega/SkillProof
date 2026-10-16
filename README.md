# SkillProof

A local-first studio for understanding how AI agent skills (`SKILL.md`, Agent Skills compatible) fit together — not for editing individual skills or manually constructing workflows.

Connect an existing skill repository and see how its skills collectively organize the work: areas of responsibility, overlaps, conflicts, gaps, and relationships — without manually rebuilding the landscape. Skills are treated as SOPs and organizational knowledge, not rigid instructions telling an agent how to perform.

Everything runs in the browser. Data lives in IndexedDB; there is no server, account, or paid API.

## Getting started

```bash
npm install
npm run dev        # start the app
npm test           # run the Vitest suite
npm run typecheck  # strict TypeScript check
npm run build      # typecheck + production build
```

On first launch a demo workspace is seeded: interconnected skills, three stacks, published history, and evaluation runs. Some issues in it are deliberate so the validation views have something to show. You can restore or clear it under **Settings**.

## Features

| Area | What you can do |
| --- | --- |
| **Skill Landscape** (primary) | A responsibility map that automatically organizes imported skills into work areas, detects relationships (verified, inferred, manual), reveals overlaps and gaps, and lets you explore from the high-level map down to individual skill sections and source files. |
| **Import** | Files, folders, ZIPs, public GitHub repos/sub-folders (optional token in Settings), and SkillProof stack bundles. Preview, pick, and choose a duplicate strategy (keep, overwrite, copy). |
| **Library** (supporting) | Create, edit (write / split / preview), tag, folder, search and filter skills. Manage attached files. Export one skill or a folder ZIP. |
| **Stacks** (supporting) | Compose skills into stacks with a React Flow canvas: four relationship kinds, inspector, auto layout, undo/redo. Workflow contracts define what done means. |
| **Validation** | Frontmatter/spec structure, broken file links, missing skills, dependency cycles, conflicts without resolution, incomplete contracts. Errors block publishing. |
| **Evaluation** | Scenarios with criteria, manually recorded outcomes per revision, a clearly labeled simulated coverage check, and per-revision pass-rate comparison. |
| **Versioning** | Editable drafts; publishing creates an immutable snapshot. History, restore-to-draft, and side-by-side diffs. |
| **Distribution** | Export a stack as a portable bundle, re-import it anywhere. |

Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> for the command palette.

## Architecture

```
src/
  domain/     Pure logic, no I/O: types, SKILL.md parsing, validation, graph algorithms,
              hashing & diffs, bundle format, importers, evaluation heuristics,
              landscape analysis (work area detection, relationship inference).
  data/       Storage. `repository.ts` is the typed interface; `dexie-repository.ts`
              implements it on IndexedDB; `hooks.tsx` exposes live queries to React,
              including `useLandscape` which builds the landscape from skill content.
  services/   Orchestration over the repository: imports, GitHub fetching, file reading.
  store/      Zustand UI state only (route, theme, dialogs, graph focus). No domain data.
  features/   UI per area: landscape (map, areas, relationships, gaps), library, stacks,
              evals, import, settings, versions, shell.
  components/ Shared UI primitives (shadcn/ui) and app-wide building blocks.
```

The UI talks to storage only through `SkillProofRepository`, provided via `RepositoryProvider`.

### Swapping storage

Implement `SkillProofRepository` (for example against a REST API or the filesystem) and pass it in `src/main.tsx`:

```tsx
<RepositoryProvider repository={createMyRepository()}>
```

The live-query hooks in `data/hooks.tsx` currently use Dexie's `useLiveQuery`. A different backend should provide equivalent hooks (e.g. with polling or subscriptions) under the same names.

### Draft vs. published

Each skill/stack stores `publishedVersion` and `publishedHash`. Status is derived by hashing the current draft (stack hashes ignore node positions) and comparing it with the last published hash: *Draft* (never published), *Edited*, or *Published*. Published snapshots are write-once; the database layer rejects modifications.

## Stack bundle format

A bundle is a ZIP:

```
skillproof.json            manifest (format: "skillproof.stack", formatVersion: 1)
skills/<dir>/SKILL.md      original Markdown, untouched
skills/<dir>/<files...>    attached files
```

`skillproof.json` holds the stack name, description, nodes (referencing skills by `dir`, with role and position), edges (kind, label, detail, notes), the full contract, and per-skill tags/folder. It is validated with Zod on import. Unknown skill folders or malformed manifests produce a clear error instead of a partial import.

## Real vs. simulated evaluation

- **Real checks**: validation is deterministic and runs on the actual content. It's labeled *Real check*.
- **Recorded**: you run the scenario with your own agent, then mark which criteria were met. These are the outcomes that matter.
- **Simulated**: a static keyword-coverage heuristic. A criterion "passes" when the instructions at a revision mention at least half its key terms. **No agent is executed.** It's labeled *Simulated* everywhere and charted separately.

## Landscape analysis

The Skill Landscape is built entirely from skill content — no manual setup required.

**Work areas** are detected by matching skill content, tags, and folder names against a keyword catalog spanning security, code quality, deployment, incident response, data, frontend, documentation, APIs, version control, and project process. Skills can belong to multiple areas with a membership strength score.

**Relationships** have three trust levels:
- **Verified**: found via explicit markdown links or shared file references between skills. These are confirmed connections.
- **Inferred**: detected from content similarity (cosine TF), shared tags, and heading overlap. Each carries a confidence score and a human-readable reason. They are clearly marked as suggestions, not facts.
- **Manual**: user-defined edges from stacks. These are the connections a user explicitly drew.

**Gaps** are detected automatically: areas with only weak membership, areas with excessive overlap, and skills that can't be mapped to any area.

Relationships do not imply a fixed execution sequence. A skill that complements another may run before, after, or alongside it — the landscape describes how skills relate, not how to order them.

## Tests

`npm test` covers SKILL.md parsing, validation rules, hashing/diffing, bundle round-trips, evaluation logic and the repository (against `fake-indexeddb`), including immutability of published snapshots and bundle import into an empty workspace.
