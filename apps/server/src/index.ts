import { config } from '@credit-sentry/config';
import { logger } from '@credit-sentry/utils';
import { createApp } from './app';

/** Options for starting the server. */
export interface StartServerOptions {
    /** Override the configured port. */
    port?: number;
    /** Override the hostname (defaults to localhost). */
    hostname?: string;
}

/** Injectable dependencies for `startServer` so tests can stub the Bun.serve seam. */
export interface ServerDeps {
    createApplication: typeof createApp;
    serve: typeof Bun.serve;
    log: (message: string) => void;
}

const defaultDeps: ServerDeps = {
    createApplication: createApp,
    serve: Bun.serve,
    log: (message) => logger.info(message),
};

/** Start the server with overridable options. Returns the Bun server instance. */
export function startServer(options: StartServerOptions = {}, deps: ServerDeps = defaultDeps) {
    const port = options.port ?? config.port;
    const app = deps.createApplication();

    const server = deps.serve({
        port,
        hostname: options.hostname,
        fetch: app.fetch,
    });

    deps.log(`Server running at http://${server.hostname}:${server.port}`);
    return server;
}

/** Default bootstrap — production entry point. */
export function main(deps: ServerDeps = defaultDeps, options: StartServerOptions = {}): ReturnType<typeof startServer> {
    return startServer(options, deps);
}

if (import.meta.main) {
    main();
}
