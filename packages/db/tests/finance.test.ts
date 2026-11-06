import { describe, expect, it } from 'bun:test';
import { mkdir, mkdtemp, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { openFinanceDatabase } from '../src/finance';

describe('financial storage boundary', () => {
    it('requires an explicit durable private path and preserves migration history on reopening', async () => {
        await mkdir('.spur/run/first-csv', { recursive: true });
        const root = await mkdtemp('.spur/run/first-csv/storage-');
        const path = resolve(root, 'private', 'ledger.sqlite');
        const db = await openFinanceDatabase(`sqlite://${path}`);
        expect((await stat(path)).mode & 0o777).toBe(0o600);
        expect(await db`PRAGMA foreign_keys`).toEqual([{ foreign_keys: 1 }]);
        expect(await db`SELECT version FROM sentry_migrations`).toHaveLength(1);
        await db.close();
        const reopened = await openFinanceDatabase(`sqlite://${path}`);
        expect(await reopened`SELECT version FROM sentry_migrations`).toHaveLength(1);
        await reopened.close();
        for (const url of [
            '',
            'sqlite::memory:',
            'postgres://localhost/db',
            'sqlite:///tmp/../bad.db',
            'sqlite://relative/ledger.db',
        ]) {
            await expect(openFinanceDatabase(url)).rejects.toThrow();
        }
    });
});
