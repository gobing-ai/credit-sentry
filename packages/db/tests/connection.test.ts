import { afterEach, describe, expect, it } from 'bun:test';
import { IN_MEMORY_DATABASE_URL } from '@credit-sentry/config';
import { createMigratedDatabase, healthCheck, resetDb } from '../src/connection';

const databases: Awaited<ReturnType<typeof createMigratedDatabase>>[] = [];

afterEach(async () => {
    await Promise.all(databases.splice(0).map((database) => database.close()));
});

describe('database lifecycle', () => {
    it('creates, migrates, and health-checks an isolated in-memory database', async () => {
        const database = await createMigratedDatabase(IN_MEMORY_DATABASE_URL);
        databases.push(database);
        expect(await healthCheck(database)).toBe(true);
        const tables = await database`SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'`;
        expect(tables).toHaveLength(1);
    });

    it('resets test state by dropping and reapplying migrations', async () => {
        const database = await createMigratedDatabase(IN_MEMORY_DATABASE_URL);
        databases.push(database);
        await database`INSERT INTO users (email) VALUES (${'before@example.com'})`;
        await resetDb(database);
        const users = await database`SELECT * FROM users`;
        expect(users).toHaveLength(0);
    });
});
