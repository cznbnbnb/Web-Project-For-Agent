'use client';

import { useState } from 'react';
import type { Task, DependencyType } from '../../types';
import { X, Plus, Trash2 } from 'lucide-react';
import { cn } from '../../lib/utils';
import { TaskSelector } from '../../components/ui/TaskSelector';

interface TaskQuickEditModalProps {
  task: Task;
  allTasks: Task[];
  onSave: (updates: Partial<Task>) => void;
  onClose: () => void;
}

export function TaskQuickEditModal({ task, allTasks, onSave, onClose }: TaskQuickEditModalProps) {
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

  // 检查当前表单数据是否有前置任务依赖（实时响应表单变化）
  const hasDependencies = (formData.dependencies && formData.dependencies.some(dep => dep.taskId && dep.taskId !== '')) ||
                          (task.predecessors && task.predecessors.length > 0);

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
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#ffffff] dark:bg-[#09090b] rounded-xl shadow-2xl w-full max-w-2xl border border-border overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
          <h2 className="text-lg font-semibold text-foreground">编辑任务</h2>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

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
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={hasDependencies}
              />
              {hasDependencies && (
                <p className="mt-1 text-xs text-amber-600 dark:text-amber-500">
                  ⚠️ 已关联前置任务，日期由排程引擎自动计算
                </p>
              )}
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
                    <TaskSelector
                      value={dep.taskId}
                      onChange={(taskId) => handleUpdateDependency(index, 'taskId', taskId)}
                      availableTasks={availablePredecessors}
                      placeholder="选择前置任务"
                      className="flex-1"
                    />
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
      </div>
    </div>
  );
}
