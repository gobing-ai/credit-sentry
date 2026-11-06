#!/usr/bin/env bun
import { main } from './cli';

if (import.meta.main) {
    process.exitCode = await main(Bun.argv.slice(2));
}
