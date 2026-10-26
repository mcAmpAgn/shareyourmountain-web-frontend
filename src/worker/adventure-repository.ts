import { and, desc, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/d1';
import type { D1Database } from '@cloudflare/workers-types';
import { adventures } from '../server/db/schema.js';
import type { AdventureRepository } from '../core/adventure-service.js';
export function createD1AdventureRepository(
  binding: D1Database,
  profileId: string,
): AdventureRepository {
  const db = drizzle(binding),
    owner = (id: string) => and(eq(adventures.id, id), eq(adventures.profileId, profileId));
  return {
    list: () =>
      db
        .select()
        .from(adventures)
        .where(eq(adventures.profileId, profileId))
        .orderBy(desc(adventures.createdAt))
        .all(),
    async create(input) {
      const target = and(
        eq(adventures.profileId, profileId),
        input.kind === 'mountain'
          ? eq(adventures.mountainId, input.targetId)
          : eq(adventures.routeId, input.targetId),
      );
      const previous = await db.select().from(adventures).where(target).get();
      if (previous) return previous;
      const now = new Date().toISOString();
      const created = await db
        .insert(adventures)
        .values({
          id: crypto.randomUUID(),
          profileId,
          mountainId: input.kind === 'mountain' ? input.targetId : null,
          routeId: input.kind === 'route' ? input.targetId : null,
          status: 'planned',
          completedAt: null,
          notes: '',
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning()
        .get();
      return created ?? (await db.select().from(adventures).where(target).get())!;
    },
    async update(id, input) {
      const now = new Date().toISOString();
      return db
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
    async remove(id) {
      const result = await db.delete(adventures).where(owner(id)).run();
      return result.meta.changes > 0;
    },
  };
}
