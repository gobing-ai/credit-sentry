import { describe, expect, it } from 'bun:test';
import { Hono } from 'hono';
import { main, startServer } from '../src';

describe('server entry', () => {
    it('injects application, server creation, and logging without binding a real port', () => {
        const messages: string[] = [];
        const fakeServer = { hostname: '127.0.0.1', port: 4321 } as unknown as ReturnType<typeof Bun.serve>;
        let receivedPort: number | undefined;
        const serve = ((options: Parameters<typeof Bun.serve>[0]) => {
            const port = typeof options === 'object' && 'port' in options ? options.port : undefined;
            receivedPort = typeof port === 'number' ? port : undefined;
            return fakeServer;
        }) as typeof Bun.serve;

        const result = main(
            {
                createApplication: () => new Hono(),
                serve,
                log: (message) => messages.push(message),
            },
            { port: 4321, hostname: '127.0.0.1' },
        );

        expect(result).toBe(fakeServer);
        expect(receivedPort).toBe(4321);
        expect(messages).toEqual(['Server running at http://127.0.0.1:4321']);
    });

    it('starts and stops with production dependencies on an ephemeral port', () => {
        const originalWrite = Bun.write;
        Bun.write = ((_destination: unknown, data: Uint8Array) => Promise.resolve(data.length)) as typeof Bun.write;
        try {
            const server = startServer({ port: 0, hostname: '127.0.0.1' });
            expect(server.port).toBeGreaterThan(0);
            server.stop(true);
        } finally {
            Bun.write = originalWrite;
        }
    });
});
