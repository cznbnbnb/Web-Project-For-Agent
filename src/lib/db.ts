import Dexie from 'dexie';
import type { Table } from 'dexie';
import type { Project, Task } from '../types';

class ProjectDatabase extends Dexie {
  projects!: Table<Project, string>;
  tasks!: Table<Task, string>;
  settings!: Table<any, string>;

  constructor() {
    super('ProjectPlannerDB');

    this.version(1).stores({
      projects: 'id, name, updatedAt',
      tasks: 'id, projectId, parentId, wbs, updatedAt',
      settings: 'key, value',
    });
  }
}

export const db = new ProjectDatabase();

// Project CRUD
export async function saveProject(project: Project): Promise<void> {
  await db.projects.put(project);
}

export async function getProject(id: string): Promise<Project | undefined> {
  return await db.projects.get(id);
}

export async function listProjects(): Promise<Project[]> {
  return await db.projects.orderBy('updatedAt').reverse().toArray();
}

export async function deleteProject(id: string): Promise<void> {
  await db.projects.delete(id);
}

// Settings
export async function saveSetting(key: string, value: any): Promise<void> {
  await db.settings.put({ key, value });
}

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const setting = await db.settings.get(key);
  return setting?.value;
}

// 初始化默认项目
export async function createDefaultProject(): Promise<Project> {
  const { generateId } = await import('./utils');
  const { format } = await import('date-fns');
  const { getDefaultChineseHolidays } = await import('./chineseHolidays');

  const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'");

  const project: Project = {
    id: generateId(),
    name: '示例项目',
    description: '这是一个示例项目计划',
    tasks: [
      {
        id: generateId(),
        name: '项目启动',
        type: 'phase',
        wbs: '1',
        parentId: undefined,
        dependencies: [],
        priority: 'medium',
        status: 'not_started',
        progress: 0,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        duration: 10,
        createdAt: now,
        updatedAt: now,
      },
    ],
    holidays: getDefaultChineseHolidays(),
    workingDays: [1, 2, 3, 4, 5], // 周一到周五
    createdAt: now,
    updatedAt: now,
  };

  await saveProject(project);
  return project;
}
