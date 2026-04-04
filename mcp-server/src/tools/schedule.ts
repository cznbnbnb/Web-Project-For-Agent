import type { Tool } from '@modelcontextprotocol/sdk/types.js';
import type { CalendarConfig } from '../types.js';
import { saveProject, loadProject } from '../storage.js';
import { rescheduleProject } from '../engine/chainScheduler.js';
import { Scheduler } from '../engine/scheduler.js';

export const scheduleTools: Tool[] = [
  {
    name: 'reschedule_project',
    description: '重新计算项目中所有任务的开始/结束日期，自动跳过节假日（含中国法定节假日2024-2027）和周末，遵守前置任务约束。⚠️ 最佳实践：在添加完所有任务和依赖后统一调用一次，而不是每加一个任务就调用。这是修正日期（包括非工作日）的唯一推荐方式。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
        startDate: {
          type: 'string',
          description: '项目开始日期 yyyy-MM-dd（可选，若不填则使用各任务现有 startDate）',
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'get_critical_path',
    description: '计算并返回关键路径（影响项目最终完成时间的任务链）及浮动时间分析。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'analyze_schedule',
    description: '对项目进行综合排程分析，返回关键路径、风险任务、资源使用摘要的 Markdown 报告。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string' },
      },
      required: ['projectId'],
    },
  },
];

export function handleScheduleTool(name: string, args: Record<string, unknown>) {
  const projectId = args.projectId as string;
  const project = loadProject(projectId);
  if (!project) return { content: [{ type: 'text', text: `项目 ${projectId} 不存在` }], isError: true };

  const calendarConfig: CalendarConfig = {
    workingHours: { start: 9, end: 18 },
    holidays: project.holidays,
    workingDays: project.workingDays,
  };

  switch (name) {
    case 'reschedule_project': {
      if (args.startDate) {
        // 将开始日期设到无依赖的根任务上
        for (const task of project.tasks) {
          if ((!task.dependencies || task.dependencies.length === 0) && !task.parentId) {
            task.startDate = args.startDate as string;
          }
        }
      }
      const updatedTasks = rescheduleProject(project);
      project.tasks = updatedTasks;
      project.updatedAt = new Date().toISOString();
      saveProject(project);

      const sortedTasks = [...updatedTasks].sort((a, b) => a.wbs.localeCompare(b.wbs));
      const lines = sortedTasks.map(t =>
        `${t.wbs} ${t.name}: ${t.startDate ?? '?'} → ${t.endDate ?? '?'}（${t.duration ?? 0}天）`
      );
      return {
        content: [{
          type: 'text',
          text: `排程完成，共 ${updatedTasks.length} 个任务\n\n${lines.join('\n')}`,
        }],
      };
    }

    case 'get_critical_path': {
      const scheduler = new Scheduler(project);
      const result = scheduler.schedule();
      if (!result.success) {
        return { content: [{ type: 'text', text: `排程失败: ${result.errors.join(', ')}` }], isError: true };
      }
      const cpIds = result.criticalPath;
      const cpTasks = cpIds.map(id => result.tasks.find(t => t.id === id)).filter(Boolean);
      const lines = cpTasks.map(t => `- **${t!.wbs} ${t!.name}** — ${t!.startDate} → ${t!.endDate}（浮动 ${t!.totalFloat ?? 0} 天）`);
      return {
        content: [{
          type: 'text',
          text: `## 关键路径（${cpTasks.length} 个任务）\n\n${lines.join('\n')}\n\n项目预计结束日期：${result.projectEndDate ?? '未知'}`,
        }],
      };
    }

    case 'analyze_schedule': {
      const scheduler = new Scheduler(project);
      const result = scheduler.schedule();
      if (!result.success) {
        return { content: [{ type: 'text', text: `排程失败: ${result.errors.join(', ')}` }], isError: true };
      }

      const cpIds = result.criticalPath;
      const cp = cpIds.map(id => result.tasks.find(t => t.id === id)).filter(Boolean);
      const allTasks = result.tasks;
      const blockedTasks = allTasks.filter(t => t.status === 'blocked');
      const highRiskTasks = allTasks.filter(t => t.isCritical && t.priority === 'critical');
      const assignees = [...new Set(allTasks.map(t => t.assignee).filter(Boolean))];

      const report = [
        `# 项目排程分析报告`,
        ``,
        `## 基本信息`,
        `- 项目名称：${project.name}`,
        `- 任务总数：${allTasks.length}`,
        `- 项目开始：${result.projectStartDate ?? '未知'}`,
        `- 项目结束：${result.projectEndDate ?? '未知'}`,
        `- 参与人员：${assignees.length > 0 ? assignees.join('、') : '未分配'}`,
        ``,
        `## 关键路径（${cp.length} 个任务）`,
        ...cp.map(t => `- ${t!.wbs} **${t!.name}**（${t!.startDate} → ${t!.endDate}）`),
        ``,
        `## 风险提示`,
        blockedTasks.length > 0
          ? `### 受阻任务（${blockedTasks.length} 个）\n${blockedTasks.map(t => `- ${t.wbs} ${t.name}`).join('\n')}`
          : '无受阻任务',
        highRiskTasks.length > 0
          ? `\n### 关键路径上的高优先级任务（${highRiskTasks.length} 个）\n${highRiskTasks.map(t => `- ${t.wbs} ${t.name}`).join('\n')}`
          : '',
        ``,
        `## 完成情况`,
        `- 未开始：${allTasks.filter(t => t.status === 'not_started').length} 个`,
        `- 进行中：${allTasks.filter(t => t.status === 'in_progress').length} 个`,
        `- 已完成：${allTasks.filter(t => t.status === 'completed').length} 个`,
        `- 受阻/取消：${allTasks.filter(t => t.status === 'blocked' || t.status === 'cancelled').length} 个`,
      ].filter(line => line !== undefined).join('\n');

      return { content: [{ type: 'text', text: report }] };
    }

    default:
      return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  }
}
