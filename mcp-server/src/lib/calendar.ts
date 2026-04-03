import { addDays, format, parseISO } from 'date-fns';
import type { CalendarConfig } from '../types.js';

// 导出 addDays 供 chainScheduler 使用
export { addDays };

/**
 * 检查日期是否为工作日
 */
export function isWorkingDay(date: Date, config: CalendarConfig): boolean {
  const dayOfWeek = date.getDay();
  const dateStr = format(date, 'yyyy-MM-dd');

  // 检查是否为节假日
  if (config.holidays.includes(dateStr)) {
    return false;
  }

  // 检查是否为工作日
  return config.workingDays.includes(dayOfWeek);
}

/**
 * 添加工作日（跳过节假日和周末）
 * days 可为负数（用于 FF/SF 关系反向计算）
 */
export function addWorkingDays(startDate: Date, days: number, config: CalendarConfig): Date {
  let result = new Date(startDate);
  let remaining = Math.abs(days);
  const direction = days >= 0 ? 1 : -1;

  while (remaining > 0) {
    result = addDays(result, direction);
    if (isWorkingDay(result, config)) {
      remaining--;
    }
  }

  return result;
}

/**
 * 计算两个日期之间的工作日数
 */
export function differenceInWorkingDays(startDate: Date, endDate: Date, config: CalendarConfig): number {
  let count = 0;
  let current = new Date(startDate);
  const end = new Date(endDate);

  while (current < end) {
    current = addDays(current, 1);
    if (isWorkingDay(current, config)) {
      count++;
    }
  }

  return count;
}

/**
 * 将日期对齐到工作日：若当天已是工作日则返回原日期，否则顺延到下一个工作日
 */
export function snapToWorkingDay(date: Date, config: CalendarConfig): Date {
  let result = new Date(date);
  while (!isWorkingDay(result, config)) {
    result = addDays(result, 1);
  }
  return result;
}

/**
 * 找到下一个工作日
 */
export function nextWorkingDay(date: Date, config: CalendarConfig): Date {
  let result = addDays(date, 1);
  while (!isWorkingDay(result, config)) {
    result = addDays(result, 1);
  }
  return result;
}

/**
 * 找到上一个工作日
 */
export function previousWorkingDay(date: Date, config: CalendarConfig): Date {
  let result = addDays(date, -1);
  while (!isWorkingDay(result, config)) {
    result = addDays(result, -1);
  }
  return result;
}

/**
 * 计算任务结束日期（考虑工作日）
 */
export function calculateEndDate(startDate: string, duration: number, config: CalendarConfig): string {
  const start = parseISO(startDate);
  const end = addWorkingDays(start, duration - 1, config); // -1 因为开始日期也算一天
  return format(end, 'yyyy-MM-dd');
}

/**
 * 计算任务开始日期（根据结束日期和工期反推）
 */
export function calculateStartDate(endDate: string, duration: number, config: CalendarConfig): string {
  const end = parseISO(endDate);
  let result = new Date(end);
  let remaining = duration - 1;

  while (remaining > 0) {
    result = addDays(result, -1);
    if (isWorkingDay(result, config)) {
      remaining--;
    }
  }

  return format(result, 'yyyy-MM-dd');
}

/**
 * 格式化日期显示
 */
export function formatDate(dateString: string): string {
  return format(parseISO(dateString), 'yyyy/MM/dd');
}

/**
 * 获取月份名称
 */
export function getMonthName(date: Date): string {
  return format(date, 'yyyy 年 M 月');
}
