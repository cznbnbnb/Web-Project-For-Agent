import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { Project } from './types.js';

const DATA_DIR = join(homedir(), '.project-planner', 'projects');

function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function projectPath(id: string): string {
  return join(DATA_DIR, `${id}.json`);
}

export function saveProject(project: Project): void {
  ensureDataDir();
  writeFileSync(projectPath(project.id), JSON.stringify(project, null, 2), 'utf-8');
}

export function loadProject(id: string): Project | null {
  const path = projectPath(id);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf-8')) as Project;
}

export function listProjects(): Project[] {
  ensureDataDir();
  const files = readdirSync(DATA_DIR).filter(f => f.endsWith('.json'));
  return files
    .map(f => {
      try {
        return JSON.parse(readFileSync(join(DATA_DIR, f), 'utf-8')) as Project;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Project[];
}

export function deleteProject(id: string): boolean {
  const path = projectPath(id);
  if (!existsSync(path)) return false;
  unlinkSync(path);
  return true;
}

export function getDataDir(): string {
  return DATA_DIR;
}
