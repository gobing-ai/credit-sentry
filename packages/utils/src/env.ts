/** Process-environment record shape returned by {@link getEnvVars}. */
export type EnvRecord = Record<string, string | undefined>;

/**
 * The single sanctioned process-env gateway (spur `env-var-hygiene`). Lives in utils
 * because it is the base package, so config/db/apps can all route through it
 * without a dependency cycle. Returns the live record, not a copy.
 */
export function getEnvVars(): EnvRecord {
    return process.env;
}

/** Read one environment variable; `undefined` when unset. */
export function getEnvVar(name: string): string | undefined {
    return process.env[name];
}
