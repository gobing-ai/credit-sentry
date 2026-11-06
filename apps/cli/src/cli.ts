import { CSV_FIELDS } from '@credit-sentry/api';
import { getEnvVars, logger } from '@credit-sentry/utils';
import { file } from 'bun';
import { assertLoopbackApiUrl, createFinanceClient } from './finance-orpc';
import { orpc } from './orpc';

/** One CSV-v1 field name, derived from the contract's field list. */
type CsvField = (typeof CSV_FIELDS)[number];

// ── Typed CLI errors ──────────────────────────────────────────────

/** Base CLI error carrying an exit code. */
export class CliError extends Error {
    constructor(
        message: string,
        public readonly exitCode: number = 1,
    ) {
        super(message);
        this.name = 'CliError';
    }
}

/** An invalid, unknown, or unsupported command. */
export class InvalidCommandError extends CliError {
    constructor(command: string) {
        super(`Unknown command: ${command}`, 2);
        this.name = 'InvalidCommandError';
    }
}

/** An API call failed. */
export class ApiError extends CliError {
    constructor(message: string) {
        super(message, 3);
        this.name = 'ApiError';
    }
}

/** Normalize an unknown thrown value into a human-readable message. */
export function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

// ── Command runner ────────────────────────────────────────────────

/** Side-effect surface for a CLI command: print to stdout or stderr. */
export interface CommandOutput {
    info: (text: string) => void;
    error: (text: string) => void;
}

/** Injected dependencies for command handlers; tests substitute a side-effect-free context. */
export interface CliContext {
    cwd: string;
    env: NodeJS.ProcessEnv;
    output: CommandOutput;
    setExitCode: (code: number) => void;
}

/** Create the production CLI context; tests inject a side-effect-free context. */
export function createCliContext(): CliContext {
    return {
        cwd: process.cwd(),
        env: getEnvVars(),
        output: { info: (text) => logger.info(text), error: (text) => logger.error(text) },
        setExitCode: () => {},
    };
}

/** Run a CLI command (list or create) and print the formatted result. */
export async function run(args: string[], ctx: CliContext): Promise<void> {
    const cmd = args[0] ?? 'list';

    try {
        switch (cmd) {
            case 'list': {
                const planets = await orpc.list({});
                for (const p of planets) {
                    ctx.output.info(`${p.id}. ${p.name}`);
                }
                break;
            }
            case 'create': {
                const name = args[1] ?? 'Unknown';
                const planet = await orpc.create({ name });
                ctx.output.info(`Created: ${planet.id}. ${planet.name}`);
                break;
            }
            case 'account':
            case 'import':
            case 'review':
            case 'correct':
            case 'admit':
            case 'ledger':
                await runFinanceCommand(args, ctx);
                break;
            default:
                throw new InvalidCommandError(cmd);
        }
    } catch (error) {
        if (error instanceof CliError) throw error;
        throw new ApiError(errorMessage(error));
    }
}

/** Validate argument arity against a usage line; exit 2 before any request is made. */
function expectArgs(args: string[], count: number, usage: string): void {
    if (args.length !== count) throw new CliError(`Usage: ${usage}`, 2);
}

/**
 * Read a statement file for import: local size cap, strict UTF-8 decode, and readable-regular-file
 * checks all happen here so failures exit 2 before any network call.
 */
async function readStatementFile(path: string): Promise<string> {
    const statement = file(path);
    if (statement.size > 1024 * 1024) {
        throw new CliError(`Statement file exceeds the 1 MiB CSV-v1 limit: ${path}`, 2);
    }
    let bytes: ArrayBuffer;
    try {
        bytes = await statement.arrayBuffer();
    } catch {
        throw new CliError(`Cannot read statement file: ${path}`, 2);
    }
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
        throw new CliError(`Statement file must be valid UTF-8: ${path}`, 2);
    }
}

/** Financial commands: JSON output, loopback-only transport, bearer token from the env. */
async function runFinanceCommand(args: string[], ctx: CliContext): Promise<void> {
    const url = assertLoopbackApiUrl(ctx.env.API_URL);
    const token = ctx.env.CREDIT_SENTRY_TOKEN;
    if (!token) throw new CliError('CREDIT_SENTRY_TOKEN must be set for financial commands', 2);
    const client = createFinanceClient({ url, token });
    const [verb, ...rest] = args;
    const print = (value: unknown): void => ctx.output.info(JSON.stringify(value));

    switch (verb) {
        case 'account':
            if (rest[0] === 'create') {
                expectArgs(rest, 2, 'account create <label>');
                print(await client.accountCreate({ label: rest[1] as string }));
                return;
            }
            if (rest[0] === 'list') {
                expectArgs(rest, 1, 'account list');
                print(await client.accountList({}));
                return;
            }
            throw new CliError('Usage: account create <label> | account list', 2);
        case 'import': {
            expectArgs(args, 3, 'import <accountId> <file>');
            const content = await readStatementFile(rest[1] as string);
            print(await client.importCsv({ accountId: rest[0] as string, content }));
            return;
        }
        case 'review':
            expectArgs(args, 2, 'review <importId>');
            print(await client.review({ importId: rest[0] as string }));
            return;
        case 'correct': {
            expectArgs(args, 5, 'correct <importId> <row> <field> <value>');
            if (!/^\d+$/.test(rest[1] as string) || Number(rest[1]) < 1) {
                throw new CliError('row must be a positive integer', 2);
            }
            if (!(CSV_FIELDS as readonly string[]).includes(rest[2] as string)) {
                throw new CliError(`field must be one of: ${CSV_FIELDS.join(', ')}`, 2);
            }
            print(
                await client.correct({
                    importId: rest[0] as string,
                    row: Number(rest[1]),
                    field: rest[2] as CsvField,
                    value: rest[3] as string,
                }),
            );
            return;
        }
        case 'admit':
            expectArgs(args, 2, 'admit <importId>');
            print(await client.admit({ importId: rest[0] as string }));
            return;
        case 'ledger':
            expectArgs(args, 2, 'ledger <accountId>');
            print(await client.ledger({ accountId: rest[0] as string }));
            return;
        default:
            throw new CliError(`Unknown financial command: ${verb}`, 2);
    }
}

/** CLI entry point — reports errors and isolates exit-code mutation behind the context. */
export async function main(argv: string[], ctx: CliContext = createCliContext()): Promise<number> {
    try {
        await run(argv, ctx);
        return 0;
    } catch (err) {
        const exitCode = err instanceof CliError ? err.exitCode : 1;
        ctx.output.error(errorMessage(err));
        ctx.setExitCode(exitCode);
        return exitCode;
    }
}
