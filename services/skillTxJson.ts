import JSON5 from 'json5';

/**
 * First top-level `{ ... }` in text, respecting double-quoted strings (so `{` inside strings is ignored).
 * Used when the model closes an empty ```json fence but pastes JSON below, or omits fences.
 */
export function extractFirstTopLevelJsonObject(text: string): string | null {
  const s = text;
  const start = s.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

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

/**
 * Inner text of the first ```json … ``` fence. Does not require valid JSON.
 * Tolerates spaces after backticks and `JSON` / `Json` (case-insensitive).
 */
export function extractFirstJsonFenceInnerRaw(text: string): string | null {
  const m = text.match(/```\s*json\s*([\s\S]*?)```/i);
  return m ? m[1] : null;
}

/** When the fence body is empty, JSON may appear immediately after the closing ``` or elsewhere in the reply. */
export function resolveJsonBodyFromAssistantResponse(full: string, fenceMatch: RegExpExecArray): string {
  let inner = fenceMatch[1].trim();
  if (inner.length > 0) return inner;
  const afterClose = full.slice(fenceMatch.index + fenceMatch[0].length);
  return extractFirstTopLevelJsonObject(afterClose) || extractFirstTopLevelJsonObject(full) || '';
}

/** Pretty-print for the Technical details &lt;pre&gt; when possible. */
export function formatSkillJsonForDisplay(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    try {
      return JSON.stringify(JSON5.parse(s), null, 2);
    } catch {
      return raw;
    }
  }
}
