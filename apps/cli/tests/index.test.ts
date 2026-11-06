import { describe, expect, it, mock } from 'bun:test';
import { getEnvVars, setLoggerMuted } from '@credit-sentry/utils';
import type { CliContext } from '../src/cli';

const mockPlanets = [
    { id: 1, name: 'Earth' },
    { id: 2, name: 'Mars' },
];

function mockOrpc() {
    mock.module('../src/orpc.js', () => ({
        orpc: {
            list: mock(async () => mockPlanets),
            create: mock(async ({ name }: { name: string }) => ({ id: 3, name })),
        },
    }));
}

/** Capture stdout lines into an array via CliContext injection. */
function captureCtx(): { ctx: CliContext; lines: string[]; errLines: string[]; exitCodes: number[] } {
    const lines: string[] = [];
    const errLines: string[] = [];
    const exitCodes: number[] = [];
    const ctx: CliContext = {
        cwd: '/test',
        env: {},
        output: {
            info: (text) => lines.push(text),
            error: (text) => errLines.push(text),
        },
        setExitCode: (code) => exitCodes.push(code),
    };
    return { ctx, lines, errLines, exitCodes };
}

describe('run', () => {
    it('defaults to list when no args', async () => {
        mockOrpc();
        const { run } = await import('../src/cli');
        const { ctx, lines } = captureCtx();
        await run([], ctx);
        expect(lines).toEqual(['1. Earth', '2. Mars']);
    });

    it('list command returns formatted planet names', async () => {
        mockOrpc();
        const { run } = await import('../src/cli');
        const { ctx, lines } = captureCtx();
        await run(['list'], ctx);
        expect(lines).toEqual(['1. Earth', '2. Mars']);
    });

    it('create command with name returns created planet', async () => {
        mockOrpc();
        const { run } = await import('../src/cli');
        const { ctx, lines } = captureCtx();
        await run(['create', 'Venus'], ctx);
        expect(lines).toEqual(['Created: 3. Venus']);
    });

    it('create command defaults name to Unknown', async () => {
        mockOrpc();
        const { run } = await import('../src/cli');
        const { ctx, lines } = captureCtx();
        await run(['create'], ctx);
        expect(lines).toEqual(['Created: 3. Unknown']);
    });

    it('rejects unknown commands', async () => {
        mockOrpc();
        const { run } = await import('../src/cli');
        const { ctx } = captureCtx();
        await expect(run(['bogus'], ctx)).rejects.toThrow('Unknown command: bogus');
    });
});

describe('main', () => {
    it('creates a production context with cwd, env, output, and isolated exit-code setters', async () => {
        const { createCliContext } = await import('../src/cli');
        const originalWrite = Bun.write;
        const writes: string[] = [];
        Bun.write = ((_destination: unknown, data: Uint8Array) => {
            writes.push(new TextDecoder().decode(data));
            return Promise.resolve(data.length);
        }) as typeof Bun.write;
        setLoggerMuted(false); // opt out of bun-test auto-mute to verify write paths
        try {
            const ctx = createCliContext();
            expect(ctx.cwd).toBe(process.cwd());
            expect(ctx.env).toBe(getEnvVars());
            ctx.output.info('out');
            ctx.output.error('err');
            ctx.setExitCode(7);
            expect(writes).toEqual(['out\n', 'err\n']);
        } finally {
            Bun.write = originalWrite;
            setLoggerMuted(undefined); // restore auto-mute for other tests
        }
    });

    it('returns zero without setting an exit code on success', async () => {
        mockOrpc();
        const { main } = await import('../src/cli');
        const { ctx, exitCodes } = captureCtx();
        expect(await main(['list'], ctx)).toBe(0);
        expect(exitCodes).toEqual([]);
    });

    it('isolates API failure output and exit code in the context', async () => {
        mock.module('../src/orpc.js', () => ({
            orpc: {
                list: mock(async () => {
                    throw new Error('boom');
                }),
            },
        }));
        const { main } = await import('../src/cli');
        const { ctx, errLines, exitCodes } = captureCtx();
        expect(await main(['list'], ctx)).toBe(3);
        expect(errLines).toEqual(['boom']);
        expect(exitCodes).toEqual([3]);
    });

    it('reports exit code 2 for unknown commands', async () => {
        mockOrpc();
        const { main } = await import('../src/cli');
        const { ctx, errLines, exitCodes } = captureCtx();
        expect(await main(['bogus'], ctx)).toBe(2);
        expect(errLines).toEqual(['Unknown command: bogus']);
        expect(exitCodes).toEqual([2]);
    });
});
