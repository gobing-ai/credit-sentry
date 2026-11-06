import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { app } from '../src/app';

describe('server middleware', () => {
    let baseUrl: string;
    let stopServer: (() => void) | undefined;

    beforeAll(async () => {
        // Use Bun's test server to get a real URL for middleware testing.
        const testServer = Bun.serve({
            port: 0,
            fetch: app.fetch,
        });
        baseUrl = testServer.url.toString().replace(/\/$/, '');
        stopServer = () => testServer.stop(true);
    });

    afterAll(() => stopServer?.());

    it('adds X-Request-Id header to every response', async () => {
        const res = await fetch(`${baseUrl}/health`);
        expect(res.headers.get('X-Request-Id')).toBeString();
    });

    it('propagates incoming X-Request-Id', async () => {
        const res = await fetch(`${baseUrl}/health`, {
            headers: { 'X-Request-Id': 'my-trace-42' },
        });
        expect(res.headers.get('X-Request-Id')).toBe('my-trace-42');
    });

    it('error handler returns 500 for thrown non-ORPCError', async () => {
        const { errorHandler } = await import('../src/app');
        const { Hono } = await import('hono');
        const throwApp = new Hono();
        throwApp.get('/crash', () => {
            throw new Error('boom');
        });
        throwApp.onError(errorHandler);
        const res = await throwApp.request('/crash');
        expect(res.status).toBe(500);
        const body = (await res.json()) as { error: string };
        expect(body.error).toBe('Internal Server Error');
    });

    it('preserves native ORPCError status codes', async () => {
        const res = await fetch(`${baseUrl}/rpc/find`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: { id: 999 }, meta: [] }),
        });
        expect(res.status).toBe(404);
        const body = (await res.json()) as { json: { code: string; message: string } };
        expect(body.json.code).toBe('NOT_FOUND');
        expect(body.json.message).toBe('Planet 999 not found');
    });
});
