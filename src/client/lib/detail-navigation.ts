import type { ItemKind } from '../../shared/contracts';
export function detailPath(kind: ItemKind, id: number) {
  return `/${kind === 'mountain' ? 'mountains' : 'routes'}/${id}`;
}
export function detailTarget(path: string): { kind: ItemKind; id: number } | null {
  const match = path.match(/^\/(mountains|routes)\/([1-9]\d*)\/?$/);
  if (!match || !Number.isSafeInteger(Number(match[2])) || Number(match[2]) > 2147483647)
    return null;
  return { kind: match[1] === 'mountains' ? 'mountain' : 'route', id: Number(match[2]) };
}
