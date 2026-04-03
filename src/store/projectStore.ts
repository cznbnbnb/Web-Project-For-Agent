import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Project, Task, AIConfig, TaskDependency } from '../types';
import { db, saveProject, saveSetting, getSetting, createDefaultProject } from '../lib/db';
import { calculateTaskDates, updateSuccessorChain } from '../engine/chainScheduler';
import { isDescendant } from '../lib/utils';
import { snapToWorkingDay } from '../lib/calendar';
import { getDefaultChineseHolidays } from '../lib/chineseHolidays';
import { parseISO, format } from 'date-fns';

interface ProjectState {
  // State
  currentProject: Project | null;
  aiConfig: AIConfig | null;
  view: 'list' | 'gantt';
  selectedTaskId?: string;
  isInitialized: boolean;

  // Actions - Project
  initialize: () => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  updateProject: (updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  // Actions - Tasks
  addTask: (task: Partial<Task>, parentId?: string) => Promise<Task>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  moveTask: (taskId: string, newParentId?: string, newIndex?: number) => Promise<void>;

  // Actions - AI Config
  setAIConfig: (config: AIConfig) => Promise<void>;

  // Actions - UI
  setView: (view: 'list' | 'gantt') => void;
  selectTask: (taskId?: string) => void;
}

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
      // Initial State
      currentProject: null,
      aiConfig: null,
      view: 'list',
      selectedTaskId: undefined,
      isInitialized: false,

      // Initialize
      initialize: async () => {
        // 加载 AI 配置
        const aiConfig = await getSetting<AIConfig>('aiConfig');

        // 加载或创建项目
        const projects = await db.projects.toArray();
        let project = projects.length > 0 ? projects[0] : await createDefaultProject();

        set({
          currentProject: project,
          aiConfig: aiConfig || null,
          isInitialized: true
        });
      },

      // Project Actions
      setCurrentProject: (project) => {
        set({ currentProject: project });
      },

      updateProject: async (updates) => {
        const project = get().currentProject;
        if (!project) return;

        const updated = { ...project, ...updates, updatedAt: new Date().toISOString() };
        await saveProject(updated);
        set({ currentProject: updated });
      },

      deleteProject: async (id) => {
        await db.projects.delete(id);
        set({ currentProject: null });
      },

      // Task Actions
      addTask: async (taskData, parentId) => {
        const project = get().currentProject;
        if (!project) throw new Error('No active project');

        const { generateId } = await import('../lib/utils');
        const { calculateNextWbs } = await import('../lib/wbs');

        const now = new Date().toISOString();

        // 生成 WBS 编号
        const wbs = calculateNextWbs(project.tasks, parentId);

        const newTask: Task = {
          id: generateId(),
          name: taskData.name || '新任务',
          type: taskData.type || 'task',
          wbs,
          parentId,
          children: [],
          dependencies: [],
          priority: taskData.priority || 'medium',
          status: taskData.status || 'not_started',
          progress: taskData.progress ?? 0,
          startDate: taskData.startDate,
          endDate: taskData.endDate,
          duration: taskData.duration,
          assignee: taskData.assignee,
          notes: taskData.notes,
          createdAt: now,
          updatedAt: now,
        };

        // 构建新任务列表：包含新任务，并更新父任务的 children
        const updatedTasks = [...project.tasks, newTask];

        // 更新父任务的 children
        if (parentId) {
          const parentIndex = updatedTasks.findIndex(t => t.id === parentId);
          if (parentIndex !== -1) {
            const parentTask = updatedTasks[parentIndex];
            updatedTasks[parentIndex] = {
              ...parentTask,
              children: [...(parentTask.children || []), newTask.id],
              updatedAt: now,
            };
          }
        }

        const updatedProject = {
          ...project,
          tasks: updatedTasks,
          updatedAt: now,
        };

        await saveProject(updatedProject);
        set({ currentProject: updatedProject });

        return newTask;
      },

      updateTask: async (taskId, updates) => {
        const project = get().currentProject;
        if (!project) return;

        const task = project.tasks.find(t => t.id === taskId);
        if (!task) return;

        const now = new Date().toISOString();

        // 构建日历配置（若项目未配置节假日则使用中国法定节假日）
        const calendarConfig = {
          workingHours: { start: 9, end: 18 } as const,
          holidays: project.holidays.length > 0 ? project.holidays : getDefaultChineseHolidays(),
          workingDays: project.workingDays,
        };

        // 将手动输入的日期对齐到工作日（跳过节假日和周末）
        if (updates.startDate) {
          updates = { ...updates, startDate: format(snapToWorkingDay(parseISO(updates.startDate as string), calendarConfig), 'yyyy-MM-dd') };
        }
        if (updates.endDate) {
          updates = { ...updates, endDate: format(snapToWorkingDay(parseISO(updates.endDate as string), calendarConfig), 'yyyy-MM-dd') };
        }

        // 检查是否有任何需要触发链式更新的变化
        const needsChainUpdate =
          updates.dependencies !== undefined ||
          updates.startDate !== undefined ||
          updates.duration !== undefined ||
          updates.endDate !== undefined;

        // 更新当前任务
        let updatedTask = { ...task, ...updates, updatedAt: now };

        // 如果修改了前置任务，检查循环依赖并计算新日期
        if (updates.dependencies !== undefined) {
          const newDependencies = updates.dependencies as TaskDependency[];

          // 检查循环依赖：不能将子孙任务设为前置
          for (const dep of newDependencies) {
            if (isDescendant(project.tasks, taskId, dep.taskId)) {
              throw new Error(`无法设置依赖：任务 "${task.name}" 的后代任务不能作为其前置任务`);
            }
          }

          // 计算新的开始和结束日期
          const dates = calculateTaskDates(updatedTask, project.tasks, calendarConfig, new Set());
          updatedTask = { ...updatedTask, startDate: dates.startDate, endDate: dates.endDate };
        }

        // 如果修改了开始日期，根据工期重新计算结束日期
        if (updates.startDate !== undefined && updates.duration === undefined && task.duration) {
          const { calculateEndDate } = await import('../lib/calendar');
          updatedTask.endDate = calculateEndDate(updates.startDate as string, task.duration, calendarConfig);
        }

        // 如果修改了结束日期，根据工期反推开始日期
        if (updates.endDate !== undefined && updates.startDate === undefined && task.duration) {
          const { calculateStartDate } = await import('../lib/calendar');
          updatedTask.startDate = calculateStartDate(updates.endDate as string, task.duration, calendarConfig);
        }

        // 如果修改了工期，根据开始日期重新计算结束日期
        if (updates.duration !== undefined && updates.startDate === undefined && task.startDate) {
          const { calculateEndDate } = await import('../lib/calendar');
          updatedTask.endDate = calculateEndDate(task.startDate, updates.duration as number, calendarConfig);
        }

        const updatedProject = {
          ...project,
          tasks: project.tasks.map(t => t.id === taskId ? updatedTask : t),
          updatedAt: now,
        };

        // 如果需要链式更新，更新所有后继任务
        if (needsChainUpdate) {
          const updatedTasks = updateSuccessorChain(taskId, updatedProject.tasks, calendarConfig);
          updatedProject.tasks = updatedTasks;
        }

        await saveProject(updatedProject);
        set({ currentProject: updatedProject });
      },

      deleteTask: async (taskId) => {
        const project = get().currentProject;
        if (!project) return;

        // 递归删除子任务
        const taskToDelete = project.tasks.find(t => t.id === taskId);
        if (!taskToDelete) return;

        const deleteRecursive = (id: string, tasks: Task[]): string[] => {
          const task = tasks.find(t => t.id === id);
          if (!task?.children) return [id];

          const childIds = task.children.flatMap(childId => deleteRecursive(childId, tasks));
          return [...childIds, id];
        };

        const allTaskIdsToDelete = deleteRecursive(taskId, project.tasks);

        const updatedProject = {
          ...project,
          tasks: project.tasks.filter(t => !allTaskIdsToDelete.includes(t.id)),
          updatedAt: new Date().toISOString(),
        };

        await saveProject(updatedProject);
        set({ currentProject: updatedProject });
      },

      moveTask: async (_taskId, _newParentId, _newIndex) => {
        // 拖拽移动功能待实现
      },

      // AI Config
      setAIConfig: async (config) => {
        await saveSetting('aiConfig', config);
        set({ aiConfig: config });
      },

      // UI Actions
      setView: (view) => {
        set({ view });
      },

      selectTask: (taskId) => {
        set({ selectedTaskId: taskId });
      },
    }),
    {
      name: 'project-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        view: state.view,
        selectedTaskId: state.selectedTaskId,
        aiConfig: state.aiConfig,
      }),
    }
  )
);
