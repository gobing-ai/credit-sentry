import { describe, expect, it } from 'bun:test';
import { createOrpcClient, orpc, resetFetchForTesting, setFetchForTesting } from '../src/orpc';

describe('orpc', () => {
    it('exports an orpc client', () => {
        expect(orpc).toBeDefined();
        expect(orpc.list).toBeFunction();
    });

    it('supports explicit client and module-level test fetch injection', async () => {
        const fetchImpl = (() =>
            Promise.resolve(
                new Response(JSON.stringify({ json: [], meta: [] }), {
                    headers: { 'Content-Type': 'application/json' },
                }),
            )) as unknown as typeof fetch;
        setFetchForTesting(fetchImpl);
        const client = createOrpcClient({ url: 'https://example.com/rpc', timeout: 25 });
        await expect(client.list({})).resolves.toEqual([]);
        resetFetchForTesting();
    });
});
