import { logger } from '@credit-sentry/utils';
import { ORPCError, onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import type { Context, Next } from 'hono';
import { Hono } from 'hono';
import { router } from './procedures/planet';

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
export function createApp(): Hono {
    const app = new Hono();

    app.use('*', requestId);
    app.use('*', timing);
    app.onError(errorHandler);

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

/** Default singleton — the production Hono app. */
export const app = createApp();
