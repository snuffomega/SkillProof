const yamlValue = (v: string) => (/: |#|^[\s"'[{>|*&!%@`]/.test(v) ? JSON.stringify(v) : v);
const md = (name: string, description: string, body: string) => `---\nname: ${name}\ndescription: ${yamlValue(description)}\n---\n\n${body.trim()}\n`;

export interface SeedSkill {
  key: string;
  folder: string;
  tags: string[];
  content: string;
  files?: { path: string; content: string }[];
  /** Earlier revisions to publish before the current content, oldest first. */
  history?: { content: string; note: string }[];
  publishCurrent?: string;
}

const codeReviewV1 = md(
  'code-review',
  'Review a pull request for correctness, security and maintainability before it is merged. Use when a PR is ready for review.',
  `
# Code Review

## When to use
- A pull request is marked ready for review.

## Expectations
- Every blocking problem is found before merge.
- Feedback is specific and actionable.

## Outputs
- A review comment summarizing findings.
`,
);

export const SEED_SKILLS: SeedSkill[] = [
  {
    key: 'spec-writing',
    folder: 'Engineering',
    tags: ['planning', 'product'],
    content: md(
      'spec-writing',
      'Turn a feature request or ticket into a reviewable technical spec with scope, acceptance criteria and open risks. Use before any implementation starts.',
      `
# Spec Writing

## When to use
- A ticket or request describes *what* is wanted but not *how we will know it is done*.
- Scope is ambiguous, spans multiple services, or touches user data.

## Expectations
- The spec is understandable by an engineer who has not seen the ticket.
- Every requirement is testable; vague words ("fast", "intuitive") are replaced with measurable targets.
- Out-of-scope items are listed explicitly so reviewers can push back early.

## Quality bar
- Acceptance criteria written as Given / When / Then.
- At least one risk and its mitigation is identified.
- Security-relevant changes follow the [security baseline](../security-baseline/SKILL.md).

## Outputs
- \`spec.md\` with: Summary, Goals, Non-goals, Acceptance criteria, Risks, Open questions.
`,
    ),
    publishCurrent: 'Initial spec format',
  },
  {
    key: 'code-review',
    folder: 'Engineering',
    tags: ['review', 'quality'],
    history: [{ content: codeReviewV1, note: 'First pass at review expectations' }],
    publishCurrent: 'Split blocking vs. non-blocking findings, require test evidence',
    content: md(
      'code-review',
      'Review a pull request for correctness, security, test coverage and maintainability before merge. Use when a PR is ready for review or a reviewer is requested.',
      `
# Code Review

## When to use
- A pull request is marked ready for review, or a re-review is requested after changes.

## Expectations
- Every blocking problem is found before merge; nothing ships that the reviewer would not defend.
- Feedback is specific: file, line, the problem, and a suggested direction.
- The reviewer verifies behaviour against the spec's acceptance criteria, not just the diff.

## Quality bar
- Findings are split into **Blocking** and **Non-blocking**.
- Security issues (injection, authz gaps, secret exposure) are always blocking and follow the [security baseline](../security-baseline/SKILL.md).
- Changed logic has test evidence that meets [test standards](../test-standards/SKILL.md).
- Tone is direct and respectful; no nitpicks presented as blockers.

## Outputs
- A review report: verdict (approve / request changes), blocking findings, non-blocking findings, test gaps.
`,
    ),
  },
  {
    key: 'test-standards',
    folder: 'Engineering',
    tags: ['quality', 'testing'],
    publishCurrent: 'Baseline testing standard',
    content: md(
      'test-standards',
      'Define the minimum automated test coverage and quality expected for any behavioural code change. Use when writing or reviewing tests.',
      `
# Test Standards

## Expectations
- Every behavioural change ships with a test that would fail without the change.
- Tests describe behaviour, not implementation; refactors should not break them.
- Flaky tests are treated as failures, never retried into green.

## Quality bar
- Happy path, one realistic failure path, and boundary values are covered.
- No network or wall-clock dependencies in unit tests.
- Test names read as sentences: \`rejects expired invitation tokens\`.

## Outputs
- Passing test suite and a one-line coverage note in the PR description.
`,
    ),
  },
  {
    key: 'security-baseline',
    folder: 'Shared',
    tags: ['security', 'policy'],
    publishCurrent: 'Adopt OWASP-aligned checklist',
    files: [
      {
        path: 'references/owasp-checklist.md',
        content: `# OWASP-aligned checklist\n\n- [ ] Input is validated at trust boundaries\n- [ ] Queries are parameterized\n- [ ] Authorization is checked server-side for every object access\n- [ ] Secrets never appear in code, logs, or client bundles\n- [ ] Errors returned to users are generic\n`,
      },
    ],
    content: md(
      'security-baseline',
      'Shared security policy every engineering skill must honour: input validation, authorization, secret handling and safe error reporting.',
      `
# Security Baseline

This is a **policy skill**. Other skills reference it rather than restating it.

## Non-negotiables
- Treat all external input as hostile until validated.
- Enforce authorization on the server for every read and write.
- Never log, commit, or expose secrets or personal data.
- Return generic error messages to end users; keep detail in server logs.

## How to apply
Work through the [OWASP-aligned checklist](references/owasp-checklist.md) for any change that touches input handling, data access or authentication.

## Outputs
- A short security note in the spec or review stating which checklist items apply.
`,
    ),
  },
  {
    key: 'release-notes',
    folder: 'Engineering',
    tags: ['communication', 'release'],
    content: md(
      'release-notes',
      'Write user-facing release notes from merged pull requests, grouped by impact and free of internal jargon. Use when preparing a release.',
      `
# Release Notes

## Expectations
- Notes are written for end users, not engineers: describe the benefit, not the ticket.
- Breaking changes and required actions appear first.
- Every entry traces back to a merged PR that passed [code review](../code-review/SKILL.md).

## Quality bar
- Follows the structure in the [changelog template](templates/changelog.md).
- No internal codenames, ticket IDs, or stack traces.

## Outputs
- \`RELEASE_NOTES.md\` section for the version, plus a two-sentence summary for the announcement.
`,
    ),
  },
  {
    key: 'rapid-prototyping',
    folder: 'Engineering',
    tags: ['speed', 'exploration'],
    content: md(
      'rapid-prototyping',
      'Build a throwaway prototype as fast as possible to validate an idea with users. Use for spikes and demos, never for production code.',
      `
# Rapid Prototyping

## Expectations
- Working demo within a single session; polish is explicitly out of scope.
- Skip automated tests and abstractions; hard-code where it saves time.
- Capture what was learned, then delete or rewrite the code.

## Outputs
- A runnable demo and a short "what we learned" note.
`,
    ),
  },
  {
    key: 'topic-research',
    folder: 'Content',
    tags: ['research', 'writing'],
    publishCurrent: 'Research brief format',
    content: md(
      'topic-research',
      'Research a content topic and produce a sourced brief with audience, key questions, angles and credible references. Use before drafting any long-form piece.',
      `
# Topic Research

## Expectations
- The brief makes the writer faster, not just better informed.
- Claims are traceable to credible, recent sources (prefer primary sources and data).
- The audience's actual questions drive the angle, not keyword volume alone.

## Quality bar
- At least five sources, each with a one-line note on why it matters.
- Contradictory evidence is surfaced, not hidden.

## Outputs
- \`brief.md\`: audience, core question, three candidate angles, source list, open questions.
`,
    ),
  },
  {
    key: 'longform-drafting',
    folder: 'Content',
    tags: ['writing'],
    publishCurrent: 'Drafting expectations',
    content: md(
      'longform-drafting',
      'Draft a long-form article from an approved research brief, following the brand voice and structuring for skimmability. Use after a brief is approved.',
      `
# Long-form Drafting

## Expectations
- The draft answers the brief's core question within the first two paragraphs.
- Structure supports skimming: descriptive headings, short paragraphs, one idea per section.
- Voice follows the [brand voice guide](../brand-voice/SKILL.md).

## Quality bar
- Every factual claim links to a source from the brief.
- No section exceeds roughly 300 words without a subheading or visual break.

## Outputs
- \`draft.md\` with title options, the article, and a list of claims needing verification.
`,
    ),
  },
  {
    key: 'brand-voice',
    folder: 'Shared',
    tags: ['policy', 'writing'],
    history: [
      {
        content: md(
          'brand-voice',
          'Shared writing policy describing the brand voice: clear, warm, specific and confident without hype.',
          `
# Brand Voice

## Principles
- Clear over clever.
- Warm, never cute.

## Outputs
- Copy that reads like the same person wrote it.
`,
        ),
        note: 'First voice principles',
      },
    ],
    publishCurrent: 'Add banned phrases and examples',
    content: md(
      'brand-voice',
      'Shared writing policy describing the brand voice: clear, warm, specific and confident without hype. Apply to any customer-facing text.',
      `
# Brand Voice

This is a **policy skill** shared by every writing workflow.

## Principles
- **Clear over clever.** If a sentence needs rereading, rewrite it.
- **Warm, never cute.** Talk like a knowledgeable colleague.
- **Specific.** Prefer numbers, names and examples to adjectives.
- **Confident without hype.** No "revolutionary", "game-changing", or "best-in-class".

## Quality bar
- Average sentence under 20 words.
- Active voice by default.
- Jargon is either removed or explained in the same sentence.

## Outputs
- Copy that reads as if one thoughtful person wrote all of it.
`,
    ),
  },
  {
    key: 'editorial-review',
    folder: 'Content',
    tags: ['review', 'writing'],
    publishCurrent: 'Editorial checklist',
    content: md(
      'editorial-review',
      'Review a draft for accuracy, structure, voice and legal risk before publication, returning a clear verdict. Use when a draft is submitted for approval.',
      `
# Editorial Review

## Expectations
- The reviewer is the last line of defence for accuracy and tone.
- Feedback distinguishes must-fix issues from suggestions.
- Claims without a source are flagged, never silently removed.

## Quality bar
- Checks the draft against the brand voice policy.
- Confirms headline promises are delivered in the body.
- Flags any statement with legal or reputational risk.

## Outputs
- A verdict (approve / revise) with numbered must-fix items and optional suggestions.
`,
    ),
  },
  {
    key: 'seo-metadata',
    folder: 'Content',
    tags: ['seo', 'publishing'],
    publishCurrent: 'Metadata spec',
    content: md(
      'seo-metadata',
      'Produce search and social metadata for an approved article: title tag, meta description, slug and Open Graph copy. Use right before publishing.',
      `
# SEO Metadata

## Expectations
- Metadata accurately represents the article; no clickbait.
- Optimizes for the reader's search intent identified in the research brief.

## Quality bar
- Title tag 50-60 characters; meta description 140-160 characters.
- Slug is short, lowercase, hyphenated, and stable.

## Outputs
- \`metadata.json\` with title, description, slug, og:title, og:description.
`,
    ),
  },
  {
    key: 'data-sourcing',
    folder: 'Analytics',
    tags: ['data'],
    content: md(
      'data-sourcing',
      'Pull and clean the datasets required for a recurring metrics report, documenting every source and transformation. Use at the start of each reporting cycle.',
      `
# Data Sourcing

## Expectations
- Every number in the final report can be traced back to a query or file.
- Data quality problems are reported, not patched over silently.

## Quality bar
- Row counts reconciled against the previous period (flag changes over 10%).
- Personally identifiable data is excluded or aggregated.

## Outputs
- Clean dataset (CSV) plus a data dictionary describing each column and its source.
`,
    ),
  },
  {
    key: 'metric-analysis',
    folder: 'Analytics',
    tags: ['data', 'analysis'],
    content: md(
      'metric-analysis',
      'Analyse weekly product metrics to explain what changed, why it likely changed, and how confident we are. Use after the data has been sourced and cleaned.',
      `
# Metric Analysis

## Expectations
- Lead with what changed and whether it matters, before how it was calculated.
- Separate observed facts from hypotheses and state confidence for each.
- Charts follow the [chart standards](../chart-standards/SKILL.md).

## Quality bar
- Week-over-week and four-week trend for every headline metric.
- At least one alternative explanation considered for each notable change.

## Outputs
- A findings table: metric, change, likely driver, confidence, recommended follow-up.
`,
    ),
  },
  {
    key: 'chart-standards',
    folder: 'Analytics',
    tags: ['data', 'policy'],
    content: md(
      'chart-standards',
      'Shared standards for charts in reports: honest axes, clear labelling, accessible colour and one message per chart.',
      `
# Chart Standards

## Rules
- Bar charts start at zero; line charts may not, but must say so.
- Every chart has a title that states the takeaway, not just the metric.
- Colour is never the only carrier of meaning; use labels or patterns too.
- One message per chart.

## Outputs
- Charts that a stakeholder can read correctly in five seconds.
`,
    ),
  },
  {
    key: 'executive-summary',
    folder: 'Analytics',
    tags: ['communication'],
    content: md(
      'executive-summary',
      'Condense analysis findings into a one-page executive summary with decisions needed, risks and recommended actions.',
      `
# Executive Summary

## Expectations
- A busy leader can act after reading only the first three bullet points.
- Decisions needed are explicit and have an owner and a date.
- Language follows the brand voice: specific, calm, no hype.

## Outputs
- One page: headline, three key findings, decisions needed, risks, appendix links.
`,
    ),
  },
];

type EdgeSeed = [from: string, kind: 'depends' | 'handoff' | 'policy' | 'conflict', to: string, label: string, detail: string, notes?: string];

export interface SeedStack {
  name: string;
  description: string;
  skills: { key: string; role: string }[];
  edges: EdgeSeed[];
  goals: string[];
  expectations: string[];
  standards: string[];
  checkpoints: { title: string; after: string | null; approver: string }[];
  outputs: { name: string; description: string; by: string | null }[];
  publish?: string;
  afterPublishGoal?: string;
}

export const SEED_STACKS: SeedStack[] = [
  {
    name: 'Ship a Feature',
    description: 'From ticket to release notes: spec, review against shared standards, and communicate the change to users.',
    skills: [
      { key: 'spec-writing', role: 'Planner' },
      { key: 'code-review', role: 'Reviewer' },
      { key: 'test-standards', role: 'Standard' },
      { key: 'security-baseline', role: 'Policy' },
      { key: 'release-notes', role: 'Communicator' },
      { key: 'rapid-prototyping', role: 'Optional spike' },
    ],
    edges: [
      ['spec-writing', 'handoff', 'code-review', 'Approved spec', 'spec.md with acceptance criteria'],
      ['code-review', 'depends', 'test-standards', 'Test evidence', ''],
      ['code-review', 'policy', 'security-baseline', 'Secure coding baseline', ''],
      ['spec-writing', 'policy', 'security-baseline', 'Secure coding baseline', ''],
      ['code-review', 'handoff', 'release-notes', 'Merged PRs', 'List of merged PRs with review verdicts'],
      ['rapid-prototyping', 'conflict', 'test-standards', 'Skipping tests', '', 'Prototyping says skip tests; test standards say every change needs one.'],
    ],
    goals: ['Ship the requested feature with no blocking defects reaching users.', 'Keep reviewers and users informed at every stage.'],
    expectations: ['Agents choose their own implementation approach within the approved spec.', 'Any scope change is raised before it is built, not after.'],
    standards: ['Security baseline applies to every change touching input or data access.', 'Every behavioural change has a failing-then-passing test.'],
    checkpoints: [
      { title: 'Spec approval', after: 'spec-writing', approver: 'Product lead' },
      { title: 'Release sign-off', after: 'release-notes', approver: 'Engineering manager' },
    ],
    outputs: [
      { name: 'Approved spec', description: 'spec.md signed off by the product lead', by: 'spec-writing' },
      { name: 'Review report', description: 'Verdict with blocking and non-blocking findings', by: 'code-review' },
      { name: 'Release notes', description: 'User-facing notes for the version', by: 'release-notes' },
    ],
  },
  {
    name: 'Content Pipeline',
    description: 'Research, draft, review and publish long-form articles in a consistent brand voice.',
    skills: [
      { key: 'topic-research', role: 'Researcher' },
      { key: 'longform-drafting', role: 'Writer' },
      { key: 'brand-voice', role: 'Policy' },
      { key: 'editorial-review', role: 'Editor' },
      { key: 'seo-metadata', role: 'Publisher' },
    ],
    edges: [
      ['topic-research', 'handoff', 'longform-drafting', 'Research brief', 'brief.md with sources and angles'],
      ['longform-drafting', 'depends', 'brand-voice', 'Voice rules', ''],
      ['editorial-review', 'policy', 'brand-voice', 'Brand voice guide', ''],
      ['longform-drafting', 'handoff', 'editorial-review', 'Draft', 'draft.md plus claims needing verification'],
      ['editorial-review', 'handoff', 'seo-metadata', 'Approved article', 'Final article Markdown'],
    ],
    goals: ['Publish articles that answer a real audience question better than existing sources.'],
    expectations: ['Writers may restructure the brief’s angle if research supports it.', 'Every claim is sourced before editorial review.'],
    standards: ['Brand voice applied to all customer-facing text.', 'No unverified statistics are published.'],
    checkpoints: [{ title: 'Editorial approval', after: 'editorial-review', approver: 'Managing editor' }],
    outputs: [
      { name: 'Research brief', description: 'Sourced brief with angles', by: 'topic-research' },
      { name: 'Approved article', description: 'Final Markdown signed off by the editor', by: 'editorial-review' },
      { name: 'Search metadata', description: 'metadata.json for the CMS', by: 'seo-metadata' },
    ],
    publish: 'Initial pipeline',
    afterPublishGoal: 'Grow returning readers by publishing at least two articles per month.',
  },
  {
    name: 'Weekly Metrics Report',
    description: 'Source data, analyse movement in product metrics, and brief leadership with a one-page summary.',
    skills: [
      { key: 'data-sourcing', role: 'Data engineer' },
      { key: 'metric-analysis', role: 'Analyst' },
      { key: 'chart-standards', role: 'Policy' },
      { key: 'executive-summary', role: 'Communicator' },
      { key: 'brand-voice', role: 'Policy' },
    ],
    edges: [
      ['data-sourcing', 'handoff', 'metric-analysis', 'Clean dataset', 'CSV plus data dictionary'],
      ['metric-analysis', 'depends', 'chart-standards', 'Chart rules', ''],
      ['metric-analysis', 'handoff', 'executive-summary', 'Findings', 'Findings table with confidence levels'],
      ['executive-summary', 'policy', 'brand-voice', 'Brand voice guide', ''],
    ],
    goals: ['Give leadership an accurate, decision-ready view of the week in under five minutes of reading.'],
    expectations: ['Analysts decide which metrics deserve deeper investigation each week.'],
    standards: ['Every number is traceable to a source query.', 'Charts follow the shared chart standards.'],
    checkpoints: [{ title: 'Analyst sanity check', after: 'metric-analysis', approver: 'Head of data' }],
    outputs: [
      { name: 'Executive summary', description: 'One-page brief for leadership', by: 'executive-summary' },
      { name: 'Data appendix', description: 'Queries and dataset links backing every number', by: null },
    ],
  },
];

export const SEED_SCENARIOS = [
  {
    target: { type: 'skill' as const, key: 'code-review' },
    title: 'PR introduces an injectable SQL query',
    input: 'A PR adds a search endpoint that builds a SQL query by concatenating the user-supplied `q` parameter. Tests cover only the happy path.',
    expected: 'Review requests changes, flags the injection as blocking, and calls out the missing failure-path test.',
    criteria: [
      'Flags the SQL injection as a blocking finding',
      'Cites the exact file and line of the problem',
      'Suggests a parameterized query as the fix direction',
      'Notes missing test coverage for the failure path',
    ],
    runs: [
      { version: 1, passed: [true, true, false, false], notes: 'Found the injection but treated it as a suggestion; no mention of tests.' },
      { version: 2, passed: [true, true, true, true], notes: 'Blocking/non-blocking split made the verdict unambiguous.' },
    ],
  },
  {
    target: { type: 'skill' as const, key: 'brand-voice' },
    title: 'Rewrite a hype-heavy announcement',
    input: 'Rewrite: "Our revolutionary, best-in-class platform leverages synergies to deliver game-changing outcomes."',
    expected: 'A plain, specific sentence with no banned phrases.',
    criteria: ['Removes every banned hype phrase', 'Replaces adjectives with a concrete benefit', 'Keeps the sentence under 20 words'],
    runs: [
      { version: 1, passed: [false, true, true], notes: 'Kept "game-changing"; v1 had no banned list.' },
      { version: 2, passed: [true, true, true], notes: '' },
    ],
  },
  {
    target: { type: 'stack' as const, key: 'Ship a Feature' },
    title: 'Small feature from ticket to release',
    input: 'Ticket: "Let users export their invoices as CSV from the billing page."',
    expected: 'An approved spec, a review report with security notes on data access, and user-facing release notes.',
    criteria: [
      'Spec includes acceptance criteria in Given / When / Then form',
      'Review report separates blocking and non-blocking findings',
      'Authorization on invoice access is checked in the review',
      'Release notes describe the user benefit without ticket IDs',
    ],
    runs: [{ version: null, simulate: true, notes: 'Static coverage check against the current draft instructions.' }],
  },
  {
    target: { type: 'stack' as const, key: 'Content Pipeline' },
    title: 'Article on remote onboarding',
    input: 'Topic: "How to onboard remote engineers in their first 30 days."',
    expected: 'Sourced brief, on-voice draft, editorial verdict, and metadata within length limits.',
    criteria: ['Brief lists at least five credible sources', 'Draft answers the core question in the first two paragraphs', 'Editorial verdict lists numbered must-fix items', 'Meta description is 140-160 characters'],
    runs: [{ version: 1, passed: [true, true, false, true], notes: 'Editor returned prose feedback instead of a numbered list.' }],
  },
];
