import { and, desc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { AppDatabase } from '../db/connection.js';
import { adventures } from '../db/schema.js';
import type { AdventureInput, AdventureUpdate } from '../../shared/contracts.js';
export const localProfileId = 'local';
export function createAdventureRepository(db: AppDatabase) {
  const owner = (id: string) =>
    and(eq(adventures.id, id), eq(adventures.profileId, localProfileId));
  return {
    list: () =>
      db.orm
        .select()
        .from(adventures)
        .where(eq(adventures.profileId, localProfileId))
        .orderBy(desc(adventures.createdAt))
        .all(),
    create(input: AdventureInput) {
      const existing = db.orm
        .select()
        .from(adventures)
        .where(
          and(
            eq(adventures.profileId, localProfileId),
            input.kind === 'mountain'
              ? eq(adventures.mountainId, input.targetId)
              : eq(adventures.routeId, input.targetId),
          ),
        )
        .get();
      if (existing) return existing;
      const now = new Date().toISOString();
      return db.orm
        .insert(adventures)
        .values({
          id: randomUUID(),
          profileId: localProfileId,
          mountainId: input.kind === 'mountain' ? input.targetId : null,
          routeId: input.kind === 'route' ? input.targetId : null,
          status: 'planned',
          completedAt: null,
          notes: '',
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    },
    update(id: string, input: AdventureUpdate) {
      const now = new Date().toISOString();
      return db.orm
        .update(adventures)
        .set({
          ...input,
          ...(input.status ? { completedAt: input.status === 'completed' ? now : null } : {}),
          updatedAt: now,
        })
        .where(owner(id))
        .returning()
        .get();
    },
    remove: (id: string) => db.orm.delete(adventures).where(owner(id)).run().changes > 0,
  };
}
