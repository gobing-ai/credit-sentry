import { describe, expect, it } from 'bun:test';
import { ApiError, CliError, InvalidCommandError } from '../src/cli';

describe('CliError hierarchy', () => {
    it('CliError stores message and exitCode', () => {
        const err = new CliError('something broke', 5);
        expect(err.message).toBe('something broke');
        expect(err.exitCode).toBe(5);
        expect(err.name).toBe('CliError');
    });

    it('InvalidCommandError has exit code 2', () => {
        const err = new InvalidCommandError('bogus');
        expect(err.message).toBe('Unknown command: bogus');
        expect(err.exitCode).toBe(2);
        expect(err).toBeInstanceOf(CliError);
    });

    it('ApiError has exit code 3', () => {
        const err = new ApiError('API call failed');
        expect(err.message).toBe('API call failed');
        expect(err.exitCode).toBe(3);
        expect(err).toBeInstanceOf(CliError);
    });
});
