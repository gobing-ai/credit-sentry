import { beforeEach, describe, expect, it } from 'bun:test';
import { resetPlanets } from '@credit-sentry/api';
import { app } from '../src/app';

const rpcBody = (input: unknown) => JSON.stringify({ json: input, meta: [] });

describe('server routes', () => {
    beforeEach(() => {
        resetPlanets();
    });

    it('GET /health returns ok', async () => {
        const res = await app.request('/health');
        expect(res.status).toBe(200);
        expect(await res.json()).toEqual({ status: 'ok' });
    });

    it('GET /health includes X-Request-Id header', async () => {
        const res = await app.request('/health');
        expect(res.headers.get('X-Request-Id')).toBeString();
    });

    it('GET /rpc returns 404 (no matching procedure)', async () => {
        const res = await app.request('/rpc');
        expect(res.status).toBe(404);
    });

    it('POST /rpc/list calls the list procedure', async () => {
        const res = await app.request('/rpc/list', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rpcBody({ cursor: 0 }),
        });
        expect(res.status).toBe(200);
        const body = (await res.json()) as { json: unknown };
        expect(body).toHaveProperty('json');
        expect(body.json).toBeArray();
    });

    it('POST /rpc/find returns 404 ORPCError for a missing planet', async () => {
        const res = await app.request('/rpc/find', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: rpcBody({ id: 999 }),
        });
        expect(res.status).toBe(404);
        const body = (await res.json()) as { json: { code: string; message: string } };
        expect(body.json.code).toBe('NOT_FOUND');
        expect(body.json.message).toBe('Planet 999 not found');
    });
});
