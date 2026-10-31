import type { Classification } from '../../shared/contracts';
export interface ClassificationRow {
  id: number;
  name: string;
  kind: 'range' | 'group';
  path: string[];
  ancestors: number[];
  alpine: boolean;
  level: string;
}
const normalize = (value: string) =>
  value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('it');
/** Keep the source hierarchy; never infer missing official SOIUSA codes. */
export function classificationRows(data: Classification): ClassificationRow[] {
  const ranges = new Map(data.ranges.map((r) => [r.id, r]));
  function lineage(id: number | null) {
    const result: Classification['ranges'] = [],
      seen = new Set<number>();
    while (id != null && !seen.has(id)) {
      seen.add(id);
      const range = ranges.get(id);
      if (!range) break;
      result.unshift(range);
      id = range.parentId;
    }
    return result;
  }
  const rows: ClassificationRow[] = data.ranges.map((r) => {
    const chain = lineage(r.id),
      alpine = chain[0]?.name.trim().toLowerCase() === 'alpi';
    return {
      id: r.id,
      name: r.name,
      kind: 'range',
      path: chain.slice(0, -1).map((x) => x.name),
      ancestors: chain.map((x) => x.id),
      alpine,
      level:
        alpine && chain.length === 2
          ? 'Sezione'
          : alpine && chain.length === 3
            ? 'Sottosezione'
            : 'Catena montuosa',
    };
  });
  for (const group of data.groups) {
    const chain = lineage(group.rangeId);
    rows.push({
      id: group.id,
      name: group.name,
      kind: 'group',
      path: chain.map((x) => x.name),
      ancestors: chain.map((x) => x.id),
      alpine: chain[0]?.name.trim().toLowerCase() === 'alpi',
      level: 'Gruppo (archivio)',
    });
  }
  return rows.sort(
    (a, b) => a.name.localeCompare(b.name, 'it') || a.kind.localeCompare(b.kind) || a.id - b.id,
  );
}
export function filterClassification(
  rows: ClassificationRow[],
  q: string,
  scope: string,
  kind: string,
  rangeId: number,
) {
  const words = normalize(q).trim().split(/\s+/).filter(Boolean);
  return rows.filter(
    (row) =>
      (scope !== 'alpine' || row.alpine) &&
      (kind === 'all' || row.kind === kind) &&
      (!rangeId || row.ancestors.includes(rangeId)) &&
      words.every((word) => normalize([row.name, ...row.path].join(' ')).includes(word)),
  );
}
