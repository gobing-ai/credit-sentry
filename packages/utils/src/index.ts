/**
 * Flattens an intersection or mapped type into a single object literal so
 * editor hover tooltips show `{ a: string; b: number }` instead of `A & B`.
 * Compile-time only — emits no runtime code.
 */
export type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

// Re-export zod so every workspace package gets it through utils.
export type { ZodSchema, ZodType } from 'zod';
export { z } from 'zod';

export type { EnvRecord } from './env';
export { getEnvVar, getEnvVars } from './env';
export { logger, setLoggerMuted } from './logger';

/** Default API base URL for local development; resolved when no env or origin is supplied. */
export const DEFAULT_API_URL = 'http://localhost:3000/rpc';
/** Default request timeout (ms) for oRPC clients; overridable per-call or via client config. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** Resolve an explicit API URL, a browser same-origin URL, or the local default. */
export function resolveApiUrl(envUrl?: string, origin?: string): string {
    if (envUrl?.trim()) return envUrl;
    if (origin?.trim()) return new URL('/rpc', origin).toString();
    return DEFAULT_API_URL;
}

/** Execute fetch with a real aborting timeout while preserving a caller abort signal. */
export async function fetchWithTimeout(
    fetchImpl: typeof globalThis.fetch,
    input: Parameters<typeof globalThis.fetch>[0],
    init: RequestInit = {},
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
): Promise<Response> {
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
        throw new RangeError('timeoutMs must be a positive finite number');
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort(init.signal?.reason);
    if (init.signal?.aborted) {
        abortFromCaller();
    } else {
        init.signal?.addEventListener('abort', abortFromCaller, { once: true });
    }
    const timeout = setTimeout(
        () => controller.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError')),
        timeoutMs,
    );

    try {
        return await fetchImpl(input, { ...init, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
        init.signal?.removeEventListener('abort', abortFromCaller);
    }
}
