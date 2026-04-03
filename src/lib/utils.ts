import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Task } from '../types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 生成唯一 ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// 解析 WBS 级别
export function parseWBSLevel(wbs: string): number {
  return wbs.split('.').length;
}

// 获取 WBS 的父级 WBS
export function getParentWbs(wbs: string): string | null {
  const parts = wbs.split('.');
  if (parts.length === 1) return null;
  parts.pop();
  return parts.join('.');
}

// 生成子任务 WBS
export function getChildWbs(parentWbs: string, index: number): string {
  return `${parentWbs}.${index + 1}`;
}

// 从 WBS 生成下一个同级 WBS
export function getNextSiblingWbs(wbs: string): string {
  const parts = wbs.split('.');
  const last = parseInt(parts.pop()!, 10);
  parts.push((last + 1).toString());
  return parts.join('.');
}

/**
 * 检查 taskToCheck 是否为 ancestor 的后代任务
 * 用于防止循环依赖（不能将子孙任务设为前置任务）
 */
export function isDescendant(
  tasks: Task[],
  ancestorId: string,
  taskToCheckId: string
): boolean {
  const ancestor = tasks.find(t => t.id === ancestorId);
  if (!ancestor) return false;

  // 递归检查所有后代
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

/**
 * 获取任务的所有祖先 ID 列表
 */
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
