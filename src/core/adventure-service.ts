import type { Adventure, AdventureInput, AdventureUpdate } from '../shared/contracts.js';
import type { CatalogRepository } from './catalog-repository.js';
export class ApplicationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export interface AdventureRecord {
  id: string;
  profileId: string;
  mountainId: number | null;
  routeId: number | null;
  status: 'planned' | 'completed';
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
}
type Awaitable<T> = T | Promise<T>;
export interface AdventureRepository {
  list(): Awaitable<AdventureRecord[]>;
  create(input: AdventureInput): Awaitable<AdventureRecord>;
  update(id: string, input: AdventureUpdate): Awaitable<AdventureRecord | undefined>;
  remove(id: string): Awaitable<boolean>;
}
export function createAdventureService(
  repository: AdventureRepository,
  catalog: CatalogRepository,
) {
  const key = (row: AdventureRecord) => (row.routeId ? 'r-' + row.routeId : 'm-' + row.mountainId);
  async function toDTO(row: AdventureRecord): Promise<Adventure | null> {
    const item = await catalog.get(
      row.routeId ? 'route' : 'mountain',
      row.routeId ?? row.mountainId!,
    );
    return item
      ? {
          id: row.id,
          status: row.status,
          completedAt: row.completedAt,
          notes: row.notes,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          item,
        }
      : null;
  }
  return {
    async list(): Promise<Adventure[]> {
      const rows = await repository.list();
      const items = new Map(
        (await catalog.getByKeys(rows.map(key))).map((item) => [item.key, item]),
      );
      return rows.flatMap((row) => {
        const item = items.get(key(row));
        return item
          ? [
              {
                id: row.id,
                status: row.status,
                completedAt: row.completedAt,
                notes: row.notes,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                item,
              },
            ]
          : [];
      });
    },
    async create(input: AdventureInput) {
      if (!(await catalog.get(input.kind, input.targetId)))
        throw new ApplicationError(404, 'Questa meta non è disponibile.');
      return (await toDTO(await repository.create(input)))!;
    },
    async update(id: string, input: AdventureUpdate) {
      const row = await repository.update(id, input);
      if (!row) throw new ApplicationError(404, 'Avventura non trovata.');
      return toDTO(row);
    },
    async remove(id: string) {
      if (!(await repository.remove(id))) throw new ApplicationError(404, 'Avventura non trovata.');
    },
  };
}
