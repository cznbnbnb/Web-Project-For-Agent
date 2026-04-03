import type { Task } from '../types.js';

export function buildParentChildFromWbs(tasks: Task[]): void {
  tasks.sort((a, b) => a.wbs.localeCompare(b.wbs, 'zh-CN'));
  for (const task of tasks) {
    const parts = task.wbs.split('.');
    if (parts.length > 1) {
      const parentWbs = parts.slice(0, -1).join('.');
      const parent = tasks.find(t => t.wbs === parentWbs);
      if (parent) {
        task.parentId = parent.id;
        if (!parent.children) parent.children = [];
        parent.children.push(task.id);
      }
    }
  }
}
