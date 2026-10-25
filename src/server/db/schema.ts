import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export * from './catalog-schema.js';
export const stoneTypes = sqliteTable('stone_types', { id: integer('id').primaryKey() });
export const profiles = sqliteTable('app_profiles', {
  id: text('id').primaryKey(),
  displayName: text('display_name').notNull(),
});
export const adventures = sqliteTable('adventures', {
  id: text('id').primaryKey(),
  profileId: text('profile_id').notNull(),
  mountainId: integer('mountain_id'),
  routeId: integer('route_id'),
  status: text('status', { enum: ['planned', 'completed'] }).notNull(),
  completedAt: text('completed_at'),
  notes: text('notes').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
