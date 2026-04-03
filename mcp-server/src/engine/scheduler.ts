import type { Task, ScheduleResult, Project } from '../types.js';
import { parseISO, addDays, format, differenceInDays } from 'date-fns';
import {
  isWorkingDay,
  addWorkingDays,
} from '../lib/calendar.js';

/**
 * 智能排程引擎
 * 基于关键路径法（CPM）实现
 */
export class Scheduler {
  private tasks: Task[];
  private holidays: string[];
  private workingDays: number[];

  constructor(project: Project) {
    this.tasks = project.tasks;
    this.holidays = project.holidays;
    this.workingDays = project.workingDays;
  }

  /**
   * 执行完整排程
   */
  schedule(startDate?: string): ScheduleResult {
    const errors: string[] = [];
    const projectStart = startDate || format(new Date(), 'yyyy-MM-dd');

    try {
      // 1. 构建任务依赖图
      const taskMap = new Map<string, Task>();
      this.tasks.forEach(t => taskMap.set(t.id, { ...t }));

      // 2. 正向传递（计算最早开始/结束时间）
      this.forwardPass(taskMap, projectStart);

      // 3. 反向传递（计算最晚开始/结束时间）
      this.backwardPass(taskMap);

      // 4. 计算关键路径
      const criticalPath = this.calculateCriticalPath(taskMap);

      // 5. 更新任务属性
      const scheduledTasks = Array.from(taskMap.values()).map(task => ({
        ...task,
        isCritical: criticalPath.includes(task.id),
        totalFloat: task.lateStart && task.earlyStart
          ? differenceInDays(parseISO(task.lateStart), parseISO(task.earlyStart))
          : 0,
      }));

      // 6. 计算项目结束日期
      const projectEnd = this.calculateProjectEnd(scheduledTasks);

      return {
        success: true,
        tasks: scheduledTasks,
        criticalPath,
        errors,
        projectStartDate: projectStart,
        projectEndDate: projectEnd,
      };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '排程失败');
      return {
        success: false,
        tasks: this.tasks,
        criticalPath: [],
        errors,
        projectStartDate: projectStart,
        projectEndDate: projectStart,
      };
    }
  }

  /**
   * 正向传递 - 计算最早开始和结束时间
   */
  private forwardPass(taskMap: Map<string, Task>, projectStart: string): void {
    const visited = new Set<string>();
    const calendarConfig = { workingHours: { start: 9, end: 18 }, holidays: this.holidays, workingDays: this.workingDays };

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      const task = taskMap.get(taskId);
      if (!task) return;

      // 先处理所有前置任务
      task.dependencies.forEach(dep => {
        visit(dep.taskId);
      });

      // 计算最早开始时间
      let earlyStart = parseISO(projectStart);

      if (task.dependencies.length > 0) {
        for (const dep of task.dependencies) {
          const predecessor = taskMap.get(dep.taskId);
          if (!predecessor?.earlyFinish) continue;

          const depEnd = parseISO(predecessor.earlyFinish);
          const depStart = parseISO(predecessor.earlyStart || projectStart);

          let successorStart: Date;

          switch (dep.type) {
            case 'FS': // Finish-to-Start: 前置任务完成后，本任务才能开始
              // lagDays=0 表示下一个工作日开始，lagDays=1 表示隔 1 个工作日
              successorStart = addWorkingDays(depEnd, (dep.lagDays || 0) + 1, calendarConfig);
              break;
            case 'SS': // Start-to-Start: 前置任务开始后，本任务才能开始
              // lagDays=0 表示同一天开始，lagDays=1 表示隔 1 个工作日
              successorStart = addWorkingDays(depStart, dep.lagDays || 0, calendarConfig);
              break;
            case 'FF': // Finish-to-Finish: 前置任务完成后，本任务才能完成
              // FF 关系下，本任务的最早开始 = 前置任务结束 - 本任务工期 + lag
              const ffStart = addWorkingDays(depEnd, -((task.duration || 1) - 1), calendarConfig);
              successorStart = addWorkingDays(ffStart, dep.lagDays || 0, calendarConfig);
              break;
            case 'SF': // Start-to-Finish (罕见): 前置任务开始后，本任务才能完成
              const sfStart = addWorkingDays(depStart, -((task.duration || 1) - 1), calendarConfig);
              successorStart = addWorkingDays(sfStart, dep.lagDays || 0, calendarConfig);
              break;
            default:
              successorStart = depEnd;
          }

          if (successorStart > earlyStart) {
            earlyStart = successorStart;
          }
        }
      }

      // 找到下一个工作日
      while (!isWorkingDay(earlyStart, calendarConfig)) {
        earlyStart = addDays(earlyStart, 1);
      }

      task.earlyStart = format(earlyStart, 'yyyy-MM-dd');

      // 计算最早结束时间
      if (task.duration && task.duration > 0) {
        const earlyFinish = addWorkingDays(earlyStart, task.duration - 1, calendarConfig);
        task.earlyFinish = format(earlyFinish, 'yyyy-MM-dd');
      } else {
        task.earlyFinish = task.earlyStart;
      }

      visited.add(taskId);
    };

    // 访问所有任务
    taskMap.forEach((_, taskId) => visit(taskId));
  }

  /**
   * 反向传递 - 计算最晚开始和结束时间
   */
  private backwardPass(taskMap: Map<string, Task>): void {
    // 找到项目结束时间（最晚的早期结束时间）
    let projectEnd = new Date(0);
    taskMap.forEach(task => {
      if (task.earlyFinish) {
        const end = parseISO(task.earlyFinish);
        if (end > projectEnd) projectEnd = end;
      }
    });

    const visited = new Set<string>();
    const calendarConfig = { workingHours: { start: 9, end: 18 }, holidays: this.holidays, workingDays: this.workingDays };

    const visit = (taskId: string) => {
      if (visited.has(taskId)) return;
      const task = taskMap.get(taskId);
      if (!task) return;

      // 找到所有后置任务
      const successors = Array.from(taskMap.values()).filter(t =>
        t.dependencies.some(d => d.taskId === taskId)
      );

      // 计算最晚结束时间
      let lateFinish = projectEnd;

      if (successors.length > 0) {
        for (const successor of successors) {
          const dep = successor.dependencies.find(d => d.taskId === taskId)!;
          const succStart = successor.lateStart ? parseISO(successor.lateStart) : projectEnd;
          const succEnd = successor.lateFinish ? parseISO(successor.lateFinish) : projectEnd;
          const taskEnd = task.earlyFinish ? parseISO(task.earlyFinish) : projectEnd;

          let predEnd: Date;

          switch (dep.type) {
            case 'FS':
              predEnd = addDays(succStart, -(dep.lagDays || 0));
              break;
            case 'SS':
              predEnd = addDays(succStart, (task.duration || 1) - 1 + (dep.lagDays || 0));
              break;
            case 'FF':
              predEnd = addDays(succEnd, -(dep.lagDays || 0));
              break;
            case 'SF':
              predEnd = addDays(succStart, (task.duration || 1) - 1 - (dep.lagDays || 0));
              break;
            default:
              predEnd = taskEnd;
          }

          // 往前推一天作为最晚结束
          const candidate = addDays(predEnd, -1);
          if (candidate < lateFinish) {
            lateFinish = candidate;
          }
        }
      }

      // 确保是工作日
      while (!isWorkingDay(lateFinish, calendarConfig)) {
        lateFinish = addDays(lateFinish, -1);
      }

      task.lateFinish = format(lateFinish, 'yyyy-MM-dd');

      // 计算最晚开始时间
      if (task.duration && task.duration > 0) {
        const lateStart = addWorkingDays(lateFinish, -(task.duration - 1), calendarConfig);
        task.lateStart = format(lateStart, 'yyyy-MM-dd');
      } else {
        task.lateStart = task.lateFinish;
      }

      visited.add(taskId);
    };

    taskMap.forEach((_, taskId) => visit(taskId));
  }

  /**
   * 计算关键路径
   */
  private calculateCriticalPath(taskMap: Map<string, Task>): string[] {
    const criticalTasks: string[] = [];

    taskMap.forEach(task => {
      if (task.earlyStart && task.lateStart) {
        const float = differenceInDays(parseISO(task.lateStart), parseISO(task.earlyStart));
        if (float <= 0) {
          criticalTasks.push(task.id);
        }
      }
    });

    return criticalTasks;
  }

  /**
   * 计算项目结束日期
   */
  private calculateProjectEnd(tasks: Task[]): string {
    let maxEnd = new Date(0);
    tasks.forEach(task => {
      if (task.earlyFinish) {
        const end = parseISO(task.earlyFinish);
        if (end > maxEnd) maxEnd = end;
      }
    });
    return format(maxEnd, 'yyyy-MM-dd');
  }
}

/**
 * 便捷函数：重新排程项目
 */
export function rescheduleProject(project: Project, startDate?: string): ScheduleResult {
  const scheduler = new Scheduler(project);
  return scheduler.schedule(startDate);
}

/**
 * 便捷函数：重新排程单个任务及其后置任务
 */
export function rescheduleTask(project: Project, taskId: string): ScheduleResult {
  // 找到需要重新排程的任务（该任务及其所有后置任务）
  const task = project.tasks.find(t => t.id === taskId);
  if (!task) {
    return {
      success: false,
      tasks: project.tasks,
      criticalPath: [],
      errors: ['任务不存在'],
      projectStartDate: format(new Date(), 'yyyy-MM-dd'),
      projectEndDate: format(new Date(), 'yyyy-MM-dd'),
    };
  }

  return rescheduleProject(project);
}
