import type { Task } from '../types.js';

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function parseWBSLevel(wbs: string): number {
  return wbs.split('.').length;
}

export function getParentWbs(wbs: string): string | null {
  const parts = wbs.split('.');
  if (parts.length === 1) return null;
  parts.pop();
  return parts.join('.');
}

export function getChildWbs(parentWbs: string, index: number): string {
  return `${parentWbs}.${index + 1}`;
}

export function getNextSiblingWbs(wbs: string): string {
  const parts = wbs.split('.');
  const last = parseInt(parts.pop()!, 10);
  parts.push((last + 1).toString());
  return parts.join('.');
}

export function isDescendant(tasks: Task[], ancestorId: string, taskToCheckId: string): boolean {
  const checkChildren = (parentId: string): boolean => {
    const parent = tasks.find(t => t.id === parentId);
    if (!parent?.children) return false;
    for (const childId of parent.children) {
      if (childId === taskToCheckId) return true;
      if (checkChildren(childId)) return true;
    }
    return false;
  };
  return checkChildren(ancestorId);
}

export function getAncestorIds(tasks: Task[], taskId: string): string[] {
  const ancestors: string[] = [];
  const task = tasks.find(t => t.id === taskId);
  if (!task?.parentId) return ancestors;
  let current = tasks.find(t => t.id === task.parentId);
  while (current) {
    ancestors.push(current.id);
    current = tasks.find(t => t.id === current?.parentId);
  }
  return ancestors;
}
