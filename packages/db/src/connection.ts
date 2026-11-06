import { DEFAULT_DATABASE_URL, getEnvVar } from '@credit-sentry/config';
import { SQL } from 'bun';

let client: SQL | undefined;

/** Create an isolated database connection without mutating the shared singleton. */
export function createDatabase(databaseUrl = DEFAULT_DATABASE_URL): SQL {
    return new SQL(databaseUrl);
}

/** Typed SQL query helper for the database connection. */
export function db(): SQL {
    client ??= createDatabase(getEnvVar('DATABASE_URL') ?? DEFAULT_DATABASE_URL);
    return client;
}

/** Apply the current schema migration to a database. Idempotent for scaffold use. */
export async function migrateDatabase(database: SQL = db()): Promise<void> {
    await database`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE
        )
    `;
}

/** Create an isolated connection and migrate it before returning. */
export async function createMigratedDatabase(databaseUrl = DEFAULT_DATABASE_URL): Promise<SQL> {
    const database = createDatabase(databaseUrl);
    try {
        await migrateDatabase(database);
        return database;
    } catch (error) {
        await database.close();
        throw error;
    }
}

/** Health check — ping the database. */
export async function healthCheck(database: SQL = db()): Promise<boolean> {
    try {
        const result = await database`SELECT 1 AS ok`;
        return result[0]?.ok === 1;
    } catch {
        return false;
    }
}

/** Reset an isolated/test database — drop and reapply migrations. */
export async function resetDb(database: SQL = db()): Promise<void> {
    await database`DROP TABLE IF EXISTS users`;
    await migrateDatabase(database);
}

/** Close the database connection and clear the cached client. */
export async function closeDb(): Promise<void> {
    if (client) {
        await client.close();
        client = undefined;
    }
}
