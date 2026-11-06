import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { SQL } from 'bun';
import { closeDb, createMigratedDatabase, createUser, db, findUserByEmail, type User } from '../src/index';

let database: SQL;

beforeEach(async () => {
    database = await createMigratedDatabase();
});

afterEach(async () => {
    await database.close();
    await closeDb();
});

describe('db', () => {
    it('memoizes the default SQL client', () => {
        expect(db()).toBe(db());
    });

    it('findUserByEmail returns the matching row', async () => {
        const created = await createUser('a@b.com', database);
        const user: User = { id: created.id, email: 'a@b.com' };
        await expect(findUserByEmail('a@b.com', database)).resolves.toEqual(user);
    });

    it('findUserByEmail returns undefined when no row matches', async () => {
        await expect(findUserByEmail('missing@b.com', database)).resolves.toBeUndefined();
    });

    it('createUser returns the inserted user', async () => {
        await expect(createUser('new@b.com', database)).resolves.toMatchObject({ id: 1, email: 'new@b.com' });
    });

    it('preserves the unique-email constraint', async () => {
        await createUser('same@b.com', database);
        await expect(createUser('same@b.com', database)).rejects.toThrow();
    });
});
