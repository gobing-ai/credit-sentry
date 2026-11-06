import { type Candidate, CSV_FIELDS, type CsvValues, CsvValuesSchema, financeContract } from '@credit-sentry/api';
import { FinanceStorageError, type FinanceStore } from '@credit-sentry/db';
import { implement, ORPCError } from '@orpc/server';

/** The exact parser version stamped onto every reviewed statement. */
export const CSV_PARSER_VERSION = 'creditsentry-csv-v1';

/** Structurally invalid CSV that the import API must reject with a 400. */
export class CsvParseError extends Error {}

const AMOUNT_RE = /^-?\d+(\.\d{1,2})?$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INT64_MIN = -9223372036854775808n;
const INT64_MAX = 9223372036854775807n;
const KINDS = ['purchase', 'refund', 'payment', 'fee', 'interest'] as const;
const KIND_SET: ReadonlySet<string> = new Set(KINDS);
const KIND_SIGN: Record<(typeof KINDS)[number], 1 | -1> = {
    purchase: 1,
    fee: 1,
    interest: 1,
    refund: -1,
    payment: -1,
};

/**
 * Parse RFC 4180 CSV into raw records: quotes must wrap whole fields, "" escapes a quote,
 * delimiters and newlines inside quotes are literal, and stray quotes are structural errors.
 */
function parseCsvRecords(content: string): string[][] {
    const records: string[][] = [];
    let record: string[] = [];
    let field = '';
    let inQuotes = false;
    let quoteClosed = false;
    let started = false;
    const endField = () => {
        record.push(field);
        field = '';
        quoteClosed = false;
    };
    const endRecord = () => {
        endField();
        records.push(record);
        record = [];
        started = false;
    };
    for (let index = 0; index < content.length; index += 1) {
        const char = content[index];
        started = true;
        if (inQuotes) {
            if (char === '"') {
                if (content[index + 1] === '"') {
                    field += '"';
                    index += 1;
                } else {
                    inQuotes = false;
                    quoteClosed = true;
                }
            } else {
                field += char;
            }
        } else if (char === '"') {
            if (field.length > 0) throw new CsvParseError('CSV quote must wrap the entire field');
            inQuotes = true;
        } else if (char === ',') {
            endField();
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && content[index + 1] === '\n') index += 1;
            endRecord();
        } else if (quoteClosed) {
            throw new CsvParseError('CSV text after a closing quote must be a field delimiter or row end');
        } else {
            field += char;
        }
    }
    if (inQuotes) throw new CsvParseError('CSV quote is not terminated');
    if (started) endRecord();
    return records;
}

/** Exact decimal string → int64 minor units without any float rounding; null when invalid. */
function int64Minor(amount: string): bigint | null {
    if (!AMOUNT_RE.test(amount)) return null;
    const negative = amount.startsWith('-');
    const unsigned = negative ? amount.slice(1) : amount;
    const dot = unsigned.indexOf('.');
    const whole = dot === -1 ? unsigned : unsigned.slice(0, dot);
    const fraction = dot === -1 ? '' : unsigned.slice(dot + 1);
    const minor = BigInt(whole) * 100n + BigInt(`${fraction}00`.slice(0, 2));
    const signed = negative ? -minor : minor;
    return signed >= INT64_MIN && signed <= INT64_MAX ? signed : null;
}

/** Accept only real calendar dates (leap years included). */
function isCalendarDate(value: string): boolean {
    if (!DATE_RE.test(value)) return false;
    const [year = 0, month = 0, day = 0] = value.split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * Derive exact minor units and the issue list that gates admission. Never throws:
 * every semantic problem lands in `issues` so review can correct it.
 */
export function evaluateCandidate(values: CsvValues): { amountMinor: string | null; issues: string[] } {
    const issues: string[] = [];
    const minor = int64Minor(values.amount);
    const kind = KIND_SET.has(values.kind) ? (values.kind as (typeof KINDS)[number]) : null;
    if (!isCalendarDate(values.transaction_date)) issues.push('transaction_date must be a real calendar date');
    if (!isCalendarDate(values.posted_date)) issues.push('posted_date must be a real calendar date');
    if (!values.merchant.trim()) issues.push('merchant must not be empty');
    if (minor === null) issues.push('amount must be a plain decimal within int64 minor units');
    if (!kind) issues.push('kind must be purchase, refund, payment, fee, or interest');
    else if (minor !== null && (minor === 0n || (KIND_SIGN[kind] === 1 ? minor < 0n : minor > 0n))) {
        issues.push(`amount must be ${KIND_SIGN[kind] === 1 ? 'positive' : 'negative'} for ${kind}`);
    }
    if (values.currency !== 'USD') issues.push('currency must be USD');
    if (values.status !== 'posted' && values.status !== 'pending') issues.push('status must be posted or pending');
    return { amountMinor: minor === null ? null : minor.toString(), issues };
}

/** Parse CSV-v1 statement content into reviewable candidates with original evidence preserved. */
export function parseStatement(content: string): Candidate[] {
    const records = parseCsvRecords(content.replace(/^\uFEFF/, ''));
    const header = records[0];
    if (records.length < 2 || !header) {
        throw new CsvParseError('CSV statement needs a header row and at least one record');
    }
    if (header.length !== CSV_FIELDS.length || header.some((name, index) => name !== CSV_FIELDS[index])) {
        throw new CsvParseError(`CSV header must be exactly: ${CSV_FIELDS.join(',')}`);
    }
    const rows = records.slice(1);
    if (rows.length > 1000) throw new CsvParseError('CSV statement exceeds the 1000-row limit');
    return rows.map((row, index) => {
        if (row.length !== CSV_FIELDS.length) {
            throw new CsvParseError(`Row ${index + 1} must have exactly ${CSV_FIELDS.length} columns`);
        }
        const values = CsvValuesSchema.safeParse(Object.fromEntries(CSV_FIELDS.map((name, i) => [name, row[i]])));
        if (!values.success) throw new CsvParseError(`Row ${index + 1} field exceeds its allowed length`);
        const { amountMinor, issues } = evaluateCandidate(values.data);
        return { row: index + 1, original: values.data, values: values.data, amountMinor, issues };
    });
}

/** Rethrow storage failures as deliberate oRPC status codes; unexpected errors stay 500. */
function rethrowMapped(error: unknown): never {
    if (error instanceof FinanceStorageError) throw new ORPCError(error.code, { message: error.message });
    throw error instanceof Error ? error : new Error(String(error));
}

/** Build the finance oRPC router over a lazily-opened store (callers authorize before access). */
export function createFinanceRouter(getStore: () => Promise<FinanceStore>) {
    const os = implement(financeContract);
    const withStore = async <T>(fn: (store: FinanceStore) => Promise<T>): Promise<T> => fn(await getStore());

    return os.router({
        accountCreate: os.accountCreate.handler(async ({ input }) =>
            withStore((store) => store.createAccount(input.label)).catch(rethrowMapped),
        ),
        accountList: os.accountList.handler(async () =>
            withStore((store) => store.listAccounts()).catch(rethrowMapped),
        ),
        importCsv: os.importCsv.handler(async ({ input }) => {
            let rows: Candidate[];
            try {
                rows = parseStatement(input.content);
            } catch (error) {
                throw new ORPCError('BAD_REQUEST', {
                    message: error instanceof Error ? error.message : 'Malformed CSV statement',
                });
            }
            const contentHash = new Bun.CryptoHasher('sha256').update(input.content).digest('hex');
            return withStore((store) => store.importCandidates(input.accountId, contentHash, rows)).catch(
                rethrowMapped,
            );
        }),
        review: os.review.handler(async ({ input }) =>
            withStore((store) => store.review(input.importId)).catch(rethrowMapped),
        ),
        correct: os.correct.handler(async ({ input }) =>
            withStore((store) =>
                store.correct(input.importId, input.row, (candidate) => {
                    const values = { ...candidate.values, [input.field]: input.value };
                    const { amountMinor, issues } = evaluateCandidate(values);
                    return { row: candidate.row, original: candidate.original, values, amountMinor, issues };
                }),
            ).catch(rethrowMapped),
        ),
        admit: os.admit.handler(async ({ input }) =>
            withStore((store) => store.admit(input.importId)).catch(rethrowMapped),
        ),
        ledger: os.ledger.handler(async ({ input }) =>
            withStore((store) => store.ledger(input.accountId)).catch(rethrowMapped),
        ),
    });
}
