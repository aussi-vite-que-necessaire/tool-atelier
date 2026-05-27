// Helpers purs de manipulation de la liste ordonnée des pages du PDF (ids d'images).
// Toujours renvoyer une nouvelle liste, jamais muter l'entrée.

export function addImage(list: string[], id: string): string[] {
  if (list.includes(id)) return list.slice();
  return [...list, id];
}

export function removeAt(list: string[], index: number): string[] {
  if (index < 0 || index >= list.length) return list.slice();
  return list.filter((_, i) => i !== index);
}

export function moveUp(list: string[], index: number): string[] {
  if (index <= 0 || index >= list.length) return list.slice();
  const next = list.slice();
  [next[index - 1], next[index]] = [next[index], next[index - 1]];
  return next;
}

export function moveDown(list: string[], index: number): string[] {
  if (index < 0 || index >= list.length - 1) return list.slice();
  const next = list.slice();
  [next[index], next[index + 1]] = [next[index + 1], next[index]];
  return next;
}
