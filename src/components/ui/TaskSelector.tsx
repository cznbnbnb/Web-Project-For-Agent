'use client';

import { useState, useRef, useEffect } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Task } from '../../types';

interface TaskSelectorProps {
  value: string;
  onChange: (taskId: string) => void;
  availableTasks: Task[];
  placeholder?: string;
  className?: string;
}

export function TaskSelector({
  value,
  onChange,
  availableTasks,
  placeholder = '选择前置任务',
  className,
}: TaskSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // 过滤任务列表
  const filteredTasks = availableTasks.filter(task => {
    const searchLower = searchTerm.toLowerCase();
    return (
      task.name.toLowerCase().includes(searchLower) ||
      task.wbs.toLowerCase().includes(searchLower)
    );
  });

  // 选中的任务
  const selectedTask = availableTasks.find(t => t.id === value);

  // 清除选择
  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  // 选择任务
  const handleSelect = (taskId: string) => {
    onChange(taskId);
    setIsOpen(false);
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* 触发按钮 */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex items-center justify-between w-full px-3 py-2 border border-input rounded-lg",
          "bg-background text-foreground text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary",
          "cursor-pointer transition-colors",
          isOpen && "border-primary ring-2 ring-primary/20"
        )}
      >
        <span className={cn("truncate", !selectedTask && "text-muted-foreground")}>
          {selectedTask ? `${selectedTask.wbs} - ${selectedTask.name}` : placeholder}
        </span>
        <div className="flex items-center gap-1">
          {selectedTask && (
            <button
              onClick={handleClear}
              className="p-0.5 hover:bg-muted rounded transition-colors"
              type="button"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
          <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </div>

      {/* 下拉面板 */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-hidden">
          {/* 搜索框 */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="搜索任务名称或 WBS..."
                className="w-full px-3 py-1.5 text-sm border border-input rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary"
                autoFocus
                onClick={e => e.stopPropagation()}
              />
            </div>
          </div>

          {/* 任务列表 */}
          <div className="overflow-auto max-h-48">
            {filteredTasks.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                {searchTerm ? '未找到匹配的任务' : '暂无可选任务'}
              </div>
            ) : (
              filteredTasks.map(task => (
                <div
                  key={task.id}
                  onClick={() => handleSelect(task.id)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2 cursor-pointer transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    value === task.id && "bg-accent/70 text-accent-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground flex-shrink-0">
                      {task.wbs}
                    </span>
                    <span className="text-sm truncate">{task.name}</span>
                  </div>
                  {value === task.id && (
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
