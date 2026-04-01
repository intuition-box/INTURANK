import JSON5 from 'json5';

/**
 * Parse JSON from Skill / LLM output. Strict JSON first; JSON5 handles common model mistakes
 * (unquoted keys, trailing commas, single-quoted strings) that break `JSON.parse`.
 */
export function parseSkillTxJsonBlock(raw: string): Record<string, unknown> {
  const s = raw.trim().replace(/^\uFEFF/, '');
  try {
    const v = JSON.parse(s) as unknown;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    throw new Error('JSON must be a single object');
  } catch {
    const v = JSON5.parse(s) as unknown;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
    throw new Error('JSON must be a single object');
  }
}
