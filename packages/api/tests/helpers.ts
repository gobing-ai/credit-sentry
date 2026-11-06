import type { Planet } from '../src';
import { PlanetSchema, planetContract } from '../src';

/** Create a minimal valid planet for tests. */
export function createTestPlanet(overrides: Partial<Planet> = {}): Planet {
    return {
        id: overrides.id ?? 1,
        name: overrides.name ?? 'Test Planet',
        ...overrides,
    };
}

/** Create an array of N test planets with sequential ids. */
export function createTestPlanets(count: number, namePrefix = 'Planet'): Planet[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `${namePrefix} ${i + 1}`,
    }));
}

/** Re-export commonly used test dependencies. */
export { PlanetSchema, planetContract };
