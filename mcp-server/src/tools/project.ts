import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Project } from '../types.js';
import { saveProject, loadProject, listProjects, deleteProject, getDataDir } from '../storage.js';
import { generateId } from '../lib/utils.js';
import { getDefaultChineseHolidays } from '../lib/chineseHolidays.js';
import { format } from 'date-fns';

export const projectTools: Tool[] = [
  {
    name: 'create_project',
    description: '创建一个新的项目计划。会自动预置中国法定节假日，工作日默认为周一到周五。',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '项目名称' },
        description: { type: 'string', description: '项目描述（可选）' },
        workingDays: {
          type: 'array',
          items: { type: 'number' },
          description: '工作日列表，0=周日 1=周一 … 6=周六，默认 [1,2,3,4,5]',
        },
        holidays: {
          type: 'array',
          items: { type: 'string' },
          description: '额外节假日日期列表，ISO格式 yyyy-MM-dd，会与中国法定节假日合并',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'list_projects',
    description: '列出所有已保存的项目。',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_project',
    description: '获取项目详情（包含完整任务树）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'update_project',
    description: '更新项目基本信息（名称、描述、工作日配置等）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
        name: { type: 'string' },
        description: { type: 'string' },
        workingDays: { type: 'array', items: { type: 'number' } },
        holidays: { type: 'array', items: { type: 'string' } },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'delete_project',
    description: '删除一个项目（不可恢复）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];

export function handleProjectTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'create_project': {
      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");
      const extraHolidays = (args.holidays as string[] | undefined) ?? [];
      const project: Project = {
        id: generateId(),
        name: args.name as string,
        description: (args.description as string | undefined) ?? '',
        tasks: [],
        workingDays: (args.workingDays as number[] | undefined) ?? [1, 2, 3, 4, 5],
        holidays: [...new Set([...getDefaultChineseHolidays(), ...extraHolidays])],
        createdAt: now,
        updatedAt: now,
      };
      saveProject(project);
      return {
        content: [{ type: 'text', text: `项目已创建\n\n${JSON.stringify(project, null, 2)}\n\n数据存储于: ${getDataDir()}/${project.id}.json` }],
      };
    }

    case 'list_projects': {
      const projects = listProjects();
      if (projects.length === 0) {
        return { content: [{ type: 'text', text: '暂无项目。使用 create_project 创建第一个项目。' }] };
      }
      const summary = projects.map(p => `- **${p.name}** (id: \`${p.id}\`) — ${p.tasks.length} 个任务，更新于 ${p.updatedAt.slice(0, 10)}`).join('\n');
      return { content: [{ type: 'text', text: `共 ${projects.length} 个项目：\n\n${summary}` }] };
    }

    case 'get_project': {
      const project = loadProject(args.projectId as string);
      if (!project) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }

    case 'update_project': {
      const project = loadProject(args.projectId as string);
      if (!project) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };
      if (args.name !== undefined) project.name = args.name as string;
      if (args.description !== undefined) project.description = args.description as string;
      if (args.workingDays !== undefined) project.workingDays = args.workingDays as number[];
      if (args.holidays !== undefined) project.holidays = args.holidays as string[];
      project.updatedAt = new Date().toISOString();
      saveProject(project);
      return { content: [{ type: 'text', text: `项目已更新\n\n${JSON.stringify(project, null, 2)}` }] };
    }

    case 'delete_project': {
      const ok = deleteProject(args.projectId as string);
      if (!ok) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };
      return { content: [{ type: 'text', text: `项目 ${args.projectId} 已删除` }] };
    }

    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  }
}
