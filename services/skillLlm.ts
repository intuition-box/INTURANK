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

/** True when a second provider might help (quota, rate, overload). */
export function isRetryableLlmError(error: unknown): boolean {
  const raw = extractErrorText(error).toLowerCase();
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : NaN;
  if (status === 429) return true;
  return (
    /429|quota|rate limit|resource exhausted|too many requests|insufficient_quota|billing|overloaded|capacity/i.test(raw) ||
    /try again later|temporarily unavailable/i.test(raw)
  );
}

/** User-facing message for Skill chat failures (Gemini / Groq / OpenAI). */
export function formatSkillLlmError(error: unknown): string {
  const raw = extractErrorText(error);
  const lower = raw.toLowerCase();
  const status = typeof error === 'object' && error !== null && 'status' in error ? Number((error as { status?: number }).status) : NaN;

  if (status === 401 || lower.includes('invalid api key') || lower.includes('incorrect api key')) {
    return 'API key rejected (OpenAI or Groq). Check `VITE_OPENAI_API_KEY` / `VITE_GROQ_API_KEY` in console settings.';
  }
  if (status === 429 || lower.includes('insufficient_quota') || lower.includes('billing')) {
    return 'AI quota or rate limit. Wait a bit, or check Google AI Studio, Groq console, or OpenAI billing.';
  }

  try {
    const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
    const m = parsed?.error?.message;
    if (m && typeof m === 'string') {
      if (parsed.error?.code === 403 || /leaked|invalid|revoked|permission/i.test(m)) {
        return (
          'API access denied (403). Google may have flagged the Gemini key. Create a new key at https://aistudio.google.com/apikey , set `VITE_GEMINI_API_KEY`, restart the dev server, and never commit keys.'
        );
      }
      return `Gemini: ${m.slice(0, 280)}${m.length > 280 ? '…' : ''}`;
    }
  } catch {
    /* not JSON */
  }
  if (raw.includes('403') || lower.includes('leaked') || lower.includes('api key was reported')) {
    return (
      'API access denied. Your Gemini key may be revoked or flagged. Create a new key at https://aistudio.google.com/apikey and set `VITE_GEMINI_API_KEY` in `.env.local`.'
    );
  }
  if (lower.includes('429') || lower.includes('resource exhausted') || lower.includes('quota')) {
    return 'Gemini rate limit or quota exceeded. If `VITE_GROQ_API_KEY` or `VITE_OPENAI_API_KEY` is set, backups will run automatically.';
  }
  const short = raw.length > 320 ? raw.slice(0, 317) + '…' : raw;
  return `Request failed: ${short}`;
}

export type SkillChatHistoryItem = { role: 'user' | 'assistant'; content: string };

/**
 * Intuition Skill: Gemini first; on retryable failure → Groq (if key) → OpenAI (if key).
 * Groq: https://console.groq.com — OpenAI-compatible, fast. OpenAI: platform keys (not ChatGPT subscription).
 */
export async function generateSkillChatCompletion(options: {
  systemPrompt: string;
  history: SkillChatHistoryItem[];
  userMsg: string;
}): Promise<{ text: string; provider: 'gemini' | 'groq' | 'openai' }> {
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

  if (!geminiKey) {
    if (groqKey) {
      try {
        return await runGroq();
      } catch (e) {
        if (openaiKey) {
          if (import.meta.env.DEV) console.warn('[Skill] Groq failed, using OpenAI:', extractErrorText(e));
          return runOpenAi();
        }
        throw e;
      }
    }
    if (openaiKey) return runOpenAi();
    throw new Error('Add VITE_GEMINI_API_KEY and/or VITE_GROQ_API_KEY and/or VITE_OPENAI_API_KEY to .env.local');
  }

  try {
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
    const responseText =
      (result.text ?? (result as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]?.content?.parts?.[0]?.text) ||
      'No response from the model.';
    return { text: responseText, provider: 'gemini' };
  } catch (e) {
    if (!isRetryableLlmError(e)) throw e;
    if (import.meta.env.DEV) console.warn('[Skill] Gemini failed, trying backups:', extractErrorText(e));
    if (groqKey) {
      try {
        return await runGroq();
      } catch (e2) {
        if (openaiKey) {
          if (import.meta.env.DEV) console.warn('[Skill] Groq failed, using OpenAI:', extractErrorText(e2));
          return runOpenAi();
        }
        throw e2;
      }
    }
    if (openaiKey) return runOpenAi();
    throw e;
  }
}
