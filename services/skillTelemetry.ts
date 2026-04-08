import { APP_VERSION } from '../constants';

export type SkillLogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured, grep-friendly logs for the in-app Skill agent (LLM + txs + UI).
 * Always JSON per line; safe for log aggregators. No PII by default — never log full API keys or private keys.
 */
export function logSkillEvent(payload: {
    level?: SkillLogLevel;
    event: string;
    detail?: Record<string, unknown>;
    error?: unknown;
}): void {
    const { level = 'info', event, detail, error } = payload;
    const errMsg = error instanceof Error ? error.message : error != null ? String(error) : undefined;
    const stack = error instanceof Error ? error.stack : undefined;
    const entry: Record<string, unknown> = {
        ts: new Date().toISOString(),
        scope: 'inturank.skill',
        v: APP_VERSION,
        level,
        event,
        ...detail,
    };
    if (errMsg) entry.err = errMsg;
    if (stack && (level === 'error' || level === 'warn')) entry.stack = stack;

    const line = JSON.stringify(entry);
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else if (import.meta.env.DEV && level === 'debug') console.debug(line);
    else console.info(line);
}
