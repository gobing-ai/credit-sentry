import { z } from '@credit-sentry/utils';
import { oc } from '@orpc/contract';

/** Supported CreditSentry CSV-v1 field names. */
export const CSV_FIELDS = [
    'transaction_date',
    'posted_date',
    'merchant',
    'amount',
    'currency',
    'kind',
    'status',
    'transaction_id',
] as const;

/** Original or user-edited fields of one source record. */
export const CsvValuesSchema = z
    .object({
        transaction_date: z.string().max(100),
        posted_date: z.string().max(100),
        merchant: z.string().max(1000),
        amount: z.string().max(100),
        currency: z.string().max(100),
        kind: z.string().max(100),
        status: z.string().max(100),
        transaction_id: z.string().max(200),
    })
    .strict();

/** CSV-v1 source field values. */
export type CsvValues = z.infer<typeof CsvValuesSchema>;

/** Reviewable candidate retains immutable evidence separately from editable values. */
export const CandidateSchema = z.object({
    row: z.number().int().positive(),
    original: CsvValuesSchema,
    values: CsvValuesSchema,
    amountMinor: z
        .string()
        .regex(/^-?\d+$/)
        .nullable(),
    issues: z.array(z.string()),
});

/** Candidate before ledger admission. */
export type Candidate = z.infer<typeof CandidateSchema>;

/** Local account identity, unrelated to a card's last four digits. */
export const AccountSchema = z.object({ id: z.string(), label: z.string() });

/** Local account DTO. */
export type Account = z.infer<typeof AccountSchema>;

/** Persisted statement review. */
export const StatementReviewSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    state: z.enum(['needs_review', 'admitted']),
    parserVersion: z.literal('creditsentry-csv-v1'),
    rows: z.array(CandidateSchema).max(1000),
});

/** Statement review DTO. */
export type StatementReview = z.infer<typeof StatementReviewSchema>;

/** Accepted transaction and every linked source observation. */
export const LedgerTransactionSchema = z.object({
    id: z.string(),
    accountId: z.string(),
    transactionDate: z.string(),
    postedDate: z.string(),
    merchantRaw: z.string(),
    merchantKey: z.string(),
    amountMinor: z.string().regex(/^-?\d+$/),
    currency: z.literal('USD'),
    kind: z.enum(['purchase', 'refund', 'payment', 'fee', 'interest']),
    status: z.enum(['posted', 'pending']),
    providerId: z.string(),
    sources: z.array(z.object({ importId: z.string(), row: z.number().int().positive() })),
});

/** Accepted transaction DTO. */
export type LedgerTransaction = z.infer<typeof LedgerTransactionSchema>;

const id = z.string().min(1).max(128);
const importIdInput = z.object({ importId: id }).strict();
const accountIdInput = z.object({ accountId: id }).strict();

/** Additive local-finance oRPC contract; the server authorizes every operation. */
export const financeContract = {
    accountCreate: oc.input(z.object({ label: z.string().trim().min(1).max(100) }).strict()).output(AccountSchema),
    accountList: oc.input(z.object({}).strict()).output(z.array(AccountSchema).max(1000)),
    importCsv: oc
        .input(z.object({ accountId: id, content: z.string().max(1024 * 1024) }).strict())
        .output(StatementReviewSchema),
    review: oc.input(importIdInput).output(StatementReviewSchema),
    correct: oc
        .input(
            z
                .object({
                    importId: id,
                    row: z.number().int().positive().max(1000),
                    field: z.enum(CSV_FIELDS),
                    value: z.string().max(1000),
                })
                .strict(),
        )
        .output(StatementReviewSchema),
    admit: oc
        .input(importIdInput)
        .output(z.object({ importId: id, count: z.number().int(), transactionIds: z.array(id) })),
    ledger: oc.input(accountIdInput).output(z.array(LedgerTransactionSchema).max(10000)),
};
