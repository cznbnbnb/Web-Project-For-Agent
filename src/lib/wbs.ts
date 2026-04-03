import type { Task } from '../types';
import { getChildWbs } from '../lib/utils';

/**
 * 计算下一个可用的 WBS 编号
 * @param tasks 当前所有任务
 * @param parentId 父任务 ID（如果是根任务则为 undefined）
 */
export function calculateNextWbs(tasks: Task[], parentId?: string): string {
  // 获取父任务
  const parentTask = parentId ? tasks.find(t => t.id === parentId) : undefined;

  if (!parentTask) {
    // 根级别任务
    const rootTasks = tasks.filter(t => !t.parentId);
    if (rootTasks.length === 0) {
      return '1';
    }
    // 找到最大的根任务编号
    const maxWbs = rootTasks.reduce((max, task) => {
      const num = parseInt(task.wbs, 10);
      return num > max ? num : max;
    }, 0);
    return (maxWbs + 1).toString();
  }

  // 子任务
  const siblings = tasks.filter(t => t.parentId === parentId);
  if (siblings.length === 0) {
    return getChildWbs(parentTask.wbs, 0);
  }
  // 找到最大的子任务编号
  const maxWbs = siblings.reduce((max, task) => {
    const parts = task.wbs.split('.');
    const num = parseInt(parts[parts.length - 1], 10);
    return num > max ? num : max;
  }, 0);
  return getChildWbs(parentTask.wbs, maxWbs);
}

/**
 * 重新计算所有任务的 WBS 编号
 * 当任务层级发生变化时需要调用
 */
export function recalculateAllWbs(tasks: Task[]): Task[] {
  const taskMap = new Map<string, Task>();
  tasks.forEach(t => taskMap.set(t.id, { ...t, children: [] }));

  // 递归处理每个任务
  function processTask(task: Task, parentWbs?: string): Task {
    const index = parentWbs
      ? tasks.filter(t => t.parentId === task.parentId).indexOf(task)
      : tasks.filter(t => !t.parentId).indexOf(task);

    const newWbs = parentWbs
      ? getChildWbs(parentWbs, index)
      : (index + 1).toString();

    const updatedTask = { ...task, wbs: newWbs };
    taskMap.set(task.id, updatedTask);

    // 处理子任务
    const children = tasks.filter(t => t.parentId === task.id);
    children.forEach(child => processTask(child, newWbs));

    return updatedTask;
  }

  // 处理所有根任务
  const rootTasks = tasks.filter(t => !t.parentId);
  rootTasks.forEach(task => processTask(task));

  return Array.from(taskMap.values());
}

/**
 * 根据 WBS 获取任务的层级深度
 */
export function getWbsLevel(wbs: string): number {
  return wbs.split('.').length;
}

/**
 * 获取任务的缩进级别（用于树形展示）
 */
export function getIndentLevel(wbs: string): number {
  return getWbsLevel(wbs) - 1;
}

/**
 * 检查 WBS1 是否为 WBS2 的祖先
 */
export function isAncestorWbs(ancestorWbs: string, descendantWbs: string): boolean {
  return descendantWbs.startsWith(ancestorWbs + '.');
}
