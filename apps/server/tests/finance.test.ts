import { afterEach, describe, expect, it } from 'bun:test';
import { chmod, mkdir, mkdtemp, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { logger } from '@credit-sentry/utils';
import { SQL } from 'bun';
import { createApp } from '../src/app';

const token = 'synthetic-local-capability-0000000000000000';
const header = 'transaction_date,posted_date,merchant,amount,currency,kind,status,transaction_id';
const line = '2026-10-01,2026-10-02,Example Merchant,12.34,USD,purchase,posted,example-1';
interface Candidate {
    row: number;
    original: Record<string, string>;
    values: Record<string, string>;
    amountMinor: string | null;
    issues: string[];
}
interface Review {
    id: string;
    accountId: string;
    state: string;
    rows: Candidate[];
}
interface Transaction {
    id: string;
    accountId: string;
    amountMinor: string;
    merchantRaw: string;
    sources: { importId: string; row: number }[];
}
const servers: ReturnType<typeof Bun.serve>[] = [];
const originalInfo = logger.info;
const originalError = logger.error;
afterEach(() => {
    for (const server of servers.splice(0)) server.stop(true);
    logger.info = originalInfo;
    logger.error = originalError;
});

async function fixture(options: { token?: string; databaseUrl?: string } = {}) {
    await mkdir('.spur/run/first-csv/artifacts', { recursive: true });
    const root = await mkdtemp('.spur/run/first-csv/test-');
    const databaseUrl = options.databaseUrl ?? `sqlite://${join(process.cwd(), root, 'private', 'ledger.sqlite')}`;
    const app = createApp({ financial: { token: options.token ?? token, databaseUrl } });
    const server = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: app.fetch });
    servers.push(server);
    const url = `http://127.0.0.1:${server.port}`;
    const request = async (method: string, input: unknown, headers: Record<string, string> = {}) =>
        fetch(`${url}/rpc/finance/${method}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
            body: JSON.stringify({ json: input }),
        });
    const rpc = async <T>(method: string, input: unknown): Promise<T> => {
        const res = await request(method, input);
        const body = await res.json();
        expect({ status: res.status, body }).toMatchObject({ status: 200 });
        return (body as { json: T }).json;
    };
    const account = await rpc<{ id: string; label: string }>('accountCreate', { label: 'Synthetic card' });
    const importCsv = (content: string, accountId = account.id) => rpc<Review>('importCsv', { accountId, content });
    return { root, databaseUrl, app, server, url, rpc, request, account, importCsv };
}

describe('local financial RPC end to end', () => {
    it('reviews exact candidates, admits explicitly and persists source evidence across server restart', async () => {
        const f = await fixture();
        const csv = `${header}\r\n2026-10-01,2026-10-02,"Example, ""quoted""\nmerchant",90071992547409.93,USD,purchase,posted,huge\r\n${line}\r\n`;
        const review = await f.importCsv(`\uFEFF${csv}`);
        expect(review.state).toBe('needs_review');
        expect(review.rows).toHaveLength(2);
        expect(review.rows[0]?.amountMinor).toBe('9007199254740993');
        expect(review.rows[0]?.original.merchant).toBe('Example, "quoted"\nmerchant');
        expect(await f.rpc('ledger', { accountId: f.account.id })).toEqual([]);
        await f.rpc('admit', { importId: review.id });
        const ledger = await f.rpc<Transaction[]>('ledger', { accountId: f.account.id });
        expect(ledger).toHaveLength(2);
        expect(ledger[0]?.amountMinor).toBe('9007199254740993');
        expect(ledger[0]?.sources).toEqual([{ importId: review.id, row: 1 }]);
        f.server.stop(true);
        const restarted = Bun.serve({
            hostname: '127.0.0.1',
            port: 0,
            fetch: createApp({ financial: { token, databaseUrl: f.databaseUrl } }).fetch,
        });
        servers.push(restarted);
        const res = await fetch(`http://127.0.0.1:${restarted.port}/rpc/finance/ledger`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: { accountId: f.account.id } }),
        });
        expect((await res.json()).json).toEqual(ledger);
        await Bun.write(
            '.spur/run/first-csv/artifacts/import-evidence.json',
            JSON.stringify({ review, ledger }, null, 2),
        );
        const path = f.databaseUrl.slice('sqlite://'.length);
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        expect((await stat(join(path, '..'))).mode & 0o777).toBe(0o700);
        const db = new SQL(f.databaseUrl);
        try {
            expect(await db`SELECT version FROM sentry_migrations`).toHaveLength(1);
        } finally {
            await db.close();
        }
    });

    it('retains original evidence while correcting every candidate field and rejects premature admission', async () => {
        const f = await fixture();
        const bad = `${header}\n2026-02-30,not-date,,1e3,EUR,bogus,unknown,id\n`;
        const review = await f.importCsv(bad);
        expect(review.rows[0]?.issues.length).toBeGreaterThan(0);
        expect((await f.request('admit', { importId: review.id })).status).toBe(409);
        const fields: Record<string, string> = {
            transaction_date: '2026-02-28',
            posted_date: '2026-03-01',
            merchant: 'Corrected',
            amount: '1.25',
            currency: 'USD',
            kind: 'purchase',
            status: 'posted',
            transaction_id: 'corrected-id',
        };
        let changed = review;
        for (const [field, value] of Object.entries(fields)) {
            changed = await f.rpc<Review>('correct', { importId: review.id, row: 1, field, value });
        }
        expect(changed.rows[0]?.issues).toEqual([]);
        expect(changed.rows[0]?.original.amount).toBe('1e3');
        expect(changed.rows[0]?.amountMinor).toBe('125');
        expect((await f.importCsv(bad)).rows).toEqual(changed.rows);
        expect(
            (await f.request('correct', { importId: review.id, row: 99, field: 'amount', value: '1.00' })).status,
        ).toBe(404);
        expect((await f.request('correct', { importId: review.id, row: 1, field: 'id', value: 'bad' })).status).toBe(
            400,
        );
        await f.rpc('admit', { importId: review.id });
        expect((await f.request('correct', { importId: review.id, row: 1, field: 'amount', value: '2' })).status).toBe(
            409,
        );
        expect(await f.rpc<Transaction[]>('ledger', { accountId: f.account.id })).toMatchObject([
            { amountMinor: '125' },
        ]);
    });

    it('validates money signs, ranges, calendars and semantic fields without rounding or deleting rows', async () => {
        const f = await fixture();
        const invalid: [string, string, string, string, string][] = [
            ['NaN', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['Infinity', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['1.001', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['0', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['-1', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['1', 'USD', 'refund', 'posted', '2026-10-01'],
            ['1', 'USD', 'payment', 'posted', '2026-10-01'],
            ['92233720368547758.08', 'USD', 'purchase', 'posted', '2026-10-01'],
            ['-92233720368547758.09', 'USD', 'refund', 'posted', '2026-10-01'],
            ['1', '', 'purchase', 'posted', '2026-10-01'],
            ['1', 'usd', 'purchase', 'posted', '2026-10-01'],
            ['1', 'EUR', 'purchase', 'posted', '2026-10-01'],
            ['1', 'USD', 'purchase', 'pendingish', '2026-10-01'],
            ['1', 'USD', 'unknown', 'posted', '2026-10-01'],
            ['1', 'USD', 'purchase', 'posted', '2025-02-29'],
            ['1', 'USD', 'purchase', 'posted', '2026-13-01'],
        ];
        const review = await f.importCsv(
            `${header}\n${invalid.map(([a, c, k, s, d], i) => `${d},2026-10-02,Merchant,${a},${c},${k},${s},invalid-${i}`).join('\n')}\n`,
        );
        expect(review.rows).toHaveLength(invalid.length);
        for (const row of review.rows) expect(row.issues.length).toBeGreaterThan(0);
        expect((await f.request('admit', { importId: review.id })).status).toBe(409);
        const valid = await f.importCsv(
            `${header}\n2024-02-29,2024-03-01,Refund,-92233720368547758.08,USD,refund,posted,min\n2026-10-01,2026-10-02,Max,92233720368547758.07,USD,purchase,pending,max\n2026-10-01,2026-10-02,Fee,2.5,USD,fee,posted,fee\n2026-10-01,2026-10-02,Interest,1,USD,interest,posted,int\n2026-10-01,2026-10-02,Payment,-2,USD,payment,posted,pay\n`,
        );
        expect(valid.rows.every((r) => r.issues.length === 0)).toBe(true);
        await f.rpc('admit', { importId: valid.id });
        expect((await f.rpc<Transaction[]>('ledger', { accountId: f.account.id })).map((t) => t.amountMinor)).toEqual([
            '-9223372036854775808',
            '9223372036854775807',
            '250',
            '100',
            '-200',
        ]);
    });

    it('rejects malformed CSV and envelope bounds without storing a successful empty import', async () => {
        const f = await fixture();
        for (const content of [
            '',
            header,
            `${header}\n`,
            'wrong,header\na,b',
            `${header},extra\n${line},x`,
            `${header}\n${line},extra`,
            `${header}\n"unterminated`,
            `${header}\n2026-10-01,2026-10-02,a"b,1,USD,purchase,posted,x`,
            `${header}\n2026-10-01,2026-10-02,"a"b,1,USD,purchase,posted,x`,
            'x'.repeat(1024 * 1024 + 1),
            `${header}\n${Array.from({ length: 1001 }, (_, i) => line.replace('example-1', `row-${i}`)).join('\n')}`,
        ]) {
            expect((await f.request('importCsv', { accountId: f.account.id, content })).status).toBe(400);
        }
        expect((await f.request('review', { importId: 'absent' })).status).toBe(404);
        expect((await f.request('ledger', { accountId: 'absent' })).status).toBe(404);
        expect((await f.request('accountCreate', { label: ' ' })).status).toBe(400);
        const res = await fetch(`${f.url}/rpc/finance/importCsv`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: ' '.repeat(2 * 1024 * 1024 + 1),
        });
        expect(res.status).toBe(413);
        expect(await f.rpc('ledger', { accountId: f.account.id })).toEqual([]);
    });

    it('separates exact replay, legitimate equal purchases, matching provider overlaps and conflicts', async () => {
        const f = await fixture();
        const csv = `${header}\n${line}\n${line.replace('example-1', 'example-2')}\n`;
        const [a, b] = await Promise.all([f.importCsv(csv), f.importCsv(csv)]);
        expect(a.id).toBe(b.id);
        await Promise.all([f.rpc('admit', { importId: a.id }), f.rpc('admit', { importId: a.id })]);
        const ledger = await f.rpc<Transaction[]>('ledger', { accountId: f.account.id });
        expect(ledger).toHaveLength(2);
        const overlap = await f.importCsv(`${header}\r\n${line}\r\n`);
        await f.rpc('admit', { importId: overlap.id });
        expect(await f.rpc<Transaction[]>('ledger', { accountId: f.account.id })).toHaveLength(2);
        const conflict = await f.importCsv(`${header}\n${line.replace('12.34', '99.00')}\n`);
        expect((await f.request('admit', { importId: conflict.id })).status).toBe(409);
        const duplicateId = await f.importCsv(`${header}\n${line}\n${line}\n`);
        expect((await f.request('admit', { importId: duplicateId.id })).status).toBe(409);
        const noIds = await f.importCsv(
            `${header}\n${line.replace('example-1', '')}\n${line.replace('example-1', '')}\n`,
        );
        expect((await f.request('admit', { importId: noIds.id })).status).toBe(409);
        const other = await f.rpc<{ id: string }>('accountCreate', { label: 'Other card' });
        const otherImport = await f.importCsv(csv, other.id);
        await f.rpc('admit', { importId: otherImport.id });
        expect(await f.rpc('ledger', { accountId: other.id })).toHaveLength(2);
        const clean = await f.rpc<{ id: string }>('accountCreate', { label: 'No IDs' });
        const cleanImport = await f.importCsv(
            `${header}\n${line.replace('example-1', '')}\n${line.replace('example-1', '')}\n`,
            clean.id,
        );
        await f.rpc('admit', { importId: cleanImport.id });
        expect(await f.rpc('ledger', { accountId: clean.id })).toHaveLength(2);
        const ambiguous = await f.importCsv(`${header}\r\n${line.replace('example-1', '')}\r\n`, clean.id);
        expect((await f.request('admit', { importId: ambiguous.id })).status).toBe(409);
    });

    it('rolls back a mid-admission database failure and allows a clean retry', async () => {
        const f = await fixture();
        const review = await f.importCsv(
            `${header}\n${line}\n${line.replace('Example Merchant', 'ROLLBACK').replace('example-1', 'example-2')}\n`,
        );
        const db = new SQL(f.databaseUrl);
        try {
            await db.unsafe(
                "CREATE TRIGGER fail_admission BEFORE INSERT ON sentry_transactions WHEN NEW.merchant_raw = 'ROLLBACK' BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END",
            );
            expect((await f.request('admit', { importId: review.id })).status).toBe(500);
            expect(await f.rpc('ledger', { accountId: f.account.id })).toEqual([]);
            expect((await f.rpc<Review>('review', { importId: review.id })).state).toBe('needs_review');
            await db.unsafe('DROP TRIGGER fail_admission');
            await f.rpc('admit', { importId: review.id });
            expect(await f.rpc('ledger', { accountId: f.account.id })).toHaveLength(2);
        } finally {
            await db.close();
        }
    });

    it('authorizes before storage access and refuses browser origins and forged hosts without secret reflection', async () => {
        const f = await fixture();
        const logs: string[] = [];
        logger.info = (...args: unknown[]) => {
            logs.push(JSON.stringify(args));
        };
        logger.error = (...args: unknown[]) => {
            logs.push(JSON.stringify(args));
        };
        for (const headers of [
            { Authorization: '' },
            { Authorization: 'Bearer wrong' },
            { Origin: 'http://evil.invalid' },
            { Origin: 'null' },
            { Host: 'evil.invalid' },
        ]) {
            const res = await f.request('accountList', {}, headers);
            expect([401, 403]).toContain(res.status);
            expect(await res.text()).not.toContain(token);
        }
        await f.request('accountList', {}, { 'X-Request-Id': token });
        expect(logs.join('\n')).not.toContain(token);
        const disabled = createApp({ financial: { databaseUrl: f.databaseUrl, token: '' } });
        const response = await disabled.request('http://localhost/rpc/finance/accountList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ json: {} }),
        });
        expect(response.status).toBe(503);
        const volatile = createApp({ financial: { databaseUrl: 'sqlite::memory:', token } });
        expect(
            (
                await volatile.request('http://localhost/rpc/finance/accountList', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ json: {} }),
                })
            ).status,
        ).toBe(503);
    });

    it('refuses unsafe existing storage permissions rather than changing a shared parent', async () => {
        await mkdir('.spur/run/first-csv', { recursive: true });
        const root = await mkdtemp('.spur/run/first-csv/perms-');
        const parent = join(process.cwd(), root, 'shared');
        await mkdir(parent, { mode: 0o755 });
        await chmod(parent, 0o755);
        const app = createApp({ financial: { token, databaseUrl: `sqlite://${parent}/ledger.sqlite` } });
        const res = await app.request('http://localhost/rpc/finance/accountList', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({ json: {} }),
        });
        expect(res.status).toBe(503);
        expect((await stat(parent)).mode & 0o777).toBe(0o755);
    });
});
