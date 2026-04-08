#!/usr/bin/env bash
# Re-download upstream Intuition skill markdown into services/intuition-skill/
# Source: https://github.com/0xIntuition/agent-skills/tree/main/skills/intuition
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT/services/intuition-skill"
UP="https://raw.githubusercontent.com/0xIntuition/agent-skills/main/skills/intuition"
mkdir -p "$BASE/reference" "$BASE/operations"
for f in \
  SKILL.md README.md \
  reference/autonomous-policy.md reference/graphql-queries.md reference/reading-state.md \
  reference/schemas.md reference/simulation.md reference/workflows.md \
  operations/batch-deposit.md operations/batch-redeem.md operations/create-atoms.md \
  operations/create-triples.md operations/deposit.md operations/redeem.md; do
  echo "Fetching $f"
  curl -sL "$UP/$f" -o "$BASE/$f"
done
echo "Done. Run npm run build to verify."
