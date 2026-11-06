import type { Planet } from '../contracts/planet';

// In-memory store for demo / test. Swap in a real DB in production.
const planets: Planet[] = [];
let idCounter = 0;

function nextId(): number {
    idCounter += 1;
    return idCounter;
}

/** Reset the in-memory planet store (test-only). */
export function resetPlanets(): void {
    planets.length = 0;
    idCounter = 0;
}

/** Create a planet and return the stored record. */
export function storePlanet(input: Omit<Planet, 'id'>): Planet {
    const planet: Planet = { id: nextId(), ...input };
    planets.push(planet);
    return planet;
}

/** List planets with cursor-based pagination. */
export function listPlanets(cursor: number, limit: number): Planet[] {
    return planets.slice(cursor, cursor + limit);
}

/** Find a planet by id, or return undefined. */
export function findPlanetById(id: number): Planet | undefined {
    return planets.find((p) => p.id === id);
}
