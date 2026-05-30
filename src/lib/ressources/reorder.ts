export function moveInList(ids: string[], id: string, direction: 'up' | 'down'): string[] {
  const i = ids.indexOf(id);
  if (i === -1) return ids;
  const j = direction === 'up' ? i - 1 : i + 1;
  if (j < 0 || j >= ids.length) return ids;
  const out = [...ids];
  const tmp = out[i]!;
  out[i] = out[j]!;
  out[j] = tmp;
  return out;
}
