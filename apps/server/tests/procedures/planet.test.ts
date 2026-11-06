import { beforeEach, describe, expect, it } from 'bun:test';
import { resetPlanets } from '@credit-sentry/api';
import { createPlanet, findPlanet, listPlanet } from '../../src/procedures/planet';

describe('planet procedures', () => {
    beforeEach(() => {
        resetPlanets();
    });

    describe('createPlanet', () => {
        it('creates and returns a planet with auto-id', async () => {
            const planet = await createPlanet({ name: 'Earth' });
            expect(planet.id).toBe(1);
            expect(planet.name).toBe('Earth');
        });

        it('increments id for each subsequent planet', async () => {
            await createPlanet({ name: 'Earth' });
            const second = await createPlanet({ name: 'Mars', description: 'Red planet' });
            expect(second.id).toBe(2);
            expect(second.name).toBe('Mars');
            expect(second.description).toBe('Red planet');
        });
    });

    describe('listPlanet', () => {
        beforeEach(async () => {
            await createPlanet({ name: 'Earth' });
            await createPlanet({ name: 'Mars' });
        });

        it('returns all planets with default cursor', async () => {
            const planets = await listPlanet({});
            expect(planets).toHaveLength(2);
        });

        it('supports cursor-based pagination', async () => {
            const page = await listPlanet({ cursor: 1, limit: 1 });
            expect(page).toHaveLength(1);
            expect(page[0]?.name).toBe('Mars');
        });
    });

    describe('findPlanet', () => {
        beforeEach(async () => {
            await createPlanet({ name: 'Earth' });
        });

        it('returns the planet by id', async () => {
            const planet = await findPlanet({ id: 1 });
            expect(planet.name).toBe('Earth');
        });

        it('throws NOT_FOUND for unknown id', async () => {
            await expect(findPlanet({ id: 999 })).rejects.toThrow('Planet 999 not found');
        });
    });
});
