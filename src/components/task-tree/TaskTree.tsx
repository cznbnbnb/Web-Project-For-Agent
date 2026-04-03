import { useState, useCallback, useEffect } from 'react';
import { TaskTreeItem } from './TaskTreeItem';
import type { Task, DependencyType } from '../../types';
import { useProjectStore } from '../../store/projectStore';
import { Plus, RotateCcw, Trash2, ClipboardList } from 'lucide-react';
import { Dialog } from '../ui/Dialog';
import { rescheduleProject } from '../../engine/chainScheduler';
import { recalculateAllWbs } from '../../lib/wbs';
import { isDescendant, cn } from '../../lib/utils';

interface TaskTreeProps {
  tasks: Task[];
}

export function TaskTree({ tasks }: TaskTreeProps) {
  const {
    updateTask,
    deleteTask,
    addTask,
    setCurrentProject,
    updateProject,
    currentProject,
    selectedTaskId,
    selectTask,
  } = useProjectStore();

  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['1']));
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // 获取根任务
  const rootTasks = tasks.filter(t => !t.parentId);

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  }, []);

  const handleAddSubtask = useCallback(async (parentId: string) => {
    await addTask({
      name: '新任务',
      type: 'task',
      duration: 1,
      priority: 'medium',
      status: 'not_started',
    }, parentId);
    // 自动展开父任务
    setExpandedIds(prev => new Set(prev).add(parentId));
  }, [addTask]);

  const handleAddRootTask = useCallback(async () => {
    await addTask({
      name: '新任务',
      type: 'task',
      duration: 5,
      priority: 'medium',
      status: 'not_started',
    });
  }, [addTask]);

  // 升级任务（提升为父任务的同级）
  const handlePromote = useCallback(async (taskId: string) => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.parentId) return;

    const parent = project.tasks.find(t => t.id === task.parentId);
    if (!parent) return;

    // 更新任务的 parentId 为父任务的父级
    await updateTask(taskId, { parentId: parent.parentId });

    // 重新计算 WBS
    const updatedProject = useProjectStore.getState().currentProject;
    if (updatedProject) {
      const recalculatedTasks = recalculateAllWbs(updatedProject.tasks);
      await updateProject({ tasks: recalculatedTasks });
    }
  }, [updateTask, updateProject]);

  // 降级任务（缩进为前一个任务的子任务）
  const handleDemote = useCallback(async (taskId: string) => {
    const project = useProjectStore.getState().currentProject;
    if (!project) return;

    const task = project.tasks.find(t => t.id === taskId);
    if (!task || !task.parentId) return;

    // 找到同级的上一个任务
    const siblings = project.tasks.filter(t =>
      t.parentId === task.parentId &&
      t.wbs < task.wbs
    );

    // 按 WBS 排序，找到紧邻的前一个任务
    const prevSibling = siblings.sort((a, b) => b.wbs.localeCompare(a.wbs))[0];

    if (!prevSibling) return; // 没有前一个任务，无法降级

    // 检查是否会形成循环（不能降级到自己的后代下面）
    if (isDescendant(project.tasks, task.id, prevSibling.id)) {
      alert('无法降级：不能降级到自己的子任务下方');
      return;
    }

    // 更新任务的 parentId 为前一个任务
    await updateTask(taskId, { parentId: prevSibling.id });

    // 重新计算 WBS
    const updatedProject = useProjectStore.getState().currentProject;
    if (updatedProject) {
      const recalculatedTasks = recalculateAllWbs(updatedProject.tasks);
      await updateProject({ tasks: recalculatedTasks });
    }
  }, [updateTask, updateProject]);

  const handleEdit = useCallback((task: Task) => {
    setEditingTask(task);
  }, []);

  const handleDelete = useCallback(async (taskId: string) => {
    if (confirm('确定要删除此任务及其所有子任务吗？')) {
      await deleteTask(taskId);
    }
  }, [deleteTask]);

  const handleSaveEdit = useCallback(async (updates: Partial<Task>) => {
    if (editingTask) {
      // 直接调用 updateTask，链式更新会在其中处理
      await updateTask(editingTask.id, updates);
      setEditingTask(null);
    }
  }, [editingTask, updateTask]);

  // 单元格编辑处理
  const handleCellEdit = useCallback(async (taskId: string, field: keyof Task, value: any) => {
    // 获取当前任务
    const currentProjectState = useProjectStore.getState().currentProject;
    if (!currentProjectState) return;

    const currentTask = currentProjectState.tasks.find(t => t.id === taskId);
    if (!currentTask) return;

    // 构建更新对象
    const updates: Partial<Task> = { [field]: value };

    // 直接调用 updateTask，链式更新会在其中处理
    await updateTask(taskId, updates);
  }, [updateTask]);

  const handleReschedule = useCallback(async () => {
    if (!currentProject) return;

    const scheduledTasks = rescheduleProject(currentProject);
    await setCurrentProject({
      ...currentProject,
      tasks: scheduledTasks,
    });
    alert(`排程完成！共 ${scheduledTasks.length} 个任务`);
  }, [currentProject, setCurrentProject]);

  // 自动展开第一个任务
  useEffect(() => {
    if (rootTasks.length > 0 && expandedIds.size === 0) {
      setExpandedIds(new Set([rootTasks[0].id]));
    }
  }, [rootTasks]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <button
            onClick={handleAddRootTask}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" />
            添加任务
          </button>
          <button
            onClick={handleReschedule}
            className="flex items-center gap-2 px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            重新排程
          </button>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ClipboardList className="w-4 h-4" />
          <span className="font-medium text-foreground">{tasks.length}</span> 个任务
        </div>
      </div>

      {/* 表头 */}
      <div className="task-tree-grid px-6 py-3 bg-muted/50 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-border">
        <div />
        <div />
        <div />
        <div className="text-right pr-3">WBS</div>
        <div className="pl-4">任务名称</div>
        <div className="px-3 border-l border-border">前置任务</div>
        <div className="px-3 text-right border-l border-border">开始时间</div>
        <div className="px-3 text-right border-l border-border">结束时间</div>
        <div className="px-3 text-right border-l border-border">工期</div>
        <div className="px-3 border-l border-border">负责人</div>
        <div className="px-3 text-center border-l border-border">优先级</div>
        <div className="px-3 border-l border-border">进度</div>
        <div className="px-3 text-center border-l border-border">操作</div>
      </div>

      {/* 任务列表 */}
      <div className="flex-1 overflow-auto">
        {rootTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <ClipboardList className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">还没有任务</h3>
            <p className="text-sm text-muted-foreground mb-6">点击"添加任务"开始规划你的项目</p>
            <button
              onClick={handleAddRootTask}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              添加第一个任务
            </button>
          </div>
        ) : (
          rootTasks.map(task => (
            <TaskTreeItem
              key={task.id}
              task={task}
              allTasks={tasks}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onSelect={selectTask}
              isSelected={selectedTaskId === task.id}
              onAddSubtask={handleAddSubtask}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onCellEdit={handleCellEdit}
              onPromote={handlePromote}
              onDemote={handleDemote}
            />
          ))
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingTask && (
        <TaskEditModal
          task={editingTask}
          allTasks={tasks}
          onSave={handleSaveEdit}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}

// 任务编辑弹窗
function TaskEditModal({
  task,
  allTasks,
  onSave,
  onClose,
}: {
  task: Task;
  allTasks: Task[];
  onSave: (updates: Partial<Task>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState<Partial<Task>>({
    name: task.name,
    type: task.type,
    duration: task.duration,
    priority: task.priority,
    status: task.status,
    assignee: task.assignee,
    progress: task.progress,
    startDate: task.startDate,
    endDate: task.endDate,
    dependencies: task.dependencies || [],
  });

  // 获取可选的前置任务（排除自己和自己的子任务）
  const getAvailablePredecessors = () => {
    const excludeIds = new Set([task.id]);
    const collectChildren = (id: string) => {
      const children = allTasks.filter(t => t.parentId === id);
      children.forEach(child => {
        excludeIds.add(child.id);
        collectChildren(child.id);
      });
    };
    collectChildren(task.id);
    return allTasks.filter(t => !excludeIds.has(t.id));
  };

  const availablePredecessors = getAvailablePredecessors();

  const handleAddDependency = () => {
    setFormData({
      ...formData,
      dependencies: [...(formData.dependencies || []), { taskId: '', type: 'FS', lagDays: 0 }],
    });
  };

  const handleUpdateDependency = (index: number, field: 'taskId' | 'type' | 'lagDays', value: any) => {
    const newDependencies: Task['dependencies'] = [...(formData.dependencies || [])];
    newDependencies[index] = { ...newDependencies[index], [field]: value };
    setFormData({ ...formData, dependencies: newDependencies });
  };

  const handleRemoveDependency = (index: number) => {
    const newDependencies = [...(formData.dependencies || [])];
    newDependencies.splice(index, 1);
    setFormData({ ...formData, dependencies: newDependencies });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Dialog open onClose={onClose} title="编辑任务" className="max-w-2xl">
        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-2 gap-6">
            {/* 第一行：任务名称 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-primary rounded-full" />
                  任务名称
                </span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="请输入任务名称"
                required
              />
            </div>

            {/* 第二行：类型和状态 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-500 rounded-full" />
                  类型
                </span>
              </label>
              <select
                value={formData.type}
                onChange={e => setFormData({ ...formData, type: e.target.value as Task['type'] })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="task">📄 任务</option>
                <option value="phase">📁 阶段</option>
                <option value="milestone">🚩 里程碑</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded-full" />
                  状态
                </span>
              </label>
              <select
                value={formData.status}
                onChange={e => setFormData({ ...formData, status: e.target.value as Task['status'] })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="not_started">⭕ 未开始</option>
                <option value="in_progress">🔵 进行中</option>
                <option value="completed">✅ 已完成</option>
                <option value="blocked">🔴 受阻</option>
                <option value="cancelled">❌ 已取消</option>
              </select>
            </div>

            {/* 第三行：优先级和工期 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full" />
                  优先级
                </span>
              </label>
              <select
                value={formData.priority}
                onChange={e => setFormData({ ...formData, priority: e.target.value as Task['priority'] })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              >
                <option value="low">⚪ 低</option>
                <option value="medium">🟡 中</option>
                <option value="high">🟠 高</option>
                <option value="critical">🔴 紧急</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-purple-500 rounded-full" />
                  工期（天）
                </span>
              </label>
              <input
                type="number"
                value={formData.duration || ''}
                onChange={e => setFormData({ ...formData, duration: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                min="1"
              />
            </div>

            {/* 第四行：负责人和开始日期 */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-cyan-500 rounded-full" />
                  负责人
                </span>
              </label>
              <input
                type="text"
                value={formData.assignee || ''}
                onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                placeholder="张三"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-pink-500 rounded-full" />
                  开始日期
                </span>
              </label>
              <input
                type="date"
                value={formData.startDate || ''}
                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
              />
            </div>

            {/* 第五行：进度 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-3">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-green-500 rounded-full" />
                  进度 <span className="text-muted-foreground font-mono">({formData.progress || 0}%)</span>
                </span>
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  value={formData.progress || 0}
                  onChange={e => setFormData({ ...formData, progress: parseInt(e.target.value) })}
                  className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                  min="0"
                  max="100"
                  step="5"
                />
                <div className="flex gap-1">
                  {[0, 25, 50, 75, 100].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setFormData({ ...formData, progress: val })}
                      className={cn(
                        "px-2 py-1 text-xs rounded-md transition-colors",
                        formData.progress === val
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      )}
                    >
                      {val}%
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 前置任务配置 */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-foreground mb-3">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-red-500 rounded-full" />
                  前置任务
                </span>
              </label>
              <div className="space-y-2">
                {formData.dependencies?.map((dep, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      value={dep.taskId}
                      onChange={e => handleUpdateDependency(index, 'taskId', e.target.value)}
                      className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                    >
                      <option value="">选择前置任务</option>
                      {availablePredecessors.map(t => (
                        <option key={t.id} value={t.id}>{t.wbs} - {t.name}</option>
                      ))}
                    </select>
                    <select
                      value={dep.type}
                      onChange={e => handleUpdateDependency(index, 'type', e.target.value as DependencyType)}
                      className="w-24 px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                      title="依赖关系类型"
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                      <option value="FF">FF</option>
                      <option value="SF">SF</option>
                    </select>
                    <input
                      type="number"
                      value={dep.lagDays || 0}
                      onChange={e => handleUpdateDependency(index, 'lagDays', parseInt(e.target.value) || 0)}
                      className="w-20 px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors"
                      placeholder="滞后"
                      title="滞后天数（可为负数）"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveDependency(index)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 transition-colors"
                      title="移除依赖"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {(!formData.dependencies || formData.dependencies.length === 0) && (
                  <p className="text-sm text-muted-foreground italic">暂无前置任务</p>
                )}
              </div>
              <button
                type="button"
                onClick={handleAddDependency}
                className="mt-2 flex items-center gap-1 px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                添加前置任务
              </button>
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors shadow-sm"
            >
              保存修改
            </button>
          </div>
        </form>
    </Dialog>
  );
}

