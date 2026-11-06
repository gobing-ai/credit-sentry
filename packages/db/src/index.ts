import type { SQL } from 'bun';
import {
    closeDb,
    createDatabase,
    createMigratedDatabase,
    db,
    healthCheck,
    migrateDatabase,
    resetDb,
} from './connection';

/** A user row from the database. */
export interface User {
    id: number;
    email: string;
}

export { closeDb, createDatabase, createMigratedDatabase, db, healthCheck, migrateDatabase, resetDb };

/** Find a user by email address. */
export async function findUserByEmail(email: string, database: SQL = db()): Promise<User | undefined> {
    const rows = await database<User[]>`SELECT id, email FROM users WHERE email = ${email} LIMIT 1`;
    return rows[0];
}

/** Create a new user and return the inserted row. */
export async function createUser(email: string, database: SQL = db()): Promise<User> {
    const [user] = await database<User[]>`INSERT INTO users ${database({ email })} RETURNING id, email`;
    if (!user) {
        throw new Error('insert returned no row');
    }
    return user;
}
