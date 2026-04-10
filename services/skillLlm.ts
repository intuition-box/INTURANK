import { GoogleGenAI } from '@google/genai';
import OpenAI from 'openai';
import {
  getGeminiApiKey,
  getOpenAiApiKey,
  getGroqApiKey,
  GEMINI_MODEL,
  OPENAI_MODEL,
  GROQ_MODEL,
  GROQ_BASE_URL,
} from '../constants';

export type LlmProviderId = 'groq' | 'gemini' | 'openai';

function extractErrorText(error: unknown): string {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object') {
    const e = error as Record<string, unknown>;
    if (typeof e.message === 'string') return e.message;
    const nested = e.error;
    if (nested && typeof nested === 'object' && nested !== null && 'message' in nested) {
      return String((nested as { message?: string }).message ?? '');
    }
  }
  return String(error ?? '');
}

function getErrorHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const e = error as Record<string, unknown>;
  if (typeof e.status === 'number' && Number.isFinite(e.status)) return e.status;
  if (typeof e.code === 'number' && (e.code === 403 || e.code === 401 || e.code === 429)) return e.code;
  const nested = e.error;
  if (nested && typeof nested === 'object') {
    const n = nested as { code?: number; status?: number };
    if (typeof n.code === 'number' && Number.isFinite(n.code)) return n.code;
    if (typeof n.status === 'number' && Number.isFinite(n.status)) return n.status;
  }
  return undefined;
}

/** True when a second provider might help (quota, rate, overload). */
export function isRetryableLlmError(error: unknown): boolean {
  const raw = extractErrorText(error).toLowerCase();
  const status = getErrorHttpStatus(error);
  if (status === 429) return true;
  return (
    /429|quota|rate limit|resource exhausted|too many requests|insufficient_quota|billing|overloaded|capacity/i.test(raw) ||
    /try again later|temporarily unavailable/i.test(raw)
  );
}

/**
 * After any primary provider fails, try the next when failure is recoverable (quota, auth, 403, etc.).
 * @deprecated Use shouldFallbackAfterProviderFailure — same behavior, clearer name.
 */
export function shouldFallbackAfterGeminiFailure(error: unknown): boolean {
  return shouldFallbackAfterProviderFailure(error);
}

export function shouldFallbackAfterProviderFailure(error: unknown): boolean {
  if (isRetryableLlmError(error)) return true;
  const status = getErrorHttpStatus(error);
  if (status === 403 || status === 401) return true;
  const raw = extractErrorText(error).toLowerCase();
  if (
    /\b403\b|\b401\b|forbidden|permission denied|not allowed|blocked|leaked|revoked|invalid api key|api key.*invalid|does not have permission/i.test(
      raw
    )
  ) {
    return true;
  }
  try {
    const parsed = JSON.parse(extractErrorText(error)) as { error?: { code?: number } };
    const c = parsed?.error?.code;
    if (c === 403 || c === 401) return true;
  } catch {
    /* not JSON */
  }
  return false;
}

/** User-facing message for Skill chat failures (Groq / Gemini / OpenAI). */
export function formatSkillLlmError(error: unknown): string {
  const raw = extractErrorText(error);
  const lower = raw.toLowerCase();
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : NaN;

  if (status === 401 || lower.includes('invalid api key') || lower.includes('incorrect api key')) {
    return 'API key rejected. Check `VITE_GROQ_API_KEY`, `VITE_GEMINI_API_KEY`, or `VITE_OPENAI_API_KEY` in console settings.';
  }
  if (status === 429 || lower.includes('insufficient_quota') || lower.includes('billing')) {
    return 'AI quota or rate limit. Wait a bit, or check Groq, Google AI Studio, or OpenAI billing.';
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
    const m = parsed?.error?.message;
    if (m && typeof m === 'string') {
      if (parsed.error?.code === 403 || /leaked|invalid|revoked|permission/i.test(m)) {
        return (
          'API access denied (403). Check keys in your **deployment** env (rebuild required). Groq is primary; set `VITE_GROQ_API_KEY`, or `VITE_GEMINI_API_KEY` / `VITE_OPENAI_API_KEY` as fallbacks. Never commit keys.'
        );
      }
      return `Provider: ${m.slice(0, 280)}${m.length > 280 ? '…' : ''}`;
    }
  } catch {
    /* not JSON */
  }
  if (raw.includes('403') || lower.includes('leaked') || lower.includes('api key was reported')) {
    return (
      'API access denied. For production, set keys on the host and redeploy. Prefer `VITE_GROQ_API_KEY`; add Gemini/OpenAI as backups if needed.'
    );
  }
  if (lower.includes('429') || lower.includes('resource exhausted') || lower.includes('quota')) {
    return 'Rate limit or quota exceeded. If other keys are set, fallbacks run automatically.';
  }
  const short = raw.length > 320 ? raw.slice(0, 317) + '…' : raw;
  return `Request failed: ${short}`;
}

export type SkillChatHistoryItem = { role: 'user' | 'assistant'; content: string };

function extractGeminiResponseText(response: unknown): string {
  const r = response as {
    text?: string;
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const direct = typeof r.text === 'string' ? r.text.trim() : '';
  if (direct) return direct;
  const parts = r.candidates?.[0]?.content?.parts;
  if (!parts?.length) return '';
  return (
    parts
      .map((p) => (typeof p?.text === 'string' ? p.text : ''))
      .join('')
      .trim() || ''
  );
}

/**
 * Single user prompt (no system/history). Used by market summaries, Feed pulse, Compare.
 * Order: **Groq** → Gemini → OpenAI.
 */
export async function generateSimpleLlmCompletion(prompt: string): Promise<{ text: string; provider: LlmProviderId }> {
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
  const openaiKey = getOpenAiApiKey();

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [{ role: 'user', content: prompt }];

  const runGroq = async (): Promise<{ text: string; provider: 'groq' }> => {
    if (!groqKey) {
      throw new Error('No Groq API key. Set VITE_GROQ_API_KEY in .env.local (https://console.groq.com).');
    }
    const client = new OpenAI({
      apiKey: groqKey,
      baseURL: GROQ_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    return { text: text || 'No response from the model.', provider: 'groq' };
  };

  const runOpenAi = async (): Promise<{ text: string; provider: 'openai' }> => {
    if (!openaiKey) {
      throw new Error('No OpenAI API key. Set VITE_OPENAI_API_KEY in .env.local (from platform.openai.com — not the ChatGPT app subscription).');
    }
    const client = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    return { text: text || 'No response from the model.', provider: 'openai' };
  };

  const runGemini = async (): Promise<{ text: string; provider: 'gemini' }> => {
    if (!geminiKey) {
      throw new Error('No Gemini API key. Set VITE_GEMINI_API_KEY in .env.local.');
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });
    const responseText = extractGeminiResponseText(result) || 'No response from the model.';
    return { text: responseText, provider: 'gemini' };
  };

  if (groqKey) {
    try {
      return await runGroq();
    } catch (e) {
      if (!shouldFallbackAfterProviderFailure(e)) throw e;
      if (import.meta.env.DEV) console.warn('[LLM] Groq failed, trying backups:', extractErrorText(e));
      if (geminiKey) {
        try {
          return await runGemini();
        } catch (e2) {
          if (!shouldFallbackAfterProviderFailure(e2)) throw e2;
          if (openaiKey) {
            if (import.meta.env.DEV) console.warn('[LLM] Gemini failed, using OpenAI:', extractErrorText(e2));
            return runOpenAi();
          }
          throw e2;
        }
      }
      if (openaiKey) return runOpenAi();
      throw e;
    }
  }

  if (geminiKey) {
    try {
      return await runGemini();
    } catch (e) {
      if (!shouldFallbackAfterProviderFailure(e)) throw e;
      if (import.meta.env.DEV) console.warn('[LLM] Gemini failed, trying OpenAI:', extractErrorText(e));
      if (openaiKey) return runOpenAi();
      throw e;
    }
  }

  if (openaiKey) return runOpenAi();

  throw new Error('Add VITE_GROQ_API_KEY and/or VITE_GEMINI_API_KEY and/or VITE_OPENAI_API_KEY to .env.local');
}

/**
 * Intuition Skill: **Groq** first; on failure → Gemini (if key) → OpenAI (if key).
 */
export async function generateSkillChatCompletion(options: {
  systemPrompt: string;
  history: SkillChatHistoryItem[];
  userMsg: string;
}): Promise<{ text: string; provider: LlmProviderId }> {
  const { systemPrompt, history, userMsg } = options;
  const geminiKey = getGeminiApiKey();
  const groqKey = getGroqApiKey();
  const openaiKey = getOpenAiApiKey();

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...history.map((m) => ({
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    })),
    { role: 'user', content: userMsg },
  ];

  const runGroq = async (): Promise<{ text: string; provider: 'groq' }> => {
    if (!groqKey) {
      throw new Error('No Groq API key. Set VITE_GROQ_API_KEY in .env.local (https://console.groq.com).');
    }
    const client = new OpenAI({
      apiKey: groqKey,
      baseURL: GROQ_BASE_URL,
      dangerouslyAllowBrowser: true,
    });
    const completion = await client.chat.completions.create({
      model: GROQ_MODEL,
      messages: chatMessages,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    return { text: text || 'No response from the model.', provider: 'groq' };
  };

  const runOpenAi = async (): Promise<{ text: string; provider: 'openai' }> => {
    if (!openaiKey) {
      throw new Error('No OpenAI API key. Set VITE_OPENAI_API_KEY in .env.local (from platform.openai.com — not the ChatGPT app subscription).');
    }
    const client = new OpenAI({ apiKey: openaiKey, dangerouslyAllowBrowser: true });
    const completion = await client.chat.completions.create({
      model: OPENAI_MODEL,
      messages: chatMessages,
    });
    const text = completion.choices[0]?.message?.content?.trim() ?? '';
    return { text: text || 'No response from the model.', provider: 'openai' };
  };

  const runGemini = async (): Promise<{ text: string; provider: 'gemini' }> => {
    if (!geminiKey) {
      throw new Error('No Gemini API key. Set VITE_GEMINI_API_KEY in .env.local.');
    }
    const ai = new GoogleGenAI({ apiKey: geminiKey });
    const contents = [
      { role: 'user', parts: [{ text: systemPrompt }] },
      { role: 'model', parts: [{ text: 'Understood. Ready when you are.' }] },
      ...history.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('model' as const),
        parts: [{ text: m.content }],
      })),
      { role: 'user', parts: [{ text: userMsg }] },
    ];
    const result = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
    });
    const direct =
      typeof (result as { text?: unknown }).text === 'string'
        ? String((result as { text: string }).text).trim()
        : '';
    const responseText = direct || extractGeminiResponseText(result) || 'No response from the model.';
    return { text: responseText, provider: 'gemini' };
  };

  if (groqKey) {
    try {
      return await runGroq();
    } catch (e) {
      if (!shouldFallbackAfterProviderFailure(e)) throw e;
      if (import.meta.env.DEV) console.warn('[Skill] Groq failed, trying backups:', extractErrorText(e));
      if (geminiKey) {
        try {
          return await runGemini();
        } catch (e2) {
          if (!shouldFallbackAfterProviderFailure(e2)) throw e2;
          if (openaiKey) {
            if (import.meta.env.DEV) console.warn('[Skill] Gemini failed, using OpenAI:', extractErrorText(e2));
            return runOpenAi();
          }
          throw e2;
        }
      }
      if (openaiKey) return runOpenAi();
      throw e;
    }
  }

  if (geminiKey) {
    try {
      return await runGemini();
    } catch (e) {
      if (!shouldFallbackAfterProviderFailure(e)) throw e;
      if (import.meta.env.DEV) console.warn('[Skill] Gemini failed, trying OpenAI:', extractErrorText(e));
      if (openaiKey) return runOpenAi();
      throw e;
    }
  }

  if (openaiKey) return runOpenAi();

  throw new Error('Add VITE_GROQ_API_KEY and/or VITE_GEMINI_API_KEY and/or VITE_OPENAI_API_KEY to .env.local');
}
