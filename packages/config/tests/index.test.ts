import { describe, expect, it } from 'bun:test';
import { IN_MEMORY_DATABASE_URL, loadConfig } from '../src/index';

describe('loadConfig', () => {
    it('defaults to port 3000 when PORT is unset', () => {
        expect(loadConfig({}).port).toBe(3000);
    });

    it('reads the PORT environment variable', () => {
        expect(loadConfig({ PORT: '8080' }).port).toBe(8080);
    });

    it('centralizes the default and configured database URL', () => {
        expect(loadConfig({}).databaseUrl).toBe(IN_MEMORY_DATABASE_URL);
        expect(loadConfig({ DATABASE_URL: 'sqlite://data/app.db' }).databaseUrl).toBe('sqlite://data/app.db');
    });
});
