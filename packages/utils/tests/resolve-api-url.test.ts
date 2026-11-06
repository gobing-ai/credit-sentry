import { describe, expect, it } from 'bun:test';
import { fetchWithTimeout, resolveApiUrl } from '../src';

describe('resolveApiUrl', () => {
    it('returns the default URL without inputs', () => {
        expect(resolveApiUrl()).toBe('http://localhost:3000/rpc');
    });

    it('prefers an explicit environment URL', () => {
        expect(resolveApiUrl('https://api.example.com/rpc', 'https://web.example.com')).toBe(
            'https://api.example.com/rpc',
        );
    });

    it('uses same-origin RPC in the browser', () => {
        expect(resolveApiUrl(undefined, 'https://web.example.com/app')).toBe('https://web.example.com/rpc');
    });
});

describe('fetchWithTimeout', () => {
    it('aborts the underlying fetch when the timeout expires', async () => {
        let observedSignal: AbortSignal | undefined;
        const fetchImpl = ((_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
            observedSignal = init?.signal ?? undefined;
            return new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
            });
        }) as typeof fetch;

        await expect(fetchWithTimeout(fetchImpl, 'https://example.com', {}, 1)).rejects.toMatchObject({
            name: 'TimeoutError',
        });
        expect(observedSignal?.aborted).toBe(true);
    });

    it('forwards caller cancellation', async () => {
        const caller = new AbortController();
        const fetchImpl = ((_input: Parameters<typeof fetch>[0], init?: RequestInit) => {
            return new Promise<Response>((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
            });
        }) as typeof fetch;
        const pending = fetchWithTimeout(fetchImpl, 'https://example.com', { signal: caller.signal }, 1000);
        caller.abort(new Error('caller stopped'));
        await expect(pending).rejects.toThrow('caller stopped');
    });
});
