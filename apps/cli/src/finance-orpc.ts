// Finance CLI client. Kept separate from orpc.ts because finance traffic carries a bearer
// token and therefore needs stricter transport rules: loopback-only URLs and redirects refused.

import type { financeContract } from '@credit-sentry/api';
import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithTimeout } from '@credit-sentry/utils';
import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import type { ContractRouterClient } from '@orpc/contract';
import { CliError } from './cli';

/** Typed finance oRPC client. */
export type FinanceClient = ContractRouterClient<typeof financeContract>;

/** The only hosts a finance client may talk to. */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Restrict finance API calls to plain loopback HTTP URLs: no TLS, no credentials,
 * no query or hash, no lookalike hosts — anything else risks exfiltrating the token.
 */
export function assertLoopbackApiUrl(rawUrl: string | undefined): string {
    const url = rawUrl?.trim() ? rawUrl.trim() : 'http://localhost:3000/rpc';
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new CliError(`API_URL must be a valid URL; got: ${url}`, 2);
    }
    const plain =
        parsed.protocol === 'http:' &&
        LOOPBACK_HOSTS.has(parsed.hostname.toLowerCase()) &&
        !parsed.username &&
        !parsed.password &&
        !parsed.search &&
        !parsed.hash;
    if (!plain) {
        throw new CliError(
            `API_URL must be a plain loopback HTTP URL (http://localhost or http://127.0.0.1) without credentials, query, or hash; got: ${url}`,
            2,
        );
    }
    return url;
}

/** Create a finance client that presents the bearer token and refuses redirect responses. */
export function createFinanceClient(deps: { url: string; token: string }): FinanceClient {
    const link = new RPCLink({
        // Finance procedures live one level under the shared API root: <API_URL>/finance/<method>.
        url: new URL('finance', `${deps.url}/`).toString(),
        fetch: (request, init) => {
            // redirect:'error' — a redirect must never relay finance traffic (or its token) elsewhere.
            const headers = new Headers(request.headers);
            headers.set('authorization', `Bearer ${deps.token}`);
            return fetchWithTimeout(
                globalThis.fetch,
                request,
                { ...init, headers, redirect: 'error' },
                DEFAULT_REQUEST_TIMEOUT_MS,
            );
        },
    });
    return createORPCClient(link);
}
