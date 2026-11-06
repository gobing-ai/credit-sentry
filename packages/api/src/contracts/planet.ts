import { z } from '@credit-sentry/utils';
import { oc } from '@orpc/contract';

/** Zod schema for a planet object. */
export const PlanetSchema = z.object({
    id: z.number().int().min(1),
    name: z.string(),
    description: z.string().optional(),
});

/** oRPC contract: list planets. */
export const listPlanet = oc
    .input(
        z.object({
            limit: z.number().int().min(1).max(100).optional(),
            cursor: z.number().int().min(0).default(0),
        }),
    )
    .output(z.array(PlanetSchema));

/** oRPC contract: find a planet by id. */
export const findPlanet = oc.input(PlanetSchema.pick({ id: true })).output(PlanetSchema);

/** oRPC contract: create a planet. */
export const createPlanet = oc.input(PlanetSchema.omit({ id: true })).output(PlanetSchema);

/** Inferred planet type from the Zod schema. */
export type Planet = z.infer<typeof PlanetSchema>;

/** Aggregated planet oRPC contract. */
export const planetContract = {
    list: listPlanet,
    find: findPlanet,
    create: createPlanet,
};
