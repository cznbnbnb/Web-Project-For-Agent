'use client';

import { useMemo, useRef, useState } from 'react';
import type { Task, GanttConfig } from '../../types';
import { parseISO, format, startOfDay, endOfDay, eachDayOfInterval, addMonths, isSameDay } from 'date-fns';
import { cn } from '../../lib/utils';
import { ZoomIn, ZoomOut, Folder, Flag, FileText } from 'lucide-react';

interface GanttChartProps {
  tasks: Task[];
  config?: Partial<GanttConfig> & {
    onConfigChange?: (config: Partial<GanttConfig>) => void;
  };
}

const ROW_HEIGHT = 40;

export function GanttChart({ tasks, config }: GanttChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // 使用本地状态管理显示选项和缩放级别
  const [showCriticalPath, setShowCriticalPath] = useState(true);
  const [showDependencies, setShowDependencies] = useState(true);
  const [zoomLevel, setZoomLevel] = useState<GanttConfig['zoomLevel']>(config?.zoomLevel || 'day');

  const mergedConfig: GanttConfig = {
    zoomLevel,
    showCriticalPath: config?.showCriticalPath ?? showCriticalPath,
    showDependencies: config?.showDependencies ?? showDependencies,
    startDate: config?.startDate || format(new Date(), 'yyyy-MM-dd'),
    endDate: config?.endDate || format(addMonths(new Date(), 3), 'yyyy-MM-dd'),
  };

  const {
    timelineDates,
    columnWidth,
    chartWidth,
  } = useMemo(() => {
    const start = startOfDay(parseISO(mergedConfig.startDate));
    const end = endOfDay(parseISO(mergedConfig.endDate));
    const dates = eachDayOfInterval({ start, end });

    let width = 50;
    switch (mergedConfig.zoomLevel) {
      case 'day':
        width = 50;
        break;
      case 'week':
        width = 70;
        break;
      case 'month':
        width = 140;
        break;
    }

    return {
      timelineDates: dates,
      columnWidth: width,
      chartWidth: dates.length * width,
    };
  }, [mergedConfig]);

  // 获取根任务（用于树形展示）
  const rootTasks = useMemo(() => {
    return tasks.filter(t => !t.parentId);
  }, [tasks]);

  // 渲染任务条
  const renderTaskBar = (task: Task, index: number) => {
    if (!task.startDate || !task.duration) return null;

    const taskStart = parseISO(task.startDate);
    const timelineStart = parseISO(mergedConfig.startDate);

    // 计算任务条位置
    const offsetDays = Math.max(0, Math.floor((taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));
    const durationDays = task.duration;

    const left = offsetDays * columnWidth;
    const width = durationDays * columnWidth - 4;

    const isCritical = task.isCritical && mergedConfig.showCriticalPath;

    return (
      <div
        key={task.id}
        className={cn(
          'absolute h-7 rounded-lg shadow-md transition-all cursor-pointer group',
          isCritical
            ? 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700'
            : task.type === 'milestone'
            ? 'bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700'
            : task.type === 'phase'
            ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
            : 'bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary'
        )}
        style={{
          left: `${left + 2}px`,
          width: `${Math.max(width, 8)}px`,
          top: `${index * ROW_HEIGHT + 5}px`,
        }}
        title={`${task.name} (${task.duration}天)`}
      >
        <span className="text-xs text-white px-2.5 py-1 truncate block font-medium">
          {task.name}
        </span>
      </div>
    );
  };

  // 获取任务位置（用于绘制依赖线）
  const getTaskPosition = (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;

    const index = flattenTasks.findIndex(({ task: t }) => t.id === taskId);
    if (index === -1 || !task.startDate || !task.duration) return null;

    const taskStart = parseISO(task.startDate);
    const timelineStart = parseISO(mergedConfig.startDate);
    const offsetDays = Math.max(0, Math.floor((taskStart.getTime() - timelineStart.getTime()) / (1000 * 60 * 60 * 24)));

    return {
      left: offsetDays * columnWidth,
      right: (offsetDays + task.duration) * columnWidth,
      top: index * ROW_HEIGHT + 23, // 任务条垂直中心
      bottom: index * ROW_HEIGHT + 23,
    };
  };

  // 渲染依赖线
  const renderDependencyLines = () => {
    if (!mergedConfig.showDependencies) return null;

    const lines: React.JSX.Element[] = [];

    tasks.forEach(task => {
      if (!task.dependencies || task.dependencies.length === 0) return;

      task.dependencies.forEach(dep => {
        const fromPos = getTaskPosition(dep.taskId);
        const toPos = getTaskPosition(task.id);

        if (!fromPos || !toPos) return;

        // 计算起点和终点
        const startX = fromPos.right;
        const startY = fromPos.top;
        const endX = toPos.left;
        const endY = toPos.top;

        // 贝塞尔曲线控制点
        const controlOffset = Math.abs(endX - startX) * 0.5 + 20;
        const cp1X = startX + controlOffset;
        const cp1Y = startY;
        const cp2X = endX - controlOffset;
        const cp2Y = endY;

        // 路径
        const path = `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;

        const isCritical = task.isCritical || tasks.find(t => t.id === dep.taskId)?.isCritical;

        lines.push(
          <g key={`${task.id}-${dep.taskId}`}>
            {/* 阴影线 */}
            <path
              d={path}
              fill="none"
              stroke="rgba(0,0,0,0.1)"
              strokeWidth="3"
              className="pointer-events-none"
            />
            {/* 实际线 */}
            <path
              d={path}
              fill="none"
              stroke={isCritical && mergedConfig.showCriticalPath ? '#ef4444' : '#94a3b8'}
              strokeWidth="2"
              className="pointer-events-none"
              strokeDasharray={dep.type !== 'FS' ? '5,5' : 'none'}
            />
            {/* 箭头 */}
            <polygon
              points={`${endX},${endY} ${endX - 8},${endY - 4} ${endX - 8},${endY + 4}`}
              fill={isCritical && mergedConfig.showCriticalPath ? '#ef4444' : '#94a3b8'}
              className="pointer-events-none"
            />
          </g>
        );
      });
    });

    return lines;
  };

  // 扁平化任务列表用于甘特图展示
  const flattenTasks = useMemo(() => {
    const result: { task: Task; level: number }[] = [];

    const processTask = (task: Task, level: number) => {
      result.push({ task, level });
      if (task.children) {
        task.children.forEach(childId => {
          const child = tasks.find(t => t.id === childId);
          if (child) processTask(child, level + 1);
        });
      }
    };

    rootTasks.forEach(task => processTask(task, 0));
    return result;
  }, [tasks, rootTasks]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* 工具栏 */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-foreground">视图：</span>
          <ZoomSelector config={mergedConfig} onZoomChange={setZoomLevel} />
        </div>
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showCriticalPath}
                onChange={e => setShowCriticalPath(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-muted-foreground">关键路径</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showDependencies}
                onChange={e => setShowDependencies(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-muted-foreground">依赖线</span>
            </label>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-red-500 to-red-600" />
              <span className="text-muted-foreground">关键路径</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-purple-500 to-purple-600" />
              <span className="text-muted-foreground">里程碑</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gradient-to-r from-amber-500 to-amber-600" />
              <span className="text-muted-foreground">阶段</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* 任务名称列表 */}
        <div className="w-72 flex-shrink-0 border-r border-border overflow-auto bg-card">
          <div className="h-11 border-b border-border flex items-center px-5 font-semibold text-xs text-muted-foreground uppercase tracking-wider bg-muted/40">
            任务名称
          </div>
          {flattenTasks.map(({ task, level }) => (
            <div
              key={task.id}
              className="border-b border-border/40 flex items-center px-5 text-sm truncate hover:bg-muted/30 transition-colors"
              style={{ height: `${ROW_HEIGHT}px`, paddingLeft: `${level * 24 + 20}px` }}
            >
              <div className="flex items-center gap-2">
                {task.type === 'phase' && <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                {task.type === 'milestone' && <Flag className="w-4 h-4 text-purple-500 flex-shrink-0" />}
                {task.type === 'task' && <FileText className="w-4 h-4 text-slate-400 flex-shrink-0" />}
                <span className="font-medium text-foreground truncate">{task.name}</span>
              </div>
            </div>
          ))}
        </div>

        {/* 甘特图主体 */}
        <div className="flex-1 overflow-auto bg-muted/20">
          {/* 时间轴表头 */}
          <div
            className="h-11 border-b border-border flex bg-card/80 sticky top-0 z-10"
            style={{ width: `${chartWidth}px` }}
          >
            {timelineDates.map((date, i) => {
              const isToday = isSameDay(date, new Date());
              const isMonday = date.getDay() === 1;
              const isFirstOfMonth = date.getDate() === 1;
              const isWeekend = date.getDay() === 0 || date.getDay() === 6;

              return (
                <div
                  key={i}
                  className={cn(
                    'flex-shrink-0 border-r border-border/30 text-xs flex items-center justify-center transition-colors',
                    isToday && 'bg-primary/10 font-semibold',
                    isWeekend && !isToday && 'bg-muted/40'
                  )}
                  style={{ width: `${columnWidth}px` }}
                >
                  {mergedConfig.zoomLevel === 'day' && (
                    <div className="text-center">
                      <div className={cn(
                        'font-medium',
                        isToday ? 'text-primary' : isWeekend ? 'text-muted-foreground' : 'text-foreground'
                      )}>
                        {format(date, 'M/d')}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {format(date, 'EEE')}
                      </div>
                    </div>
                  )}
                  {mergedConfig.zoomLevel === 'week' && isMonday && (
                    <div className="text-center">
                      <div className="text-xs font-medium text-foreground">第{format(date, 'w')}周</div>
                      <div className="text-[10px] text-muted-foreground">{format(date, 'M/d')}</div>
                    </div>
                  )}
                  {mergedConfig.zoomLevel === 'month' && isFirstOfMonth && (
                    <div className="text-center font-semibold text-foreground">
                      {format(date, 'yyyy 年 M 月')}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* 任务条 */}
          <div
            className="relative"
            style={{
              width: `${chartWidth}px`,
              height: `${flattenTasks.length * ROW_HEIGHT}px`,
            }}
          >
            {/* 背景网格 */}
            <div className="absolute inset-0">
              {timelineDates.map((date, i) => (
                <div
                  key={i}
                  className={cn(
                    'absolute h-full border-r border-border/15',
                    date.getDay() === 0 || date.getDay() === 6 ? 'bg-muted/25' : '',
                  )}
                  style={{
                    left: `${i * columnWidth}px`,
                    width: `${columnWidth}px`,
                  }}
                />
              ))}
            </div>

            {/* 依赖线 */}
            <svg
              ref={svgRef}
              className="absolute inset-0 pointer-events-none"
              style={{
                width: `${chartWidth}px`,
                height: `${flattenTasks.length * ROW_HEIGHT}px`,
              }}
            >
              {renderDependencyLines()}
            </svg>

            {/* 任务条 */}
            {flattenTasks.map(({ task }, index) => renderTaskBar(task, index))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ZoomSelector({ config, onZoomChange }: {
  config: GanttConfig;
  onZoomChange: (level: GanttConfig['zoomLevel']) => void;
}) {
  const levels: GanttConfig['zoomLevel'][] = ['day', 'week', 'month'];
  const icons = {
    day: <ZoomIn className="w-3.5 h-3.5" />,
    week: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>,
    month: <ZoomOut className="w-3.5 h-3.5" />,
  };
  const labels = {
    day: '日',
    week: '周',
    month: '月',
  };

  return (
    <div className="flex p-0.5 border border-border rounded-lg bg-muted/30">
      {levels.map(level => (
        <button
          key={level}
          onClick={() => onZoomChange(level)}
          aria-pressed={config.zoomLevel === level}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-md transition-all',
            config.zoomLevel === level
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          )}
        >
          {icons[level]}
          {labels[level]}
        </button>
      ))}
    </div>
  );
}
