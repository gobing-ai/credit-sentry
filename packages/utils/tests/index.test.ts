import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { logger, setLoggerMuted, z } from '../src/index';

describe('utils', () => {
    it('re-exports zod', () => {
        expect(z.string().parse('hello')).toBe('hello');
    });
});

describe('logger', () => {
    let stdoutCalls: string[];
    let stderrCalls: string[];
    let origWrite: typeof Bun.write;

    beforeEach(() => {
        stdoutCalls = [];
        stderrCalls = [];
        origWrite = Bun.write;
        Bun.write = ((dest: unknown, data: Uint8Array) => {
            const text = new TextDecoder().decode(data);
            if (dest === Bun.stdout) stdoutCalls.push(text);
            if (dest === Bun.stderr) stderrCalls.push(text);
            return Promise.resolve(data.length);
        }) as typeof Bun.write;
    });

    afterEach(() => {
        Bun.write = origWrite;
        setLoggerMuted(undefined); // restore auto-mute for subsequent tests
    });

    // Bun test sets NODE_ENV=test, so the logger is auto-silenced and these
    // calls produce no output. The Bun.write mock would still capture any
    // output if muting were disabled.

    it('info writes nothing under bun test (muted by env)', () => {
        logger.info('hello');
        expect(stdoutCalls).toEqual([]);
    });

    it('error writes nothing under bun test (muted by env)', () => {
        logger.error('fail');
        expect(stderrCalls).toEqual([]);
    });

    it('warn writes nothing under bun test (muted by env)', () => {
        logger.warn('caution');
        expect(stderrCalls).toEqual([]);
    });

    // Verify the underlying write paths still function when muting is bypassed.
    // These use the test seam setLoggerMuted to opt out of the bun-test silence.

    it('info writes to Bun.stdout when not muted', () => {
        setLoggerMuted(false);
        logger.info('hello');
        expect(stdoutCalls).toEqual(['hello\n']);
    });

    it('error writes to Bun.stderr when not muted', () => {
        setLoggerMuted(false);
        logger.error('fail');
        expect(stderrCalls).toEqual(['fail\n']);
    });

    it('warn writes to Bun.stderr when not muted', () => {
        setLoggerMuted(false);
        logger.warn('caution');
        expect(stderrCalls).toEqual(['caution\n']);
    });

    it('re-mutes when setLoggerMuted(true) is called', () => {
        setLoggerMuted(false);
        setLoggerMuted(true);
        logger.info('silenced-again');
        expect(stdoutCalls).toEqual([]);
    });
});
