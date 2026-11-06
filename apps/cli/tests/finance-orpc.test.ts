import { describe, expect, it } from 'bun:test';
import { assertLoopbackApiUrl } from '../src/finance-orpc';

describe('assertLoopbackApiUrl', () => {
    it('accepts plain loopback HTTP URLs unchanged', () => {
        expect(assertLoopbackApiUrl('http://localhost:3000/rpc')).toBe('http://localhost:3000/rpc');
        expect(assertLoopbackApiUrl('http://127.0.0.1/rpc')).toBe('http://127.0.0.1/rpc');
        expect(assertLoopbackApiUrl('http://[::1]:8080/rpc')).toBe('http://[::1]:8080/rpc');
    });

    it('falls back to the default local API URL when unset or blank', () => {
        expect(assertLoopbackApiUrl(undefined)).toBe('http://localhost:3000/rpc');
        expect(assertLoopbackApiUrl('   ')).toBe('http://localhost:3000/rpc');
    });

    it('rejects non-loopback or non-plain transports', () => {
        for (const bad of [
            'https://localhost/rpc',
            'http://example.com/rpc',
            'http://user:pass@localhost/rpc',
            'http://localhost/rpc?token=x',
            'http://localhost/rpc#frag',
            'http://localhos/rpc',
            'not a url at all',
        ]) {
            expect(() => assertLoopbackApiUrl(bad)).toThrow(/loopback HTTP URL|valid URL/);
        }
    });
});
