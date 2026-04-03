// 任务类型
export type TaskType = 'task' | 'milestone' | 'phase';

// 任务优先级
export type Priority = 'low' | 'medium' | 'high' | 'critical';

// 任务状态
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';

// 前后置关系类型
// FS: Finish-to-Start, SS: Start-to-Start, FF: Finish-to-Finish, SF: Start-to-Finish
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

// 任务依赖关系
export interface TaskDependency {
  taskId: string;
  type: DependencyType;
  lagDays?: number; // 滞后天数，可为负数
}

// 任务定义
export interface Task {
  id: string;
  name: string;
  type: TaskType;
  wbs: string; // WBS 编号，如 "1.0", "1.1", "1.1.1"

  // 时间属性
  startDate?: string; // ISO 日期字符串
  endDate?: string;   // ISO 日期字符串
  duration?: number;  // 工期（工作日）

  // 层级关系
  parentId?: string;
  children?: string[]; // 子任务 ID 列表

  // 依赖关系
  dependencies: TaskDependency[];
  predecessors?: string[]; // 前置任务 ID（简化用）
  successors?: string[];   // 后置任务 ID

  // 任务属性
  priority: Priority;
  status: TaskStatus;
  assignee?: string;       // 负责人
  effort?: number;         // 工时（小时）
  progress: number;        // 完成百分比 0-100

  // 计算属性（排程引擎计算）
  earlyStart?: string;
  earlyFinish?: string;
  lateStart?: string;
  lateFinish?: string;
  isCritical?: boolean;    // 是否在关键路径上
  totalFloat?: number;     // 总浮动时间（天）

  // 元数据
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 项目定义
export interface Project {
  id: string;
  name: string;
  description?: string;
  tasks: Task[];
  holidays: string[]; // 节假日列表（ISO 日期）
  workingDays: number[]; // 工作日 [1,2,3,4,5] 表示周一到周五
  createdAt: string;
  updatedAt: string;
}

// 日历配置
export interface CalendarConfig {
  workingHours: { start: number; end: number }; // 每日工作时段
  holidays: string[]; // 节假日
  workingDays: number[]; // 工作日 (0=周日，1=周一，...)
}

// AI Provider 配置
export type AIProvider = 'anthropic' | 'openai' | 'custom';

export interface AIConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl?: string; // 自定义 API 地址（用于兼容 OpenAI 的接口）
}

// 应用状态
export interface AppState {
  currentProject: Project | null;
  aiConfig: AIConfig | null;
  view: 'list' | 'gantt';
  selectedTaskId?: string;
}

// WBS 编号结果
export interface WBSResult {
  wbs: string;
  level: number;
}

// 排程结果
export interface ScheduleResult {
  success: boolean;
  tasks: Task[];
  criticalPath: string[];
  errors: string[];
  projectStartDate: string;
  projectEndDate: string;
}

// 导入导出
export interface ImportResult {
  success: boolean;
  tasks: Task[];
  errors: ImportError[];
}

export interface ImportError {
  row: number;
  message: string;
}

// 甘特图配置
export interface GanttConfig {
  zoomLevel: 'day' | 'week' | 'month';
  showCriticalPath: boolean;
  showDependencies: boolean;
  startDate: string;
  endDate: string;
}
