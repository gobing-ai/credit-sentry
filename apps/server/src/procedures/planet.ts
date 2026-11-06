import { findPlanetById, listPlanets, planetContract, storePlanet } from '@credit-sentry/api';
import { implement, ORPCError } from '@orpc/server';

const os = implement(planetContract);

/** oRPC procedure: list all planets. */
export const listPlanet = os.list.handler(async ({ input }) => listPlanets(input.cursor, input.limit ?? 10)).callable();

/** oRPC procedure: find a planet by id. */
export const findPlanet = os.find
    .handler(async ({ input }) => {
        const planet = findPlanetById(input.id);
        if (!planet) {
            throw new ORPCError('NOT_FOUND', { message: `Planet ${input.id} not found` });
        }
        return planet;
    })
    .callable();

/** oRPC procedure: create a new planet. */
export const createPlanet = os.create.handler(async ({ input }) => storePlanet(input)).callable();

/** Aggregated oRPC router for planet procedures. */
export const router = os.router({
    list: listPlanet,
    find: findPlanet,
    create: createPlanet,
});
