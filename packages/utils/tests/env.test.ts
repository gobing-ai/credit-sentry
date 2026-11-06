import { afterEach, describe, expect, it } from 'bun:test';
import { getEnvVar, getEnvVars } from '../src/env';

const KEY = 'CREDIT_SENTRY_ENV_TEST';

describe('env gateway', () => {
    afterEach(() => {
        delete getEnvVars()[KEY];
    });

    it('returns undefined for an unset variable', () => {
        expect(getEnvVar(KEY)).toBeUndefined();
    });

    it('reads a variable set on the live record', () => {
        getEnvVars()[KEY] = 'on';
        expect(getEnvVar(KEY)).toBe('on');
    });

    it('returns the same live record on every call, not a snapshot', () => {
        expect(getEnvVars()).toBe(getEnvVars());
    });
});
