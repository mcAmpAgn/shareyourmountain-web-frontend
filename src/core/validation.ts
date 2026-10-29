import { z } from 'zod';
export const galleryQuery = z
  .object({ provider: z.enum(['commons', 'instagram']).default('commons') })
  .strict();
export const signInQuery = z
  .object({
    kind: z.enum(['mountain', 'route']).optional(),
    targetId: z.coerce.number().int().positive().max(2147483647).optional(),
    resume: z.literal('1').optional(),
  })
  .strict()
  .refine(
    (v) => !!v.kind === !!v.targetId && (!v.resume || !!v.kind),
    'Invalid sign-in destination',
  );
const id = z.coerce.number().int().positive().max(2147483647);
export const catalogQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    kind: z.enum(['mountain', 'route']).optional(),
    activityId: id.optional(),
    rangeId: id.optional(),
    countryId: id.optional(),
    regionId: id.optional(),
    mountainId: id.optional(),
    minElevation: z.coerce.number().min(-500).max(9000).optional(),
    sort: z.enum(['name', 'elevation']).optional(),
    page: z.coerce.number().int().min(1).max(100000).optional(),
    pageSize: z.coerce.number().int().min(1).max(50).optional(),
  })
  .strict();
export const catalogId = id;
export const suggestionQuery = catalogQuery
  .pick({ q: true, kind: true, activityId: true })
  .extend({ q: z.string().trim().min(2).max(120) });
export const adventureId = z.uuid();
export const adventureCreate = z
  .object({ kind: z.enum(['mountain', 'route']), targetId: id })
  .strict();
export const adventureUpdate = z
  .object({
    status: z.enum(['planned', 'completed']).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'Provide a change');
export const mapQuery = z
  .object({
    bbox: z
      .string()
      .max(100)
      .transform((v) => v.split(',').map(Number))
      .refine(
        (v) =>
          v.length === 4 &&
          v.every(Number.isFinite) &&
          v[0] >= -180 &&
          v[2] <= 180 &&
          v[1] >= -90 &&
          v[3] <= 90 &&
          v[0] <= v[2] &&
          v[1] <= v[3],
        'Invalid bounding box',
      ),
    minElevation: z.coerce.number().min(-500).max(9000).default(0),
  })
  .strict();
