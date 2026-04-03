import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Task, DependencyType } from '../types.js';
import { saveProject, loadProject } from '../storage.js';
import { generateId, isDescendant } from '../lib/utils.js';
import { calculateNextWbs, recalculateAllWbs } from '../lib/wbs.js';
import { format } from 'date-fns';

export const taskTools: Tool[] = [
  {
    name: 'add_task',
    description: '向项目中添加一个任务（叶任务、阶段或里程碑）。WBS 编号自动计算。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        name: { type: 'string', description: '任务名称' },
        type: {
          type: 'string',
          enum: ['task', 'phase', 'milestone'],
          description: '任务类型：task=普通任务, phase=阶段, milestone=里程碑',
        },
        duration: { type: 'number', description: '工期（工作日天数），里程碑填 0' },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'critical'],
          description: '优先级',
        },
        assignee: { type: 'string', description: '负责人（可选）' },
        notes: { type: 'string', description: '备注（可选）' },
        parentId: { type: 'string', description: '父任务 ID（可选，不填则为顶层任务）' },
        startDate: { type: 'string', description: '手动指定开始日期 yyyy-MM-dd（可选，有前置任务时会被排程覆盖）' },
        dependencies: {
          type: 'array',
          description: '前置任务列表（可选）',
          items: {
            type: 'object',
            properties: {
              taskId: { type: 'string', description: '前置任务 ID' },
              type: { type: 'string', enum: ['FS', 'SS', 'FF', 'SF'], description: '依赖关系类型' },
              lagDays: { type: 'number', description: '时间差（工作日），可为负数' },
            },
            required: ['taskId'],
          },
        },
      },
      required: ['projectId', 'name'],
    },
  },
  {
    name: 'update_task',
    description: '更新任务属性（名称、状态、进度、工期、负责人等）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
        name: { type: 'string' },
        type: { type: 'string', enum: ['task', 'phase', 'milestone'] },
        duration: { type: 'number' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        status: {
          type: 'string',
          enum: ['not_started', 'in_progress', 'completed', 'blocked', 'cancelled'],
        },
        progress: { type: 'number', description: '完成百分比 0-100' },
        assignee: { type: 'string' },
        notes: { type: 'string' },
        startDate: { type: 'string', description: 'yyyy-MM-dd' },
        endDate: { type: 'string', description: 'yyyy-MM-dd' },
      },
      required: ['projectId', 'taskId'],
    },
  },
  {
    name: 'delete_task',
    description: '删除任务（及其所有子任务）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
      },
      required: ['projectId', 'taskId'],
    },
  },
  {
    name: 'add_dependency',
    description: '为任务添加前置依赖关系。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string', description: '后继任务 ID' },
        predecessorId: { type: 'string', description: '前置任务 ID' },
        type: {
          type: 'string',
          enum: ['FS', 'SS', 'FF', 'SF'],
          description: 'FS=完成-开始(默认), SS=开始-开始, FF=完成-完成, SF=开始-完成',
        },
        lagDays: { type: 'number', description: '滞后天数（工作日），默认 0' },
      },
      required: ['projectId', 'taskId', 'predecessorId'],
    },
  },
  {
    name: 'remove_dependency',
    description: '移除任务的某个前置依赖。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        taskId: { type: 'string' },
        predecessorId: { type: 'string' },
      },
      required: ['projectId', 'taskId', 'predecessorId'],
    },
  },
  {
    name: 'list_tasks',
    description: '列出项目中的所有任务（树形结构）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        format: {
          type: 'string',
          enum: ['table', 'json'],
          description: '输出格式：table=可读表格（默认）, json=原始 JSON',
        },
      },
      required: ['projectId'],
    },
  },
];

function getAllDescendantIds(tasks: Task[], taskId: string): string[] {
  const task = tasks.find(t => t.id === taskId);
  if (!task?.children?.length) return [];
  const ids: string[] = [];
  for (const childId of task.children) {
    ids.push(childId);
    ids.push(...getAllDescendantIds(tasks, childId));
  }
  return ids;
}

function renderTaskTable(tasks: Task[]): string {
  const header = '| WBS | 任务名称 | 类型 | 工期 | 负责人 | 状态 | 进度 | 开始日期 | 结束日期 |';
  const sep =    '|-----|----------|------|------|--------|------|------|----------|----------|';
  const typeMap: Record<string, string> = { task: '任务', phase: '阶段', milestone: '里程碑' };
  const statusMap: Record<string, string> = {
    not_started: '未开始', in_progress: '进行中', completed: '已完成',
    blocked: '受阻', cancelled: '已取消',
  };
  const rows = tasks.map(t =>
    `| ${t.wbs} | ${'  '.repeat((t.wbs.split('.').length - 1))}${t.name} | ${typeMap[t.type] ?? t.type} | ${t.duration ?? '-'} | ${t.assignee ?? '-'} | ${statusMap[t.status] ?? t.status} | ${t.progress}% | ${t.startDate ?? '-'} | ${t.endDate ?? '-'} |`
  );
  return [header, sep, ...rows].join('\n');
}

export function handleTaskTool(name: string, args: Record<string, unknown>) {
  const projectId = args.projectId as string;

  const project = loadProject(projectId);
  if (!project) return { content: [{ type: 'text', text: `项目 ${projectId} 不存在` }], isError: true };

  const now = new Date().toISOString();

  switch (name) {
    case 'add_task': {
      const parentId = args.parentId as string | undefined;
      const wbs = calculateNextWbs(project.tasks, parentId);
      const task: Task = {
        id: generateId(),
        name: args.name as string,
        type: (args.type as Task['type']) ?? 'task',
        wbs,
        parentId,
        children: [],
        dependencies: (args.dependencies as Task['dependencies']) ?? [],
        predecessors: [],
        successors: [],
        priority: (args.priority as Task['priority']) ?? 'medium',
        status: 'not_started',
        progress: 0,
        duration: (args.duration as number) ?? 1,
        assignee: args.assignee as string | undefined,
        notes: args.notes as string | undefined,
        startDate: args.startDate as string | undefined,
        createdAt: now,
        updatedAt: now,
      };

      // 将任务加入父任务的 children
      const tasks = [...project.tasks, task];
      if (parentId) {
        const parentIdx = tasks.findIndex(t => t.id === parentId);
        if (parentIdx !== -1) {
          tasks[parentIdx] = {
            ...tasks[parentIdx],
            children: [...(tasks[parentIdx].children ?? []), task.id],
          };
        }
      }

      project.tasks = tasks;
      project.updatedAt = now;
      saveProject(project);
      return { content: [{ type: 'text', text: `任务已添加\n\n${JSON.stringify(task, null, 2)}` }] };
    }

    case 'update_task': {
      const taskId = args.taskId as string;
      const idx = project.tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { content: [{ type: 'text', text: `任务 ${taskId} 不存在` }], isError: true };

      const updates: Partial<Task> = {};
      const fields = ['name', 'type', 'duration', 'priority', 'status', 'progress', 'assignee', 'notes', 'startDate', 'endDate'] as const;
      for (const f of fields) {
        if (args[f] !== undefined) (updates as Record<string, unknown>)[f] = args[f];
      }

      project.tasks[idx] = { ...project.tasks[idx], ...updates, updatedAt: now };
      project.updatedAt = now;
      saveProject(project);
      return { content: [{ type: 'text', text: `任务已更新\n\n${JSON.stringify(project.tasks[idx], null, 2)}` }] };
    }

    case 'delete_task': {
      const taskId = args.taskId as string;
      const idsToRemove = new Set([taskId, ...getAllDescendantIds(project.tasks, taskId)]);
      project.tasks = project.tasks
        .filter(t => !idsToRemove.has(t.id))
        .map(t => ({
          ...t,
          children: t.children?.filter(cid => !idsToRemove.has(cid)),
          dependencies: t.dependencies.filter(d => !idsToRemove.has(d.taskId)),
        }));
      project.tasks = recalculateAllWbs(project.tasks);
      project.updatedAt = now;
      saveProject(project);
      return { content: [{ type: 'text', text: `任务 ${taskId} 及其 ${idsToRemove.size - 1} 个子任务已删除` }] };
    }

    case 'add_dependency': {
      const taskId = args.taskId as string;
      const predecessorId = args.predecessorId as string;
      const idx = project.tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { content: [{ type: 'text', text: `任务 ${taskId} 不存在` }], isError: true };
      if (!project.tasks.find(t => t.id === predecessorId)) {
        return { content: [{ type: 'text', text: `前置任务 ${predecessorId} 不存在` }], isError: true };
      }
      if (isDescendant(project.tasks, taskId, predecessorId)) {
        return { content: [{ type: 'text', text: '循环依赖：不能将后代任务设为前置任务' }], isError: true };
      }
      const existing = project.tasks[idx].dependencies.find(d => d.taskId === predecessorId);
      if (existing) {
        return { content: [{ type: 'text', text: `前置任务 ${predecessorId} 已存在` }] };
      }
      project.tasks[idx] = {
        ...project.tasks[idx],
        dependencies: [
          ...project.tasks[idx].dependencies,
          { taskId: predecessorId, type: ((args.type as DependencyType) ?? 'FS'), lagDays: (args.lagDays as number) ?? 0 },
        ],
        updatedAt: now,
      };
      project.updatedAt = now;
      saveProject(project);
      return { content: [{ type: 'text', text: `已为任务 ${taskId} 添加前置任务 ${predecessorId} (${args.type ?? 'FS'})` }] };
    }

    case 'remove_dependency': {
      const taskId = args.taskId as string;
      const predecessorId = args.predecessorId as string;
      const idx = project.tasks.findIndex(t => t.id === taskId);
      if (idx === -1) return { content: [{ type: 'text', text: `任务 ${taskId} 不存在` }], isError: true };
      project.tasks[idx] = {
        ...project.tasks[idx],
        dependencies: project.tasks[idx].dependencies.filter(d => d.taskId !== predecessorId),
        updatedAt: now,
      };
      project.updatedAt = now;
      saveProject(project);
      return { content: [{ type: 'text', text: `已移除前置任务 ${predecessorId}` }] };
    }

    case 'list_tasks': {
      const fmt = (args.format as string) ?? 'table';
      if (project.tasks.length === 0) return { content: [{ type: 'text', text: '该项目暂无任务' }] };
      const sorted = [...project.tasks].sort((a, b) => a.wbs.localeCompare(b.wbs));
      const output = fmt === 'json' ? JSON.stringify(sorted, null, 2) : renderTaskTable(sorted);
      return { content: [{ type: 'text', text: output }] };
    }

    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  }
}
