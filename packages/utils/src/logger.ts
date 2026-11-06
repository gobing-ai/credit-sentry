import { getEnvVar } from './env';

/** Minimal structured-output utility for monorepo apps. */
const encoder = new TextEncoder();

function format(...args: unknown[]): string {
    return `${args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')}\n`;
}

/** True when running under bun test (NODE_ENV=test) or when tests opt in via env. */
function isTest(): boolean {
    return getEnvVar('NODE_ENV') === 'test' || getEnvVar('BUN_TEST') === 'true' || getEnvVar('BUN_TEST') === '1';
}

/**
 * Test seam: force the mute flag. When `false`, logger writes are emitted even
 * under bun test (overrides env detection). When `true` or unset, bun-test
 * environment is muted. Production callers should not set this.
 */
export function setLoggerMuted(muted: boolean | undefined): void {
    (globalThis as { __loggerMuted?: boolean }).__loggerMuted = muted ?? true;
}

function isMuted(): boolean {
    const override = (globalThis as { __loggerMuted?: boolean }).__loggerMuted;
    if (override === false) return false;
    if (override === true) return true;
    return isTest();
}

/** Structured-output logger for monorepo apps. Mutes output under bun test. */
export const logger = {
    info(...args: unknown[]): void {
        if (isMuted()) return;
        Bun.write(Bun.stdout, encoder.encode(format(...args)));
    },
    error(...args: unknown[]): void {
        if (isMuted()) return;
        Bun.write(Bun.stderr, encoder.encode(format(...args)));
    },
    warn(...args: unknown[]): void {
        if (isMuted()) return;
        Bun.write(Bun.stderr, encoder.encode(format(...args)));
    },
};
