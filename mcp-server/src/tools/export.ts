import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { Project } from '../types.js';
import { saveProject, loadProject } from '../storage.js';
import { generateId } from '../lib/utils.js';
import { getDefaultChineseHolidays } from '../lib/chineseHolidays.js';
import { writeFileSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { format } from 'date-fns';

export const exportTools: Tool[] = [
  {
    name: 'export_json',
    description: '将项目导出为 JSON 字符串（可复制到 Web UI 导入）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'export_json_file',
    description: '将项目导出为 JSON 文件保存到指定路径。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        outputPath: { type: 'string', description: '输出文件路径，如 /tmp/project.json' },
      },
      required: ['projectId', 'outputPath'],
    },
  },
  {
    name: 'import_json',
    description: '从 JSON 字符串导入项目（创建新项目或覆盖同 ID 的项目）。',
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string', description: '项目 JSON 字符串' },
        newId: {
          type: 'boolean',
          description: '是否生成新 ID（默认 false，保留原 ID；设为 true 则以副本形式导入）',
        },
      },
      required: ['json'],
    },
  },
  {
    name: 'export_excel',
    description: '将项目导出为 Excel 文件（.xlsx）保存到指定路径。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        outputPath: {
          type: 'string',
          description: '输出文件路径，如 /tmp/project.xlsx（可省略，默认保存到当前目录）',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'import_excel',
    description: '从 Excel 文件（.xlsx）导入任务到指定项目中。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '目标项目 ID（不存在则自动创建）' },
        filePath: { type: 'string', description: 'Excel 文件路径' },
      },
      required: ['projectId', 'filePath'],
    },
  },
];

export async function handleExportTool(name: string, args: Record<string, unknown>) {
  switch (name) {
    case 'export_json': {
      const project = loadProject(args.projectId as string);
      if (!project) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };
      return { content: [{ type: 'text', text: JSON.stringify(project, null, 2) }] };
    }

    case 'export_json_file': {
      const project = loadProject(args.projectId as string);
      if (!project) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };
      const outputPath = resolve(args.outputPath as string);
      writeFileSync(outputPath, JSON.stringify(project, null, 2), 'utf-8');
      return { content: [{ type: 'text', text: `项目已导出到 ${outputPath}` }] };
    }

    case 'import_json': {
      let project: Project;
      try {
        project = JSON.parse(args.json as string) as Project;
      } catch (e) {
        return { content: [{ type: 'text', text: `JSON 解析失败: ${e}` }], isError: true };
      }
      if (args.newId) {
        project = { ...project, id: generateId(), name: `${project.name}（副本）`, updatedAt: new Date().toISOString() };
      }
      saveProject(project);
      return { content: [{ type: 'text', text: `项目 "${project.name}"（id: ${project.id}）导入成功，共 ${project.tasks.length} 个任务` }] };
    }

    case 'export_excel': {
      const project = loadProject(args.projectId as string);
      if (!project) return { content: [{ type: 'text', text: `项目 ${args.projectId} 不存在` }], isError: true };

      const XLSX = await import('xlsx');
      const data = project.tasks.map(task => ({
        'WBS 编号': task.wbs,
        '任务名称': task.name,
        '任务类型': task.type === 'task' ? '任务' : task.type === 'phase' ? '阶段' : '里程碑',
        '前置任务 ID': task.dependencies.map(d => d.taskId).join('; '),
        '前置关系类型': task.dependencies.map(d => d.type).join('; '),
        '开始日期': task.startDate ?? '',
        '结束日期': task.endDate ?? '',
        '工期 (天)': task.duration ?? '',
        '负责人': task.assignee ?? '',
        '优先级': task.priority === 'low' ? '低' : task.priority === 'medium' ? '中' : task.priority === 'high' ? '高' : '紧急',
        '状态': task.status === 'not_started' ? '未开始' : task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : task.status === 'blocked' ? '受阻' : '已取消',
        '进度 (%)': task.progress,
        '工时 (小时)': task.effort ?? '',
        '备注': task.notes ?? '',
      }));

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(data);
      ws['!cols'] = [10,30,10,20,12,12,12,10,12,10,10,10,10,30].map(wch => ({ wch }));
      XLSX.utils.book_append_sheet(wb, ws, '项目计划');

      const defaultPath = `./${project.name}_${format(new Date(), 'yyyyMMdd')}.xlsx`;
      const outputPath = resolve((args.outputPath as string) ?? defaultPath);
      XLSX.writeFile(wb, outputPath);
      return { content: [{ type: 'text', text: `Excel 已导出到 ${outputPath}（${project.tasks.length} 个任务）` }] };
    }

    case 'import_excel': {
      const filePath = resolve(args.filePath as string);
      let projectTarget = loadProject(args.projectId as string);

      const XLSX = await import('xlsx');
      const { snapToWorkingDay } = await import('../lib/calendar.js');
      const { parseISO } = await import('date-fns');
      const { generateId: genId } = await import('../lib/utils.js');
      const { buildParentChildFromWbs } = await import('./importHelpers.js');

      let fileBuffer: Buffer;
      try {
        fileBuffer = readFileSync(filePath);
      } catch {
        return { content: [{ type: 'text', text: `无法读取文件 ${filePath}` }], isError: true };
      }

      const wb = XLSX.read(fileBuffer, { type: 'buffer' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);

      const now = new Date().toISOString();
      const calendarConfig = projectTarget ? {
        workingHours: { start: 9, end: 18 } as const,
        holidays: projectTarget.holidays,
        workingDays: projectTarget.workingDays,
      } : {
        workingHours: { start: 9, end: 18 } as const,
        holidays: getDefaultChineseHolidays(),
        workingDays: [1, 2, 3, 4, 5],
      };

      const snap = (d: string) => format(snapToWorkingDay(parseISO(d), calendarConfig), 'yyyy-MM-dd');

      const typeMap: Record<string, 'task' | 'phase' | 'milestone'> = { '任务': 'task', '阶段': 'phase', '里程碑': 'milestone', task: 'task', phase: 'phase', milestone: 'milestone' };
      const priorityMap: Record<string, 'low' | 'medium' | 'high' | 'critical'> = { '低': 'low', '中': 'medium', '高': 'high', '紧急': 'critical', low: 'low', medium: 'medium', high: 'high', critical: 'critical' };
      const statusMap: Record<string, 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled'> = { '未开始': 'not_started', '进行中': 'in_progress', '已完成': 'completed', '受阻': 'blocked', '已取消': 'cancelled' };

      const importedTasks = rows
        .filter(r => r['WBS 编号'] || r['任务名称'])
        .map(row => {
          const rawStart = (row['开始日期'] ?? row['Start Date']) as string | undefined;
          const rawEnd = (row['结束日期'] ?? row['End Date']) as string | undefined;
          const startDate = rawStart ? snap(String(rawStart)) : undefined;
          const endDate = rawEnd ? snap(String(rawEnd)) : undefined;
          const explicit = Number(row['工期 (天)'] ?? row['Duration'] ?? row['工期']);
          let duration = explicit || 1;
          if (!explicit && startDate && endDate) {
            const ms = new Date(endDate).getTime() - new Date(startDate).getTime();
            if (ms >= 0) duration = Math.max(1, Math.round(ms / 86400000) + 1);
          }

          return {
            id: genId(),
            name: String(row['任务名称'] ?? row['Name'] ?? '未命名任务'),
            type: typeMap[String(row['任务类型'] ?? row['Type'] ?? '')] ?? 'task',
            wbs: String(row['WBS 编号'] ?? row['WBS'] ?? '1'),
            parentId: undefined as string | undefined,
            children: [] as string[],
            dependencies: [] as { taskId: string; type: 'FS' | 'SS' | 'FF' | 'SF'; lagDays?: number }[],
            predecessors: [] as string[],
            successors: [] as string[],
            priority: priorityMap[String(row['优先级'] ?? row['Priority'] ?? '')] ?? 'medium',
            status: statusMap[String(row['状态'] ?? row['Status'] ?? '')] ?? 'not_started',
            progress: Number(row['进度 (%)'] ?? row['Progress'] ?? 0),
            duration,
            startDate,
            endDate,
            assignee: (row['负责人'] ?? row['Assignee']) as string | undefined,
            effort: Number(row['工时 (小时)'] ?? row['Effort']) || undefined,
            notes: (row['备注'] ?? row['Notes']) as string | undefined,
            createdAt: now,
            updatedAt: now,
          };
        });

      buildParentChildFromWbs(importedTasks);

      if (!projectTarget) {
        projectTarget = {
          id: args.projectId as string,
          name: '导入的项目',
          description: '',
          tasks: importedTasks,
          holidays: calendarConfig.holidays,
          workingDays: calendarConfig.workingDays,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        projectTarget.tasks = [...projectTarget.tasks, ...importedTasks];
        projectTarget.updatedAt = now;
      }

      saveProject(projectTarget);
      return { content: [{ type: 'text', text: `已导入 ${importedTasks.length} 个任务到项目 "${projectTarget.name}"` }] };
    }

    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  }
}
