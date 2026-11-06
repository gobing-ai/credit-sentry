import { constants } from 'node:fs';
import { lstat, mkdir, open } from 'node:fs/promises';
import { dirname, isAbsolute } from 'node:path';
import type { Account, Candidate, LedgerTransaction, StatementReview } from '@credit-sentry/api';
import { SQL } from 'bun';

/** Safe storage failure that the financial API can expose without SQL or private values. */
export class FinanceStorageError extends Error {
    constructor(
        public readonly code: 'NOT_FOUND' | 'CONFLICT' | 'SERVICE_UNAVAILABLE',
        message: string,
    ) {
        super(message);
    }
}

/** Open a durable owner-private SQLite store and apply its versioned schema transactionally. */
export async function openFinanceDatabase(databaseUrl: string): Promise<SQL> {
    const path = databaseUrl.startsWith('sqlite://') ? databaseUrl.slice(9) : '';
    if (!isAbsolute(path) || path.split('/').includes('..') || /[?%#\0]/.test(path)) {
        throw new FinanceStorageError(
            'SERVICE_UNAVAILABLE',
            'Financial operations require an absolute file-backed SQLite URL',
        );
    }
    const directory = dirname(path);
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const parent = await lstat(directory);
    if (!parent.isDirectory() || parent.isSymbolicLink() || (parent.mode & 0o077) !== 0) {
        throw new FinanceStorageError('SERVICE_UNAVAILABLE', 'Financial data directory must be owner-private');
    }
    try {
        const file = await open(
            path,
            constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY | constants.O_NOFOLLOW,
            0o600,
        );
        await file.close();
    } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
    }
    const file = await lstat(path);
    if (!file.isFile() || file.isSymbolicLink() || (file.mode & 0o077) !== 0) {
        throw new FinanceStorageError(
            'SERVICE_UNAVAILABLE',
            'Financial database must be an owner-private regular file',
        );
    }
    const db = new SQL(databaseUrl);
    try {
        await db`PRAGMA foreign_keys = ON`;
        await db`PRAGMA busy_timeout = 5000`;
        await db.begin('IMMEDIATE', async (tx) => {
            await tx`CREATE TABLE IF NOT EXISTS sentry_migrations (version INTEGER PRIMARY KEY)`;
            const applied = await tx`SELECT version FROM sentry_migrations WHERE version = 1`;
            if (applied.length) return;
            await tx`CREATE TABLE sentry_accounts (id TEXT PRIMARY KEY, label TEXT NOT NULL)`;
            await tx`CREATE TABLE sentry_imports (
                id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES sentry_accounts(id),
                content_hash TEXT NOT NULL, state TEXT NOT NULL CHECK (state IN ('needs_review', 'admitted')),
                candidates TEXT NOT NULL, UNIQUE(account_id, content_hash), UNIQUE(id, account_id)
            )`;
            await tx`CREATE TABLE sentry_transactions (
                id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES sentry_accounts(id),
                transaction_date TEXT NOT NULL, posted_date TEXT NOT NULL,
                merchant_raw TEXT NOT NULL, merchant_key TEXT NOT NULL, amount_minor INTEGER NOT NULL,
                currency TEXT NOT NULL CHECK(currency = 'USD'), kind TEXT NOT NULL,
                posting_status TEXT NOT NULL, provider_id TEXT,
                UNIQUE(account_id, provider_id), UNIQUE(id, account_id)
            )`;
            await tx`CREATE TABLE sentry_observations (
                import_id TEXT NOT NULL, row_number INTEGER NOT NULL, transaction_id TEXT NOT NULL,
                account_id TEXT NOT NULL, PRIMARY KEY(import_id, row_number),
                FOREIGN KEY(import_id, account_id) REFERENCES sentry_imports(id, account_id),
                FOREIGN KEY(transaction_id, account_id) REFERENCES sentry_transactions(id, account_id)
            )`;
            await tx`CREATE INDEX sentry_transaction_account ON sentry_transactions(account_id)`;
            await tx`INSERT INTO sentry_migrations(version) VALUES(1)`;
        });
        return db;
    } catch (error) {
        await db.close();
        throw error;
    }
}

interface StoredImport {
    id: string;
    account_id: string;
    state: StatementReview['state'];
    candidates: string;
}

function reviewFromRow(row: StoredImport | undefined): StatementReview {
    if (!row) throw new FinanceStorageError('NOT_FOUND', 'Statement import not found');
    return {
        id: row.id,
        accountId: row.account_id,
        state: row.state,
        parserVersion: 'creditsentry-csv-v1',
        rows: JSON.parse(row.candidates) as Candidate[],
    };
}

/** Financial persistence operations; callers authorize before obtaining a store. */
export class FinanceStore {
    constructor(public readonly database: SQL) {}

    /** Create a local account with a new persistent identity. */
    async createAccount(label: string): Promise<Account> {
        return this.database.begin('IMMEDIATE', async (tx) => {
            const count = await tx`SELECT COUNT(*) AS n FROM sentry_accounts`;
            if (count[0].n >= 1000) throw new FinanceStorageError('CONFLICT', 'Local account limit reached');
            const account = { id: crypto.randomUUID(), label };
            await tx`INSERT INTO sentry_accounts(id,label) VALUES(${account.id},${label})`;
            return account;
        });
    }

    /** List the bounded local account set. */
    async listAccounts(): Promise<Account[]> {
        return this.database<Account[]>`SELECT id,label FROM sentry_accounts ORDER BY rowid`;
    }

    /** Check account identity before any account-scoped operation. */
    async requireAccount(accountId: string): Promise<void> {
        const accounts = await this.database`SELECT id FROM sentry_accounts WHERE id=${accountId}`;
        if (!accounts.length) throw new FinanceStorageError('NOT_FOUND', 'Account not found');
    }

    /** Persist candidates once per exact account/source identity, preserving existing corrections. */
    async importCandidates(accountId: string, contentHash: string, rows: Candidate[]): Promise<StatementReview> {
        await this.requireAccount(accountId);
        return this.database.begin('IMMEDIATE', async (tx) => {
            const existing = await tx<
                StoredImport[]
            >`SELECT * FROM sentry_imports WHERE account_id=${accountId} AND content_hash=${contentHash}`;
            if (existing[0]) return reviewFromRow(existing[0]);
            const id = crypto.randomUUID();
            await tx`INSERT INTO sentry_imports(id,account_id,content_hash,state,candidates)
                VALUES(${id},${accountId},${contentHash},'needs_review',${JSON.stringify(rows)})`;
            return { id, accountId, state: 'needs_review', parserVersion: 'creditsentry-csv-v1', rows };
        });
    }

    /** Read persisted candidate values and original evidence. */
    async review(importId: string): Promise<StatementReview> {
        const rows = await this.database<StoredImport[]>`SELECT * FROM sentry_imports WHERE id=${importId}`;
        return reviewFromRow(rows[0]);
    }

    /** Apply an authorized candidate edit under the same transaction that checks admission state. */
    async correct(
        importId: string,
        rowNumber: number,
        update: (candidate: Candidate) => Candidate,
    ): Promise<StatementReview> {
        return this.database.begin('IMMEDIATE', async (tx) => {
            const rows = await tx<StoredImport[]>`SELECT * FROM sentry_imports WHERE id=${importId}`;
            const review = reviewFromRow(rows[0]);
            if (review.state !== 'needs_review')
                throw new FinanceStorageError(
                    'CONFLICT',
                    'Admitted statements cannot be corrected in candidate review',
                );
            const candidate = review.rows[rowNumber - 1];
            if (!candidate) throw new FinanceStorageError('NOT_FOUND', 'Candidate row not found');
            review.rows[rowNumber - 1] = update(candidate);
            await tx`UPDATE sentry_imports SET candidates=${JSON.stringify(review.rows)} WHERE id=${importId}`;
            return review;
        });
    }

    /** Admit a complete reviewed statement atomically and return stable ledger identities. */
    async admit(importId: string): Promise<{ importId: string; count: number; transactionIds: string[] }> {
        return this.database.begin('IMMEDIATE', async (tx) => {
            const rows = await tx<StoredImport[]>`SELECT * FROM sentry_imports WHERE id=${importId}`;
            const review = reviewFromRow(rows[0]);
            if (review.state === 'admitted') {
                const links = await tx<
                    { transaction_id: string }[]
                >`SELECT transaction_id FROM sentry_observations WHERE import_id=${importId} ORDER BY row_number`;
                return { importId, count: links.length, transactionIds: links.map((r) => r.transaction_id) };
            }
            if (review.rows.some((row) => row.issues.length || row.amountMinor === null)) {
                throw new FinanceStorageError('CONFLICT', 'Resolve all candidate issues before admission');
            }
            const ids: string[] = [];
            const providers = new Set<string>();
            for (const candidate of review.rows) {
                const v = candidate.values;
                const key = v.merchant.trim().toLowerCase().replace(/\s+/g, ' ');
                let transactionId: string;
                const existing = v.transaction_id
                    ? await tx<LedgerTransaction[]>`SELECT id, transaction_date AS transactionDate,
                    posted_date AS postedDate, merchant_raw AS merchantRaw, CAST(amount_minor AS TEXT) AS amountMinor,
                    kind,posting_status AS status FROM sentry_transactions WHERE account_id=${review.accountId} AND provider_id=${v.transaction_id}`
                    : [];
                if (v.transaction_id && providers.has(v.transaction_id))
                    throw new FinanceStorageError('CONFLICT', 'Repeated provider transaction ID requires review');
                providers.add(v.transaction_id);
                if (existing[0]) {
                    const old = existing[0];
                    if (
                        old.transactionDate !== v.transaction_date ||
                        old.postedDate !== v.posted_date ||
                        old.merchantRaw !== v.merchant ||
                        old.amountMinor !== candidate.amountMinor ||
                        old.kind !== v.kind ||
                        old.status !== v.status
                    ) {
                        throw new FinanceStorageError(
                            'CONFLICT',
                            'Provider transaction conflicts with accepted history',
                        );
                    }
                    transactionId = old.id;
                } else {
                    if (!v.transaction_id) {
                        const ambiguous =
                            await tx`SELECT t.id FROM sentry_transactions t WHERE t.account_id=${review.accountId}
                            AND t.transaction_date=${v.transaction_date} AND t.merchant_key=${key} AND t.amount_minor=CAST(${candidate.amountMinor} AS INTEGER)
                            AND EXISTS(SELECT 1 FROM sentry_observations o WHERE o.transaction_id=t.id AND o.import_id<>${importId}) LIMIT 1`;
                        if (ambiguous.length)
                            throw new FinanceStorageError(
                                'CONFLICT',
                                'Overlapping transaction without a provider ID requires review',
                            );
                    }
                    const count =
                        await tx`SELECT COUNT(*) AS n FROM sentry_transactions WHERE account_id=${review.accountId}`;
                    if (count[0].n >= 10000) throw new FinanceStorageError('CONFLICT', 'Local ledger limit reached');
                    transactionId = crypto.randomUUID();
                    await tx`INSERT INTO sentry_transactions(id,account_id,transaction_date,posted_date,merchant_raw,merchant_key,amount_minor,currency,kind,posting_status,provider_id)
                        VALUES(${transactionId},${review.accountId},${v.transaction_date},${v.posted_date},${v.merchant},${key},CAST(${candidate.amountMinor} AS INTEGER),'USD',${v.kind},${v.status},${v.transaction_id || null})`;
                }
                await tx`INSERT INTO sentry_observations(import_id,row_number,transaction_id,account_id) VALUES(${importId},${candidate.row},${transactionId},${review.accountId})`;
                ids.push(transactionId);
            }
            await tx`UPDATE sentry_imports SET state='admitted' WHERE id=${importId}`;
            return { importId, count: ids.length, transactionIds: ids };
        });
    }

    /** List exact accepted values and all source observations for a single account. */
    async ledger(accountId: string): Promise<LedgerTransaction[]> {
        await this.requireAccount(accountId);
        const transactions = await this.database<
            Omit<LedgerTransaction, 'sources'>[]
        >`SELECT id, account_id AS accountId,
            transaction_date AS transactionDate, posted_date AS postedDate, merchant_raw AS merchantRaw,
            merchant_key AS merchantKey, CAST(amount_minor AS TEXT) AS amountMinor,currency,kind,posting_status AS status,
            COALESCE(provider_id,'') AS providerId FROM sentry_transactions WHERE account_id=${accountId} ORDER BY rowid`;
        const observations = await this.database<
            { transactionId: string; importId: string; row: number }[]
        >`SELECT transaction_id AS transactionId,
            import_id AS importId,row_number AS row FROM sentry_observations WHERE account_id=${accountId} ORDER BY rowid`;
        return transactions.map((row) => ({
            ...row,
            sources: observations
                .filter((o) => o.transactionId === row.id)
                .map(({ importId, row }) => ({ importId, row })),
        }));
    }
}
