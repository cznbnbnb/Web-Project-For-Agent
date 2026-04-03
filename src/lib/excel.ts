import * as XLSX from 'xlsx';
import type { Task, Project, ImportResult, ImportError, DependencyType, CalendarConfig } from '../types';
import { generateId } from '../lib/utils';
import { format, parseISO } from 'date-fns';
import { snapToWorkingDay } from './calendar';
import { getDefaultChineseHolidays } from './chineseHolidays';

/**
 * 导出项目计划到 Excel
 */
export function exportToExcel(project: Project): Blob {
  // 准备数据
  const data = project.tasks.map(task => ({
    'WBS 编号': task.wbs,
    '任务名称': task.name,
    '任务类型': task.type === 'task' ? '任务' : task.type === 'phase' ? '阶段' : '里程碑',
    '前置任务 ID': task.dependencies.map(d => d.taskId).join('; '),
    '前置关系类型': task.dependencies.map(d => d.type).join('; '),
    '开始日期': task.startDate || '',
    '结束日期': task.endDate || '',
    '工期 (天)': task.duration || '',
    '负责人': task.assignee || '',
    '优先级': task.priority === 'low' ? '低' : task.priority === 'medium' ? '中' : task.priority === 'high' ? '高' : '紧急',
    '状态': task.status === 'not_started' ? '未开始' : task.status === 'in_progress' ? '进行中' : task.status === 'completed' ? '已完成' : task.status === 'blocked' ? '受阻' : '已取消',
    '进度 (%)': task.progress,
    '工时 (小时)': task.effort || '',
    '备注': task.notes || '',
  }));

  // 创建工作簿
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);

  // 设置列宽
  const colWidths = [
    { wch: 10 }, // WBS
    { wch: 30 }, // 任务名称
    { wch: 10 }, // 任务类型
    { wch: 20 }, // 前置任务
    { wch: 12 }, // 关系类型
    { wch: 12 }, // 开始日期
    { wch: 12 }, // 结束日期
    { wch: 10 }, // 工期
    { wch: 12 }, // 负责人
    { wch: 10 }, // 优先级
    { wch: 10 }, // 状态
    { wch: 10 }, // 进度
    { wch: 10 }, // 工时
    { wch: 30 }, // 备注
  ];
  ws['!cols'] = colWidths;

  // 添加工作表到工作簿
  XLSX.utils.book_append_sheet(wb, ws, '项目计划');

  // 添加说明 Sheet
  const infoData = [
    ['项目计划导出说明'],
    [''],
    ['任务类型：任务、阶段、里程碑'],
    ['前置关系类型：FS(完成 - 开始)、SS(开始 - 开始)、FF(完成 - 完成)、SF(开始 - 完成)'],
    ['优先级：低、中、高、紧急'],
    ['状态：未开始、进行中、已完成、受阻、已取消'],
    [''],
    [`导出时间：${format(new Date(), 'yyyy/MM/dd HH:mm:ss')}`],
    [`项目名称：${project.name}`],
  ];
  const infoWs = XLSX.utils.json_to_sheet(infoData.map(row => ({ '说明': row[0] })));
  infoWs['!cols'] = [{ wch: 50 }];
  XLSX.utils.book_append_sheet(wb, infoWs, '说明');

  // 生成 Blob
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * 从 Excel 导入项目计划
 */
export function importFromExcel(file: File, calendarConfig?: CalendarConfig): Promise<ImportResult> {
  const calendar: CalendarConfig = calendarConfig ?? {
    workingHours: { start: 9, end: 18 },
    holidays: getDefaultChineseHolidays(),
    workingDays: [1, 2, 3, 4, 5],
  };
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result as ArrayBuffer;
        const wb = XLSX.read(data, { type: 'array' });

        // 获取第一个工作表
        const sheetName = wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json<any>(ws);

        const errors: ImportError[] = [];
        const tasks: Task[] = [];
        const now = new Date().toISOString();

        // 解析每一行
        jsonData.forEach((row, index) => {
          try {
            // 跳过空行
            if (!row['WBS 编号'] && !row['任务名称']) return;

            const taskTypeMap: Record<string, Task['type']> = {
              '任务': 'task',
              '阶段': 'phase',
              '里程碑': 'milestone',
              'task': 'task',
              'phase': 'phase',
              'milestone': 'milestone',
            };

            const priorityMap: Record<string, Task['priority']> = {
              '低': 'low',
              '中': 'medium',
              '高': 'high',
              '紧急': 'critical',
              'low': 'low',
              'medium': 'medium',
              'high': 'high',
              'critical': 'critical',
            };

            const statusMap: Record<string, Task['status']> = {
              '未开始': 'not_started',
              '进行中': 'in_progress',
              '已完成': 'completed',
              '受阻': 'blocked',
              '已取消': 'cancelled',
              'not_started': 'not_started',
              'in_progress': 'in_progress',
              'completed': 'completed',
              'blocked': 'blocked',
              'cancelled': 'cancelled',
            };

            // 解析依赖关系
            const dependencies: Task['dependencies'] = [];
            if (row['前置任务 ID']) {
              const predecessorIds = String(row['前置任务 ID']).split(';').map(id => id.trim()).filter(Boolean);
              const relationTypes = String(row['前置关系类型'] || 'FS').split(';').map(t => t.trim().toUpperCase() as DependencyType);

              predecessorIds.forEach((preId, i) => {
                dependencies.push({
                  taskId: preId,
                  type: relationTypes[i] || 'FS',
                });
              });
            }

            const rawStartDate = row['开始日期'] ? parseExcelDate(row['开始日期']) : row['开始时间'] ? parseExcelDate(row['开始时间']) : row['Start Date'] ? parseExcelDate(row['Start Date']) : undefined;
            const rawEndDate = row['结束日期'] ? parseExcelDate(row['结束日期']) : row['结束时间'] ? parseExcelDate(row['结束时间']) : row['End Date'] ? parseExcelDate(row['End Date']) : undefined;
            // 将日期对齐到工作日（跳过节假日和周末）
            const importedStartDate = rawStartDate ? format(snapToWorkingDay(parseISO(rawStartDate), calendar), 'yyyy-MM-dd') : undefined;
            const importedEndDate = rawEndDate ? format(snapToWorkingDay(parseISO(rawEndDate), calendar), 'yyyy-MM-dd') : undefined;
            const importedDuration = (() => {
              const explicit = Number(row['工期 (天)'] || row['Duration'] || row['工期']);
              if (explicit) return explicit;
              if (importedStartDate && importedEndDate) {
                const ms = new Date(importedEndDate).getTime() - new Date(importedStartDate).getTime();
                if (ms >= 0) return Math.max(1, Math.round(ms / 86400000) + 1);
              }
              return 1;
            })();

            const task: Task = {
              id: generateId(),
              name: row['任务名称'] || row['Name'] || '未命名任务',
              type: taskTypeMap[row['任务类型'] || row['Type']] || 'task',
              wbs: String(row['WBS 编号'] || row['WBS'] || '1'),
              parentId: undefined, // 后续根据 WBS 计算
              dependencies,
              predecessors: [],
              successors: [],
              priority: priorityMap[row['优先级'] || row['Priority']] || 'medium',
              status: statusMap[row['状态'] || row['Status']] || 'not_started',
              progress: Number(row['进度 (%)'] || row['Progress'] || row['进度']) || 0,
              startDate: importedStartDate,
              endDate: importedEndDate,
              duration: importedDuration,
              assignee: row['负责人'] || row['Assignee'] || undefined,
              effort: Number(row['工时 (小时)'] || row['Effort']) || undefined,
              notes: row['备注'] || row['Notes'] || undefined,
              createdAt: now,
              updatedAt: now,
            };

            tasks.push(task);
          } catch (error) {
            errors.push({
              row: index + 2, // Excel 行号从 1 开始，加上表头
              message: error instanceof Error ? error.message : '解析失败',
            });
          }
        });

        // 根据 WBS 构建父子关系
        buildParentChildRelationship(tasks);

        resolve({
          success: errors.length === 0,
          tasks,
          errors,
        });
      } catch (error) {
        resolve({
          success: false,
          tasks: [],
          errors: [{
            row: 0,
            message: error instanceof Error ? error.message : '文件解析失败',
          }],
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        tasks: [],
        errors: [{ row: 0, message: '文件读取失败' }],
      });
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * 解析 Excel 日期
 */
function parseExcelDate(dateValue: string | number | Date): string {
  if (dateValue instanceof Date) {
    return format(dateValue, 'yyyy-MM-dd');
  }

  if (typeof dateValue === 'number') {
    // Excel 序列日期
    const date = new Date(Math.round((dateValue - 25569) * 86400 * 1000));
    return format(date, 'yyyy-MM-dd');
  }

  // 字符串日期
  const dateStr = String(dateValue).trim();

  // 处理 Excel 日期时间格式 "2024/1/15" 或 "2024/01/15"
  const excelDatePattern = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/;
  const match = dateStr.match(excelDatePattern);
  if (match) {
    const year = parseInt(match[1]);
    const month = parseInt(match[2]) - 1; // JS 月份从 0 开始
    const day = parseInt(match[3]);
    const date = new Date(year, month, day);
    if (!isNaN(date.getTime())) {
      return format(date, 'yyyy-MM-dd');
    }
  }

  // 尝试多种格式
  const formats: RegExp[] = [
    /^(\d{4})-(\d{1,2})-(\d{1,2})$/, // YYYY-MM-DD
    /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, // YYYY/MM/DD
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, // MM/DD/YYYY
  ];

  for (const formatRegex of formats) {
    const match = dateStr.match(formatRegex);
    if (match) {
      const year = match[1];
      const month = match[2].padStart(2, '0');
      const day = match[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }

  // fallback 到 Date 解析
  const date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return format(date, 'yyyy-MM-dd');
  }

  return dateStr;
}

/**
 * 根据 WBS 构建父子关系
 */
function buildParentChildRelationship(tasks: Task[]): void {
  // 按 WBS 排序
  tasks.sort((a, b) => a.wbs.localeCompare(b.wbs, 'zh-CN'));

  tasks.forEach(task => {
    const wbsParts = task.wbs.split('.');

    if (wbsParts.length === 1) {
      // 根任务
      task.parentId = undefined;
    } else {
      // 子任务 - 查找父任务
      const parentWbs = wbsParts.slice(0, -1).join('.');
      const parent = tasks.find(t => t.wbs === parentWbs);
      if (parent) {
        task.parentId = parent.id;
        if (!parent.children) {
          parent.children = [];
        }
        parent.children.push(task.id);
      }
    }
  });
}

/**
 * 下载 Excel 文件
 */
export function downloadExcel(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
