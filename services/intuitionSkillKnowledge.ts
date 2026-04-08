/**
 * Full upstream Intuition skill corpus (0xIntuition/agent-skills, skills/intuition).
 * Update by replacing files under ./intuition-skill/ from main branch.
 * @see https://github.com/0xIntuition/agent-skills/tree/main/skills/intuition
 */
import skillReadme from './intuition-skill/README.md?raw';
import skillMain from './intuition-skill/SKILL.md?raw';
import refAutonomousPolicy from './intuition-skill/reference/autonomous-policy.md?raw';
import refGraphqlQueries from './intuition-skill/reference/graphql-queries.md?raw';
import refReadingState from './intuition-skill/reference/reading-state.md?raw';
import refSchemas from './intuition-skill/reference/schemas.md?raw';
import refSimulation from './intuition-skill/reference/simulation.md?raw';
import refWorkflows from './intuition-skill/reference/workflows.md?raw';
import opBatchDeposit from './intuition-skill/operations/batch-deposit.md?raw';
import opBatchRedeem from './intuition-skill/operations/batch-redeem.md?raw';
import opCreateAtoms from './intuition-skill/operations/create-atoms.md?raw';
import opCreateTriples from './intuition-skill/operations/create-triples.md?raw';
import opDeposit from './intuition-skill/operations/deposit.md?raw';
import opRedeem from './intuition-skill/operations/redeem.md?raw';

const sections: string[] = [
  '# Upstream: README.md\n\n' + skillReadme,
  '# Upstream: SKILL.md\n\n' + skillMain,
  '# Upstream: reference/autonomous-policy.md\n\n' + refAutonomousPolicy,
  '# Upstream: reference/graphql-queries.md\n\n' + refGraphqlQueries,
  '# Upstream: reference/reading-state.md\n\n' + refReadingState,
  '# Upstream: reference/schemas.md\n\n' + refSchemas,
  '# Upstream: reference/simulation.md\n\n' + refSimulation,
  '# Upstream: reference/workflows.md\n\n' + refWorkflows,
  '# Upstream: operations/batch-deposit.md\n\n' + opBatchDeposit,
  '# Upstream: operations/batch-redeem.md\n\n' + opBatchRedeem,
  '# Upstream: operations/create-atoms.md\n\n' + opCreateAtoms,
  '# Upstream: operations/create-triples.md\n\n' + opCreateTriples,
  '# Upstream: operations/deposit.md\n\n' + opDeposit,
  '# Upstream: operations/redeem.md\n\n' + opRedeem,
];

/** Verbatim upstream markdown; used as the Skill agent knowledge base. */
export const INTUITION_SKILL_KNOWLEDGE_CORPUS = sections.join('\n\n---\n\n');
