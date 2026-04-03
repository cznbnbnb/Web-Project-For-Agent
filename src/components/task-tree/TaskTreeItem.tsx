import { cn } from '../../lib/utils';
import { ChevronRight, ChevronDown, Folder, FileText, Flag, CheckCircle2, Clock, AlertCircle, Circle, Pencil, Plus, Trash2, ArrowUp, ArrowDown, Check, X } from 'lucide-react';
import type { Task } from '../../types';
import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

// 可编辑单元格组件
interface EditableCellProps {
  value: string | number | undefined;
  onSave?: (value: any) => void;
  type?: 'text' | 'number' | 'date' | 'select';
  options?: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
  title?: string;
  disabled?: boolean; // 新增禁用属性
  disabledReason?: string; // 禁用原因提示
}

function EditableCell({ value, onSave, type = 'text', options, className, placeholder, title, disabled, disabledReason }: EditableCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value ?? '');

  const handleBlur = () => {
    setIsEditing(false);
    if (onSave && editValue !== value) {
      onSave(editValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleBlur();
    } else if (e.key === 'Escape') {
      setEditValue(value ?? '');
      setIsEditing(false);
    }
  };

  if (isEditing) {
    if (type === 'select' && options) {
      return (
        <select
          value={editValue as string}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-full px-2 py-1 border border-primary rounded bg-background text-sm focus:outline-none"
        >
          {options.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }

    if (type === 'date') {
      return (
        <input
          type="date"
          value={editValue as string}
          onChange={e => setEditValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          autoFocus
          className="w-full h-full px-2 py-1 border border-primary rounded bg-background text-sm focus:outline-none"
        />
      );
    }

    return (
      <input
        type={type}
        value={editValue}
        onChange={e => setEditValue(type === 'number' ? Number(e.target.value) : e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        className="w-full h-full px-2 py-1 border border-primary rounded bg-background text-sm focus:outline-none"
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled && onSave) {
          setIsEditing(true);
        }
      }}
      className={cn(
        'cursor-pointer hover:bg-muted/50 px-2 py-1 rounded transition-colors min-h-[28px] flex items-center group',
        disabled && 'cursor-not-allowed opacity-50',
        className
      )}
      title={disabled ? disabledReason : title || value?.toString() || placeholder}
    >
      <span className="truncate flex-1">{value || placeholder || '-'}</span>
      {onSave && !disabled && <Pencil className="w-3 h-3 ml-1 text-muted-foreground opacity-0 group-hover:opacity-100 flex-shrink-0" />}
    </div>
  );
}

interface TaskTreeItemProps {
  task: Task;
  allTasks: Task[];
  expandedIds: Set<string>;
  onToggleExpand: (taskId: string) => void;
  onSelect: (taskId: string) => void;
  isSelected: boolean;
  onAddSubtask: (parentId: string) => void;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onCellEdit?: (taskId: string, field: keyof Task, value: any) => void;
  onPromote?: (taskId: string) => void;
  onDemote?: (taskId: string) => void;
}

export function TaskTreeItem({
  task,
  allTasks,
  expandedIds,
  onToggleExpand,
  onSelect,
  isSelected,
  onAddSubtask,
  onEdit,
  onDelete,
  onCellEdit,
  onPromote,
  onDemote,
}: TaskTreeItemProps) {
  const hasChildren = task.children && task.children.length > 0;
  const isExpanded = expandedIds.has(task.id);

  // 前置任务选择器状态
  const [isPredecessorOpen, setIsPredecessorOpen] = useState(false);
  const [predecessorSearch, setPredecessorSearch] = useState('');
  const predecessorRef = useRef<HTMLDivElement>(null);
  const predecessorTriggerRef = useRef<HTMLDivElement>(null);
  const predecessorListRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const children = task.children
    ? task.children.map((id: string) => allTasks.find(t => t.id === id)).filter(Boolean) as Task[]
    : [];

  // 获取可选的前置任务（排除自己和子孙任务）
  const getAvailablePredecessors = () => {
    const excludeIds = new Set([task.id]);
    const collectDescendants = (id: string) => {
      const t = allTasks.find(x => x.id === id);
      t?.children?.forEach(childId => {
        excludeIds.add(childId);
        collectDescendants(childId);
      });
    };
    collectDescendants(task.id);
    return allTasks.filter(t => !excludeIds.has(t.id));
  };

  const availablePredecessors = getAvailablePredecessors();

  // 过滤搜索结果
  const filteredPredecessors = availablePredecessors.filter(t =>
    t.name.toLowerCase().includes(predecessorSearch.toLowerCase()) ||
    t.wbs.toLowerCase().includes(predecessorSearch.toLowerCase())
  );

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (predecessorRef.current && !predecessorRef.current.contains(event.target as Node)) {
        setIsPredecessorOpen(false);
        setPredecessorSearch('');
      }
    };
    if (isPredecessorOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isPredecessorOpen]);

  // 自动滚动到最接近当前任务序号的条目
  useEffect(() => {
    if (!isPredecessorOpen || !predecessorListRef.current) return;
    const currentWbs = parseFloat(task.wbs) || 0;
    let closestIdx = 0;
    let minDiff = Infinity;
    filteredPredecessors.forEach((t, i) => {
      const diff = Math.abs((parseFloat(t.wbs) || 0) - currentWbs);
      if (diff < minDiff) { minDiff = diff; closestIdx = i; }
    });
    const itemHeight = 36;
    const containerHeight = predecessorListRef.current.clientHeight;
    const scrollTop = closestIdx * itemHeight - containerHeight / 2 + itemHeight / 2;
    predecessorListRef.current.scrollTop = Math.max(0, scrollTop);
  }, [isPredecessorOpen, filteredPredecessors, task.wbs]);

  const getStatusIcon = () => {
    switch (task.status) {
      case 'completed':
        return <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-3.5 h-3.5 text-blue-500" />;
      case 'blocked':
        return <AlertCircle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return <Circle className="w-3.5 h-3.5 text-gray-300" />;
    }
  };

  const getTypeIcon = () => {
    switch (task.type) {
      case 'phase':
        return <Folder className="w-4 h-4 text-amber-500" />;
      case 'milestone':
        return <Flag className="w-4 h-4 text-purple-500" />;
      default:
        return <FileText className="w-4 h-4 text-slate-400" />;
    }
  };

  return (
    <div className="select-none">
      <div
        className={cn(
          'task-tree-grid group py-2 border-b border-border transition-colors',
          isSelected && 'bg-primary/5 border-l-2 border-l-primary',
          !isSelected && 'hover:bg-muted/50'
        )}
        onClick={() => onSelect(task.id)}
      >
        {/* 展开/折叠按钮 */}
        <div
          className="flex items-center justify-center"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand(task.id);
          }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground hover:text-foreground cursor-pointer transition-colors" />
            )
          ) : (
            <div className="w-4" />
          )}
        </div>

        {/* 任务图标 */}
        <div className="flex items-center justify-center">
          {getTypeIcon()}
        </div>

        {/* 状态图标 */}
        <div className="flex items-center justify-center">
          {getStatusIcon()}
        </div>

        {/* WBS 编号 */}
        <div className="flex items-center justify-end">
          <span className="text-xs font-mono text-muted-foreground pr-3">
            {task.wbs}
          </span>
        </div>

        {/* 任务名称 */}
        <div className="min-w-0 pl-4">
          <EditableCell
            value={task.name}
            onSave={(value) => onCellEdit?.(task.id, 'name', value)}
            className="text-sm font-medium text-foreground"
          />
        </div>

        {/* 前置任务 */}
        <div className="px-3 border-l border-border flex items-center" ref={predecessorRef}>
          <div
            ref={predecessorTriggerRef}
            onClick={(e) => {
              e.stopPropagation();
              if (!isPredecessorOpen && predecessorTriggerRef.current) {
                const rect = predecessorTriggerRef.current.getBoundingClientRect();
                const dropW = 288;
                const dropH = 320;
                const left = Math.max(8, Math.min(rect.right - dropW, window.innerWidth - dropW - 8));
                const spaceBelow = window.innerHeight - rect.bottom;
                const top = spaceBelow >= dropH + 4 ? rect.bottom + 4 : rect.top - dropH - 4;
                setDropdownStyle({ position: 'fixed', top: Math.max(8, top), left, width: dropW, zIndex: 9999 });
              }
              setIsPredecessorOpen(prev => !prev);
            }}
            className={cn(
              "flex items-center justify-between w-full px-2 py-1 rounded border border-transparent",
              "cursor-pointer transition-colors hover:bg-muted/50",
              isPredecessorOpen && "border-primary bg-muted/70"
            )}
          >
            <span className={cn("text-xs truncate", task.dependencies.length === 0 && "text-muted-foreground")}>
              {task.dependencies.length > 0
                ? task.dependencies.map(d => {
                    const predTask = allTasks.find(t => t.id === d.taskId);
                    return `${predTask?.wbs || '?'}(${d.type}${d.lagDays ? `+${d.lagDays}` : ''})`;
                  }).join(', ')
                : '无'}
            </span>
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted-foreground ml-1 flex-shrink-0 transition-transform", isPredecessorOpen && "rotate-180")} />
          </div>

          {/* 下拉选择器 - portal 渲染，智能定位 */}
          {isPredecessorOpen && createPortal(
            <div
              style={dropdownStyle}
              className="rounded-lg shadow-xl overflow-hidden"
              onMouseDown={e => e.stopPropagation()}
              onClick={e => e.stopPropagation()}
            >
              <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 'inherit', overflow: 'hidden' }}>
                {/* 搜索框 */}
                <div className="p-2 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                  <input
                    type="text"
                    value={predecessorSearch}
                    onChange={e => setPredecessorSearch(e.target.value)}
                    placeholder="搜索任务..."
                    className="flex-1 px-2 py-1 text-sm rounded-md focus:outline-none focus:ring-2"
                    style={{ border: '1px solid var(--input)', background: 'var(--background)', color: 'var(--foreground)' }}
                    autoFocus
                  />
                  {predecessorSearch && (
                    <button
                      onClick={() => setPredecessorSearch('')}
                      className="p-1 rounded transition-colors hover:opacity-70"
                    >
                      <X className="w-3.5 h-3.5" style={{ color: 'var(--muted-foreground)' }} />
                    </button>
                  )}
                </div>

                {/* 任务列表 */}
                <div ref={predecessorListRef} className="overflow-auto" style={{ maxHeight: '256px' }}>
                  {filteredPredecessors.length === 0 ? (
                    <div className="px-3 py-4 text-center text-sm" style={{ color: 'var(--muted-foreground)' }}>
                      {predecessorSearch ? '未找到匹配的任务' : '暂无可选任务'}
                    </div>
                  ) : (
                    filteredPredecessors.map(predTask => {
                      const isAdded = task.dependencies.some(d => d.taskId === predTask.id);
                      return (
                        <div
                          key={predTask.id}
                          onClick={() => {
                            if (!isAdded) {
                              onCellEdit?.(task.id, 'dependencies', [
                                ...task.dependencies,
                                { taskId: predTask.id, type: 'FS', lagDays: 0 }
                              ]);
                            }
                          }}
                          className="flex items-center justify-between px-3 py-2 transition-colors"
                          style={{
                            cursor: isAdded ? 'not-allowed' : 'pointer',
                            opacity: isAdded ? 0.6 : 1,
                            height: '36px',
                          }}
                          onMouseEnter={e => { if (!isAdded) (e.currentTarget as HTMLElement).style.background = 'var(--muted)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-xs font-mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                              {predTask.wbs}
                            </span>
                            <span className="text-sm truncate" style={{ color: 'var(--foreground)' }}>{predTask.name}</span>
                          </div>
                          {isAdded && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--primary)' }} />}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 底部说明 */}
                <div className="px-3 py-2 text-xs" style={{ background: 'var(--muted)', color: 'var(--muted-foreground)', borderTop: '1px solid var(--border)' }}>
                  点击任务添加为前置 (FS 关系)
                </div>
              </div>
            </div>,
            document.body
          )}
        </div>

        {/* 开始时间 */}
        <div className="px-3 border-l border-border flex items-center justify-end">
          <EditableCell
            value={task.startDate}
            onSave={(value) => onCellEdit?.(task.id, 'startDate', value)}
            type="date"
            className="text-xs text-muted-foreground font-mono justify-end"
            disabled={task.dependencies.length > 0}
            disabledReason="已有前置任务，开始时间由排程引擎自动计算。如需修改请先移除前置任务"
          />
        </div>

        {/* 结束时间 */}
        <div className="px-3 border-l border-border flex items-center justify-end">
          <EditableCell
            value={task.endDate}
            onSave={(value) => {
              if (task.startDate && value < task.startDate) return; // 不能早于开始时间
              onCellEdit?.(task.id, 'endDate', value);
            }}
            type="date"
            className="text-xs text-muted-foreground font-mono justify-end"
            title={task.dependencies.length > 0 ? "已有前置任务，修改结束时间不会影响前置关系" : undefined}
          />
        </div>

        {/* 工期 */}
        <div className="px-3 border-l border-border flex items-center justify-end">
          <EditableCell
            value={task.duration}
            onSave={(value) => onCellEdit?.(task.id, 'duration', Number(value))}
            type="number"
            className="text-xs text-muted-foreground font-mono justify-end"
            placeholder="-"
          />
        </div>

        {/* 负责人 */}
        <div className="px-3 border-l border-border">
          <EditableCell
            value={task.assignee}
            onSave={(value) => onCellEdit?.(task.id, 'assignee', value || undefined)}
            className="text-xs text-muted-foreground"
            placeholder="-"
          />
        </div>

        {/* 优先级 */}
        <div className="px-3 border-l border-border flex items-center justify-center">
          <EditableCell
            value={task.priority}
            onSave={(value) => onCellEdit?.(task.id, 'priority', value)}
            type="select"
            options={[
              { value: 'low', label: '低' },
              { value: 'medium', label: '中' },
              { value: 'high', label: '高' },
              { value: 'critical', label: '紧急' },
            ]}
            className={cn(
              'text-xs font-medium rounded px-1.5',
              task.priority === 'low' && 'text-slate-500',
              task.priority === 'medium' && 'text-amber-600',
              task.priority === 'high' && 'text-orange-600',
              task.priority === 'critical' && 'text-red-600 font-semibold',
            )}
          />
        </div>

        {/* 进度条 */}
        <div className="px-3 border-l border-border">
          <EditableCell
            value={task.progress}
            onSave={(value) => onCellEdit?.(task.id, 'progress', Number(value))}
            type="number"
            className="flex items-center gap-2"
          />
        </div>

        {/* 操作按钮 - hover 时显示 */}
        <div className="px-3 border-l border-border flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {/* 升级/降级按钮 */}
          {task.parentId && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPromote?.(task.id);
              }}
              className="p-1.5 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-md text-purple-600 dark:text-purple-400 transition-colors"
              title="升级（提升为父级）"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDemote?.(task.id);
            }}
            disabled={!task.parentId}
            className="p-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md text-indigo-600 dark:text-indigo-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title="降级（缩进为子任务）"
          >
            <ArrowDown className="w-4 h-4" />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddSubtask(task.id);
            }}
            className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md text-blue-600 dark:text-blue-400 transition-colors"
            title="添加子任务"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(task);
            }}
            className="p-1.5 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md text-green-600 dark:text-green-400 transition-colors"
            title="编辑任务"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-red-600 dark:text-red-400 transition-colors"
            title="删除任务"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 子任务 */}
      {isExpanded && children.length > 0 && (
        <div className="animate-in slide-in-from-top-1 duration-150">
          {children.map(child => (
            <TaskTreeItem
              key={child.id}
              task={child}
              allTasks={allTasks}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              isSelected={false}
              onAddSubtask={onAddSubtask}
              onEdit={onEdit}
              onDelete={onDelete}
              onCellEdit={onCellEdit}
              onPromote={onPromote}
              onDemote={onDemote}
            />
          ))}
        </div>
      )}
    </div>
  );
}
