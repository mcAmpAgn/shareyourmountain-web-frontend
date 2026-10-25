import type { Adventure, AdventureInput, AdventureUpdate } from '../../shared/contracts.js';
import type { createAdventureRepository } from '../repositories/adventure-repository.js';
import type { CatalogRepository } from '../repositories/catalog-repository.js';
export class ApplicationError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function createAdventureService(
  repository: ReturnType<typeof createAdventureRepository>,
  catalog: CatalogRepository,
) {
  function toDTO(row: ReturnType<typeof repository.list>[number]): Adventure | null {
    const item = catalog.get(row.routeId ? 'route' : 'mountain', row.routeId ?? row.mountainId!);
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
    list: () =>
      repository
        .list()
        .map(toDTO)
        .filter((a): a is Adventure => a !== null),
    create(input: AdventureInput) {
      if (!catalog.get(input.kind, input.targetId))
        throw new ApplicationError(404, 'Questa meta non è disponibile.');
      return toDTO(repository.create(input))!;
    },
    update(id: string, input: AdventureUpdate) {
      const result = repository.update(id, input);
      if (!result) throw new ApplicationError(404, 'Avventura non trovata.');
      return toDTO(result);
    },
    remove(id: string) {
      if (!repository.remove(id)) throw new ApplicationError(404, 'Avventura non trovata.');
    },
  };
}
