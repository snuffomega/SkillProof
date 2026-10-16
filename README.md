# SkillProof

A local-first studio for designing, validating, evaluating and shipping AI agent skills (`SKILL.md`, Agent Skills compatible) and the stacks they form.

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
| **Library** | Create, edit (write / split / preview), tag, foldering, search and filter skills. Manage attached files (`references/`, `scripts/`, …). Export one skill as `SKILL.md` or a folder ZIP. |
| **Import** | Files, folders, ZIPs, public GitHub repos/sub-folders (optional token in Settings), and SkillProof stack bundles. Preview, pick, and choose a duplicate strategy (keep, overwrite, copy). |
| **Stack builder** | React Flow canvas with drag-from-palette, four relationship kinds (*depends on*, *hands off to*, *shares policy with*, *conflicts with*), inspector, auto layout, undo/redo, keyboard shortcuts. |
| **Workflow contract** | Goals, expectations, quality standards, approval checkpoints (tied to a node + approver) and required outputs (tied to a producing node). It defines *what* done means, never *how* agents work. |
| **Validation** | Frontmatter/spec structure, broken file links, missing skills, dependency cycles, conflicts without a resolution rule, handoffs that don't name their artifact, incomplete contracts. Errors block publishing. |
| **Evaluation** | Scenarios with criteria, manually recorded outcomes per revision, a clearly labeled simulated coverage check, and per-revision pass-rate comparison. |
| **Versioning** | Drafts are editable; publishing creates an immutable snapshot (`v1`, `v2`, …). History, restore-to-draft, and side-by-side diffs for skills and stacks. |
| **Distribution** | Export a stack as a portable bundle, re-import it anywhere. |

Press <kbd>⌘K</kbd> / <kbd>Ctrl K</kbd> for the command palette.

## Architecture

```
src/
  domain/     Pure logic, no I/O: types, SKILL.md parsing, validation, graph algorithms,
              hashing & diffs, bundle format, importers, evaluation heuristics.
  data/       Storage. `repository.ts` is the typed interface; `dexie-repository.ts`
              implements it on IndexedDB; `hooks.tsx` exposes live queries to React.
  services/   Orchestration over the repository: imports, GitHub fetching, file reading.
  store/      Zustand UI state only (route, theme, dialogs, graph focus). No domain data.
  features/   UI per area: library, stacks (+ graph), evals, import, settings, versions, shell.
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

## Tests

`npm test` covers SKILL.md parsing, validation rules, hashing/diffing, bundle round-trips, evaluation logic and the repository (against `fake-indexeddb`), including immutability of published snapshots and bundle import into an empty workspace.
