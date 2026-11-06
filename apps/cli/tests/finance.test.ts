import { afterEach, describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { getEnvVars } from '@credit-sentry/utils';
import { main } from '../src/cli';

const token = 'synthetic-local-capability-0000000000000000';
const header = 'transaction_date,posted_date,merchant,amount,currency,kind,status,transaction_id';
const csv = `${header}\n2026-10-01,2026-10-02,Synthetic Merchant,12.34,USD,purchase,posted,cli-1\n`;
const children: ReturnType<typeof Bun.spawn>[] = [];
const servers: ReturnType<typeof Bun.serve>[] = [];
afterEach(async () => {
    for (const server of servers.splice(0)) server.stop(true);
    for (const child of children.splice(0)) {
        child.kill();
        await child.exited;
    }
});

async function fixture() {
    await mkdir('.spur/run/first-csv', { recursive: true });
    const root = await mkdtemp('.spur/run/first-csv/cli-');
    const env = {
        ...getEnvVars(),
        NODE_ENV: 'test',
        CREDIT_SENTRY_TOKEN: token,
        DATABASE_URL: `sqlite://${resolve(root, 'private', 'ledger.sqlite')}`,
    };
    const script =
        "import { createApp } from './apps/server/src/app'; const s = Bun.serve({hostname:'127.0.0.1',port:0,fetch:createApp().fetch}); console.log(JSON.stringify({port:s.port}));";
    const child = Bun.spawn([process.execPath, '-e', script], {
        cwd: process.cwd(),
        env,
        stdout: 'pipe',
        stderr: 'pipe',
    });
    children.push(child);
    const reader = child.stdout.getReader();
    let ready = '';
    while (!ready.includes('\n')) {
        const chunk = await reader.read();
        if (chunk.done) throw new Error(`server did not start: ${await new Response(child.stderr).text()}`);
        ready += new TextDecoder().decode(chunk.value);
    }
    const port = (JSON.parse(ready.split('\n')[0] ?? '') as { port: number }).port;
    const cliEnv = { ...env, API_URL: `http://127.0.0.1:${port}/rpc` };
    const command = async (args: string[], overrides: Record<string, string> = {}) => {
        const out: string[] = [];
        const errors: string[] = [];
        const code = await main(args, {
            cwd: process.cwd(),
            env: { ...cliEnv, ...overrides },
            output: { info: (s) => out.push(s), error: (s) => errors.push(s) },
            setExitCode: () => {},
        });
        return { code, out: out.join('\n'), error: errors.join('\n') };
    };
    const file = resolve(root, 'statement.csv');
    await Bun.write(file, csv);
    return { root, cliEnv, command, file };
}

describe('financial CLI over real local HTTP', () => {
    it('runs account import review correction admission and ledger commands with JSON output', async () => {
        const f = await fixture();
        const created = await f.command(['account', 'create', 'Synthetic CLI card']);
        expect(created.code).toBe(0);
        const account = JSON.parse(created.out) as { id: string };
        expect((await f.command(['account', 'list'])).out).toContain(account.id);
        const imported = await f.command(['import', account.id, f.file]);
        expect(imported.code).toBe(0);
        const review = JSON.parse(imported.out) as { id: string };
        expect((await f.command(['review', review.id])).out).toContain('1234');
        expect((await f.command(['correct', review.id, '1', 'amount', '13.00'])).code).toBe(0);
        expect((await f.command(['admit', review.id])).code).toBe(0);
        const ledger = await f.command(['ledger', account.id]);
        expect(ledger.code).toBe(0);
        expect(JSON.parse(ledger.out)).toMatchObject([{ amountMinor: '1300' }]);
        const repeated = await f.command(['import', account.id, f.file]);
        expect(JSON.parse(repeated.out).id).toBe(review.id);
        const real = Bun.spawn([process.execPath, 'run', 'apps/cli/src/index.ts', 'account', 'list'], {
            env: { ...f.cliEnv, NODE_ENV: 'production' },
            stdout: 'pipe',
            stderr: 'pipe',
        });
        const stdout = await new Response(real.stdout).text();
        expect(await real.exited).toBe(0);
        expect(JSON.parse(stdout)).toMatchObject([{ id: account.id }]);
        await Bun.write(
            '.spur/run/first-csv/artifacts/cli-evidence.json',
            JSON.stringify({ account, importId: review.id, ledger: JSON.parse(ledger.out) }, null, 2),
        );
    }, 15000);

    it('rejects argument errors before making requests and uses nonzero actionable API failures', async () => {
        const f = await fixture();
        for (const args of [
            ['account'],
            ['account', 'remove'],
            ['account', 'create'],
            ['account', 'list', 'extra'],
            ['import'],
            ['import', 'a'],
            ['import', 'a', 'b', 'extra'],
            ['review'],
            ['review', 'a', 'extra'],
            ['correct', 'a', '0', 'amount', '1'],
            ['correct', 'a', 'x', 'amount', '1'],
            ['correct', 'a', '1', 'id', 'x'],
            ['correct', 'a', '1', 'amount'],
            ['admit'],
            ['ledger'],
            ['ledger', 'a', 'extra'],
        ]) {
            const result = await f.command(args);
            expect({ args, code: result.code }).toMatchObject({ code: 2 });
            expect(result.error.length).toBeGreaterThan(0);
        }
        expect((await f.command(['review', 'not-found'])).code).toBe(3);
        expect((await f.command(['account', 'list'], { CREDIT_SENTRY_TOKEN: 'wrong' })).code).not.toBe(0);
        expect((await f.command(['account', 'list'], { CREDIT_SENTRY_TOKEN: '' })).code).toBe(2);
        expect((await f.command(['import', 'a', resolve(f.root, 'missing.csv')])).code).toBe(2);
    }, 15000);

    it('validates loopback HTTP URL and rejects credential redirects and unsupported files', async () => {
        const f = await fixture();
        for (const url of [
            'https://example.invalid/rpc',
            'http://example.invalid/rpc',
            'http://127.0.0.1.evil.invalid/rpc',
            'http://user:pass@localhost/rpc',
            'http://localhost/rpc?bad=1',
            'http://localhost/rpc#bad',
        ]) {
            const result = await f.command(['import', 'a', resolve(f.root, 'missing.csv')], { API_URL: url });
            expect(result.code).toBe(2);
            expect(result.error).toMatch(/loopback|API_URL/i);
            expect(result.error).not.toContain(token);
        }
        let stolen = 0;
        const receiver = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch: () => {
                stolen++;
                return new Response('{}');
            },
        });
        const redirect = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch: () => Response.redirect(`http://127.0.0.1:${receiver.port}`, 307),
        });
        servers.push(receiver, redirect);
        expect((await f.command(['account', 'list'], { API_URL: `http://127.0.0.1:${redirect.port}/rpc` })).code).toBe(
            3,
        );
        expect(stolen).toBe(0);
        const large = resolve(f.root, 'large.csv');
        await Bun.write(large, 'x'.repeat(1024 * 1024 + 1));
        expect((await f.command(['import', 'a', large])).code).toBe(2);
        const bad = resolve(f.root, 'bad.csv');
        await Bun.write(bad, new Uint8Array([0xff, 0xfe, 0x00]));
        const encoding = await f.command(['import', 'a', bad]);
        expect(encoding.code).toBe(2);
        expect(encoding.error).toMatch(/UTF-8/i);
        expect((await f.command(['import', 'a', f.root])).code).toBe(2);
    }, 15000);
});
