import { useState, useEffect } from 'react';
import { TaskTree } from './components/task-tree/TaskTree';
import { GanttChart } from './components/gantt/GanttChart';
import { ImportExport } from './components/import-export/ImportExport';
import { AISettings } from './components/settings/AISettings';
import { AgentCommandPalette } from './components/agent/AgentCommandPalette';
import { ToastContainer } from './components/ui/Toast';
import { useProjectStore } from './store/projectStore';
import { List, BarChart3, LayoutGrid, Trash2 } from 'lucide-react';
import { cn } from './lib/utils';
import { db } from './lib/db';

function App() {
  const { currentProject, view, setView, isInitialized, initialize } = useProjectStore();
  const [isProjectLoading, setIsProjectLoading] = useState(true);

  // 初始化
  useEffect(() => {
    initialize().then(() => setIsProjectLoading(false));
  }, [initialize]);

  // 清空所有数据
  const handleClearAll = async () => {
    if (confirm('确定要清空所有项目数据吗？此操作不可恢复。')) {
      // 清空 IndexedDB
      await db.projects.clear();
      await db.settings.clear();
      // 清空 localStorage
      localStorage.clear();
      // 刷新页面
      window.location.reload();
    }
  };

  if (!isInitialized || isProjectLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* 顶部导航栏 */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/80 backdrop-blur-xl">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-purple-600 flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Project Planner</h1>
              <p className="text-xs text-muted-foreground">项目计划编辑器</p>
            </div>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {currentProject?.name || '未选择项目'}
            </span>
            {currentProject && (
              <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                {currentProject.tasks.length} 任务
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 视图切换 */}
          <div className="flex p-1 border border-border rounded-lg bg-muted/30">
            <button
              onClick={() => setView('list')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                view === 'list'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <List className="w-4 h-4" />
              列表
            </button>
            <button
              onClick={() => setView('gantt')}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                view === 'gantt'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <BarChart3 className="w-4 h-4" />
              甘特图
            </button>
          </div>

          {/* 导入导出 */}
          <ImportExport />

          {/* AI 设置 */}
          <AISettings />

          {/* 清空数据 */}
          <button
            onClick={handleClearAll}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg text-sm font-medium transition-colors"
            title="清空所有数据（不可恢复）"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-xs">清空</span>
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main className="flex-1 overflow-hidden">
        {view === 'list' ? (
          <TaskTree tasks={currentProject?.tasks || []} />
        ) : (
          <GanttChart tasks={currentProject?.tasks || []} />
        )}
      </main>

      {/* AI 命令面板 */}
      <AgentCommandPalette />

      {/* Toast 通知 */}
      <ToastContainer />
    </div>
  );
}

export default App;
