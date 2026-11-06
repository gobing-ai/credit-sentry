import { beforeEach, describe, expect, it } from 'bun:test';
import { findPlanetById, listPlanets, resetPlanets, storePlanet } from '../../src/stores/planet';

describe('planet store', () => {
    beforeEach(() => {
        resetPlanets();
    });

    describe('storePlanet', () => {
        it('stores and returns a planet with auto-incremented id', () => {
            const planet = storePlanet({ name: 'Earth' });
            expect(planet.id).toBe(1);
            expect(planet.name).toBe('Earth');
        });

        it('increments id for each subsequent planet', () => {
            storePlanet({ name: 'Earth' });
            const second = storePlanet({ name: 'Mars', description: 'Red' });
            expect(second.id).toBe(2);
            expect(second.description).toBe('Red');
        });
    });

    describe('listPlanets', () => {
        it('returns empty array for empty store', () => {
            expect(listPlanets(0, 10)).toEqual([]);
        });

        it('supports cursor-based pagination', () => {
            storePlanet({ name: 'Earth' });
            storePlanet({ name: 'Mars' });
            expect(listPlanets(1, 1)).toHaveLength(1);
            expect(listPlanets(0, 2)).toHaveLength(2);
        });
    });

    describe('findPlanetById', () => {
        it('returns the planet when found', () => {
            storePlanet({ name: 'Earth' });
            expect(findPlanetById(1)?.name).toBe('Earth');
        });

        it('returns undefined for unknown id', () => {
            expect(findPlanetById(999)).toBeUndefined();
        });
    });

    describe('resetPlanets', () => {
        it('clears all planets and resets id counter', () => {
            storePlanet({ name: 'Earth' });
            resetPlanets();
            expect(listPlanets(0, 10)).toEqual([]);
            const fresh = storePlanet({ name: 'Mars' });
            expect(fresh.id).toBe(1);
        });
    });
});
