import { expect, it } from 'bun:test';
import { financeContract } from '../../src/contracts/finance';

it('exposes the additive reviewed financial workflow contract', () => {
    expect(Object.keys(financeContract).sort()).toEqual([
        'accountCreate',
        'accountList',
        'admit',
        'correct',
        'importCsv',
        'ledger',
        'review',
    ]);
});
