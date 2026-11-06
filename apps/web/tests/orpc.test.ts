import { describe, expect, it } from 'bun:test';

describe('orpc client', () => {
    it('exports a typed client with the planet contract procedures', async () => {
        const { createOrpcClient, orpc, resetFetchForTesting, setFetchForTesting } = await import('../src/orpc');
        expect(orpc).toBeDefined();
        expect(typeof orpc.list).toBe('function');
        expect(typeof orpc.find).toBe('function');
        expect(typeof orpc.create).toBe('function');
        setFetchForTesting((() =>
            Promise.resolve(
                new Response(JSON.stringify({ json: [], meta: [] }), {
                    headers: { 'Content-Type': 'application/json' },
                }),
            )) as unknown as typeof fetch);
        const client = createOrpcClient({ url: 'https://example.com/rpc', timeout: 25 });
        await expect(client.list({})).resolves.toEqual([]);
        resetFetchForTesting();
    });
});
