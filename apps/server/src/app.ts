import { timingSafeEqual } from 'node:crypto';
import { FinanceStore, openFinanceDatabase } from '@credit-sentry/db';
import { getEnvVar, logger } from '@credit-sentry/utils';
import { ORPCError, onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { createFinanceRouter } from './procedures/finance';
import { router } from './procedures/planet';

/** Local finance capability credentials handed to the server. */
export interface FinancialOptions {
    /** Bearer token every finance request must present. Empty disables finance entirely. */
    token: string;
    /** Absolute file-backed SQLite URL for the owner-private ledger. */
    databaseUrl: string;
}

/** Options for {@link createApp}. */
export interface AppOptions {
    /** Finance capability; omitted → derived from CREDIT_SENTRY_TOKEN + DATABASE_URL env. */
    financial?: FinancialOptions;
}

/** Finance is enabled only when both credentials are present in the environment (ADR-007 gateway). */
function financialFromEnv(): FinancialOptions | undefined {
    const token = getEnvVar('CREDIT_SENTRY_TOKEN');
    const databaseUrl = getEnvVar('DATABASE_URL');
    return token && databaseUrl ? { token, databaseUrl } : undefined;
}

/** S4: Request-id middleware — assign or propagate an X-Request-Id header. */
async function requestId(c: Context, next: Next): Promise<void> {
    const id = c.req.header('X-Request-Id') ?? crypto.randomUUID();
    c.set('requestId', id);
    await next();
    c.header('X-Request-Id', id);
}

/** S4: Request-timing logger. */
async function timing(c: Context, next: Next): Promise<void> {
    const start = Date.now();
    await next();
    const ms = Date.now() - start;
    logger.info({ method: c.req.method, path: c.req.path, status: c.res.status, ms, requestId: c.get('requestId') });
}

/** S4: Global unexpected-error catcher. Exported for direct testing. */
export function errorHandler(err: Error, c: Context): Response {
    // Never intercept ORPCErrors — they carry intended status codes and are
    // part of the API contract. Let them fall through to the oRPC handler.
    if (err instanceof ORPCError) throw err;
    logger.error({ name: err.name, message: err.message, requestId: c.get('requestId') });
    return c.json({ error: 'Internal Server Error' }, 500);
}

/** Build the Hono application with middleware and oRPC routes. */
export function createApp(options: AppOptions = {}): Hono {
    const app = new Hono();
    app.onError(errorHandler);

    const financial = options.financial ?? financialFromEnv();
    if (financial) mountFinance(app, financial);

    app.use('*', requestId);
    app.use('*', timing);

    // Health check — vanilla Hono route.
    app.get('/health', (c) => c.json({ status: 'ok' }));

    // oRPC handler — all contracts served under /rpc.
    // ORPCErrors are deliberate, status-coded responses (e.g. NOT_FOUND → 404)
    // and part of the API contract. Only log unexpected errors.
    const handler = new RPCHandler(router, {
        interceptors: [
            onError((error) => {
                if (error instanceof ORPCError) return;
                logger.error(
                    error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) },
                );
            }),
        ],
    });

    app.use('/rpc/*', async (c, next) => {
        const { matched, response } = await handler.handle(c.req.raw, {
            prefix: '/rpc',
            context: {},
        });
        if (matched) return c.newResponse(response.body, response);
        await next();
    });

    return app;
}

/**
 * Mount local finance RPC under /rpc/finance. Registered BEFORE the global requestId/timing
 * middleware on purpose: the finance handler always returns its own response, so client-supplied
 * headers (e.g. X-Request-Id) can never flow into finance logs — no secret reflection.
 */
function mountFinance(app: Hono, financial: FinancialOptions): void {
    let opening: Promise<FinanceStore> | null = null;
    const getStore = (): Promise<FinanceStore> => {
        opening ??= openFinanceDatabase(financial.databaseUrl)
            .then((database) => new FinanceStore(database))
            .catch((error) => {
                opening = null;
                throw error;
            });
        return opening;
    };
    const handler = new RPCHandler(createFinanceRouter(getStore), {
        interceptors: [
            onError((error) => {
                if (error instanceof ORPCError) return;
                logger.error(
                    error instanceof Error ? { name: error.name, message: error.message } : { error: String(error) },
                );
            }),
        ],
    });
    const expectedAuthorization = new TextEncoder().encode(`Bearer ${financial.token}`);

    app.on(
        'POST',
        '/rpc/finance/*',
        // Own 413 response — the default HTTPException would land in the app-level 500 handler.
        bodyLimit({
            maxSize: 2 * 1024 * 1024,
            onError: (c) => c.json({ error: 'Request body exceeds the limit' }, 413),
        }),
        async (c) => {
            // Disabled capability → service unavailable before any auth or storage work.
            if (!financial.token) return c.json({ error: 'Financial operations are disabled' }, 503);
            // Bearer check is timing-safe and never reflects the token back.
            const presented = new TextEncoder().encode(c.req.header('authorization') ?? '');
            const authorized =
                presented.length === expectedAuthorization.length && timingSafeEqual(presented, expectedAuthorization);
            if (!authorized) return c.json({ error: 'Missing or invalid bearer credentials' }, 401);
            // CLI/server-to-server only: browsers announce an Origin, non-loopback Hosts are untrusted.
            if (c.req.header('origin') !== undefined) return c.json({ error: 'Browser origins are refused' }, 403);
            // app.request-style callers carry no Host header; fall back to the request URL hostname.
            const host = (c.req.header('host') ?? new URL(c.req.url).hostname).replace(/:\d+$/, '').toLowerCase();
            if (!['localhost', '127.0.0.1', '[::1]'].includes(host)) {
                return c.json({ error: 'Non-loopback host is refused' }, 403);
            }
            // Storage opens lazily so configuration failures surface as 503, never boot crashes.
            try {
                await getStore();
            } catch {
                return c.json({ error: 'Financial storage is unavailable' }, 503);
            }
            const { matched, response } = await handler.handle(c.req.raw, {
                prefix: '/rpc/finance',
                context: {},
            });
            if (matched) return c.newResponse(response.body, response);
            return c.json({ error: 'Finance procedure not found' }, 404);
        },
    );
}

/** Default singleton — the production Hono app. */
export const app = createApp();
