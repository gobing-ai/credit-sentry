import { getEnvVars, logger } from '@credit-sentry/utils';
import { orpc } from './orpc';

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
            default:
                throw new InvalidCommandError(cmd);
        }
    } catch (error) {
        if (error instanceof CliError) throw error;
        throw new ApiError(errorMessage(error));
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
