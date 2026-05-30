import type { TreePage } from './tree';

export function resolvePageByPath(root: TreePage, path: string[]): TreePage | null {
  let current: TreePage = root;
  for (const slug of path) {
    const next = current.children.find((c) => c.slug === slug);
    if (!next) return null;
    current = next;
  }
  return current;
}

export function pagePath(root: TreePage, targetId: string): string[] | null {
  const walk = (node: TreePage, acc: string[]): string[] | null => {
    if (node.id === targetId) return acc;
    for (const child of node.children) {
      const found = walk(child, [...acc, child.slug]);
      if (found) return found;
    }
    return null;
  };
  return walk(root, []);
}
