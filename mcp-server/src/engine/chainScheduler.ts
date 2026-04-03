import type { Task, Project } from '../types.js';
import { parseISO, format } from 'date-fns';
import { addWorkingDays, isWorkingDay, addDays } from '../lib/calendar.js';
import type { CalendarConfig } from '../types.js';

/**
 * 计算单个任务的日期（基于前置任务的当前日期，不递归计算前置任务）
 * 用于链式更新，确保使用用户手动修改后的日期
 */
export function calculateTaskDatesFromCurrentPredecessors(
  task: Task,
  tasks: Task[],
  calendarConfig: CalendarConfig
): { startDate: string; endDate: string } {
  // 没有依赖关系，保持原日期
  if (!task.dependencies || task.dependencies.length === 0) {
    return {
      startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'),
      endDate: task.endDate || task.startDate || format(new Date(), 'yyyy-MM-dd'),
    };
  }

  // 收集所有有效的前置任务依赖
  const validDeps = task.dependencies.filter(dep => {
    const predecessor = tasks.find(t => t.id === dep.taskId);
    return predecessor && predecessor.startDate && predecessor.endDate;
  });

  if (validDeps.length === 0) {
    return {
      startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'),
      endDate: task.endDate || task.startDate || format(new Date(), 'yyyy-MM-dd'),
    };
  }

  // 计算所有依赖关系下的最晚开始日期
  let latestStartDate: Date | null = null;

  for (const dep of validDeps) {
    const predecessor = tasks.find(t => t.id === dep.taskId)!;

    // 直接使用前置任务的当前日期（不再递归计算）
    const predStartDate = predecessor.startDate!;
    const predEndDate = predecessor.endDate!;

    const depEnd = parseISO(predEndDate);
    const depStart = parseISO(predStartDate);
    const lagDays = dep.lagDays || 0;

    let candidateStartDate: Date;

    switch (dep.type) {
      case 'FS': // Finish-to-Start: 前置任务完成后，本任务才能开始
        candidateStartDate = addWorkingDays(depEnd, lagDays + 1, calendarConfig);
        break;
      case 'SS': // Start-to-Start: 前置任务开始后，本任务才能开始
        candidateStartDate = addWorkingDays(depStart, lagDays, calendarConfig);
        break;
      case 'FF': { // Finish-to-Finish: 前置任务完成后，本任务才能完成
        const ffEndDate = addWorkingDays(depEnd, lagDays, calendarConfig);
        const duration = task.duration || 1;
        candidateStartDate = addWorkingDays(ffEndDate, -(duration - 1), calendarConfig);
        break;
      }
      case 'SF': { // Start-to-Finish: 前置任务开始后，本任务才能完成
        const sfEndDate = addWorkingDays(depStart, lagDays, calendarConfig);
        const sfDuration = task.duration || 1;
        candidateStartDate = addWorkingDays(sfEndDate, -(sfDuration - 1), calendarConfig);
        break;
      }
      default:
        candidateStartDate = depEnd;
    }

    // 确保开始日期是工作日
    while (!isWorkingDay(candidateStartDate, calendarConfig)) {
      candidateStartDate = addDays(candidateStartDate, 1);
    }

    // 取最晚的开始日期（满足所有依赖关系）
    if (latestStartDate === null || candidateStartDate > latestStartDate) {
      latestStartDate = candidateStartDate;
    }
  }

  const startDateStr = format(latestStartDate!, 'yyyy-MM-dd');

  // 计算结束日期
  const duration = task.duration || 1;
  const endDate = addWorkingDays(latestStartDate!, duration - 1, calendarConfig);
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  return { startDate: startDateStr, endDate: endDateStr };
}

/**
 * 递归计算任务的开始和结束日期
 * @param task 当前任务
 * @param tasks 所有任务列表
 * @param calendarConfig 日历配置
 * @param visited 已访问任务集合（防止循环）
 */
export function calculateTaskDates(
  task: Task,
  tasks: Task[],
  calendarConfig: CalendarConfig,
  visited: Set<string> = new Set()
): { startDate: string; endDate: string } {
  // 防循环：已访问过直接返回
  if (visited.has(task.id)) {
    return { startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'), endDate: task.endDate || task.startDate || format(new Date(), 'yyyy-MM-dd') };
  }
  visited.add(task.id);

  // 没有依赖关系，保持原日期
  if (!task.dependencies || task.dependencies.length === 0) {
    return {
      startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'),
      endDate: task.endDate || task.startDate || format(new Date(), 'yyyy-MM-dd'),
    };
  }

  // 收集所有有效的前置任务依赖
  const validDeps = task.dependencies.filter(dep => {
    const predecessor = tasks.find(t => t.id === dep.taskId);
    return predecessor && predecessor.startDate && predecessor.endDate;
  });

  if (validDeps.length === 0) {
    return {
      startDate: task.startDate || format(new Date(), 'yyyy-MM-dd'),
      endDate: task.endDate || task.startDate || format(new Date(), 'yyyy-MM-dd'),
    };
  }

  // 计算所有依赖关系下的最晚开始日期
  let latestStartDate: Date | null = null;

  for (const dep of validDeps) {
    const predecessor = tasks.find(t => t.id === dep.taskId)!;

    // 递归计算前置任务的日期（确保前置任务日期是最新的）
    const predDates = calculateTaskDates(predecessor, tasks, calendarConfig, new Set(visited));

    const depEnd = parseISO(predDates.endDate);
    const depStart = parseISO(predDates.startDate || predDates.endDate);
    const lagDays = dep.lagDays || 0;

    let candidateStartDate: Date;

    switch (dep.type) {
      case 'FS': // Finish-to-Start: 前置任务完成后，本任务才能开始
        candidateStartDate = addWorkingDays(depEnd, lagDays + 1, calendarConfig);
        break;
      case 'SS': // Start-to-Start: 前置任务开始后，本任务才能开始
        candidateStartDate = addWorkingDays(depStart, lagDays, calendarConfig);
        break;
      case 'FF': { // Finish-to-Finish: 前置任务完成后，本任务才能完成
        const ffEndDate = addWorkingDays(depEnd, lagDays, calendarConfig);
        const duration = task.duration || 1;
        candidateStartDate = addWorkingDays(ffEndDate, -(duration - 1), calendarConfig);
        break;
      }
      case 'SF': { // Start-to-Finish: 前置任务开始后，本任务才能完成
        const sfEndDate = addWorkingDays(depStart, lagDays, calendarConfig);
        const sfDuration = task.duration || 1;
        candidateStartDate = addWorkingDays(sfEndDate, -(sfDuration - 1), calendarConfig);
        break;
      }
      default:
        candidateStartDate = depEnd;
    }

    // 确保开始日期是工作日
    while (!isWorkingDay(candidateStartDate, calendarConfig)) {
      candidateStartDate = addDays(candidateStartDate, 1);
    }

    // 取最晚的开始日期（满足所有依赖关系）
    if (latestStartDate === null || candidateStartDate > latestStartDate) {
      latestStartDate = candidateStartDate;
    }
  }

  const startDateStr = format(latestStartDate!, 'yyyy-MM-dd');

  // 计算结束日期
  const duration = task.duration || 1;
  const endDate = addWorkingDays(latestStartDate!, duration - 1, calendarConfig);
  const endDateStr = format(endDate, 'yyyy-MM-dd');

  return { startDate: startDateStr, endDate: endDateStr };
}

/**
 * 批量重排所有任务（按 WBS 层级排序）
 * @param tasks 所有任务
 * @param calendarConfig 日历配置
 */
export function autoScheduleTasks(
  tasks: Task[],
  calendarConfig: CalendarConfig
): Task[] {
  // 按层级排序：先排顶层任务，再排子任务
  const sortedTasks = [...tasks].sort((a, b) => {
    const aLevel = a.wbs.split('.').length;
    const bLevel = b.wbs.split('.').length;
    if (aLevel !== bLevel) return aLevel - bLevel;
    return a.wbs.localeCompare(b.wbs);
  });

  const updatedTasks = [...tasks];
  const visited = new Set<string>();

  sortedTasks.forEach((task) => {
    const dates = calculateTaskDates(task, updatedTasks, calendarConfig, visited);
    const taskIndex = updatedTasks.findIndex((t) => t.id === task.id);
    if (taskIndex !== -1) {
      updatedTasks[taskIndex] = {
        ...updatedTasks[taskIndex],
        startDate: dates.startDate,
        endDate: dates.endDate,
        updatedAt: new Date().toISOString(),
      };
    }
  });

  return updatedTasks;
}

/**
 * 更新单个任务的后继任务链
 * @param taskId 刚被修改的任务 ID
 * @param tasks 所有任务
 * @param calendarConfig 日历配置
 */
export function updateSuccessorChain(
  taskId: string,
  tasks: Task[],
  calendarConfig: CalendarConfig
): Task[] {
  const updatedTasks = [...tasks];
  const processedTasks = new Set<string>();

  const updateSuccessors = (predecessorId: string) => {
    // 找到所有直接依赖此任务的后继任务
    const successors = updatedTasks.filter((t) =>
      t.dependencies.some((dep) => dep.taskId === predecessorId)
    );

    successors.forEach((successor) => {
      if (processedTasks.has(successor.id)) return;

      // 使用新函数：基于前置任务的当前日期计算，不递归
      const dates = calculateTaskDatesFromCurrentPredecessors(successor, updatedTasks, calendarConfig);

      const successorIndex = updatedTasks.findIndex((t) => t.id === successor.id);
      if (successorIndex !== -1) {
        // 只有日期真正变化时才更新
        if (updatedTasks[successorIndex].startDate !== dates.startDate ||
            updatedTasks[successorIndex].endDate !== dates.endDate) {
          updatedTasks[successorIndex] = {
            ...updatedTasks[successorIndex],
            startDate: dates.startDate,
            endDate: dates.endDate,
            updatedAt: new Date().toISOString(),
          };
        }
      }

      processedTasks.add(successor.id);

      // 递归更新后继任务的后继
      updateSuccessors(successor.id);
    });
  };

  updateSuccessors(taskId);
  return updatedTasks;
}

/**
 * 便捷函数：重新排程项目（直接返回任务数组）
 */
export function rescheduleProject(project: Project): Task[] {
  const calendarConfig: CalendarConfig = {
    workingHours: { start: 9, end: 18 },
    holidays: project.holidays,
    workingDays: project.workingDays,
  };

  return autoScheduleTasks(project.tasks, calendarConfig);
}

/**
 * 便捷函数：重新排程单个任务及其后继任务
 */
export function rescheduleTaskChain(project: Project, taskId: string): Task[] {
  const calendarConfig: CalendarConfig = {
    workingHours: { start: 9, end: 18 },
    holidays: project.holidays,
    workingDays: project.workingDays,
  };

  return updateSuccessorChain(taskId, project.tasks, calendarConfig);
}
