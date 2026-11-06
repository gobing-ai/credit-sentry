import { describe, expect, it } from 'bun:test';
import { PlanetSchema, planetContract } from '../../src/contracts/planet';

describe('planet contract', () => {
    it('exports PlanetSchema and planetContract', () => {
        expect(PlanetSchema).toBeDefined();
        expect(planetContract).toBeDefined();
    });
});
