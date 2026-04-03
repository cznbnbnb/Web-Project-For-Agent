import { downloadExcel, exportToExcel, importFromExcel } from '../../lib/excel';
import { useProjectStore } from '../../store/projectStore';
import { Upload, Download, Loader2, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../../lib/utils';

export function ImportExport() {
  const { currentProject, addTask } = useProjectStore();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const handleExport = () => {
    if (!currentProject) return;

    const blob = exportToExcel(currentProject);
    downloadExcel(blob, `${currentProject.name}_项目计划_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImport = async (file: File) => {
    setIsImporting(true);
    setImportError(null);
    setImportSuccess(null);

    try {
      const calendarConfig = currentProject ? {
        workingHours: { start: 9, end: 18 } as const,
        holidays: currentProject.holidays,
        workingDays: currentProject.workingDays,
      } : undefined;
      const result = await importFromExcel(file, calendarConfig);

      if (result.success || result.tasks.length > 0) {
        // 将导入的任务添加到当前项目
        for (const task of result.tasks) {
          await addTask({
            name: task.name,
            type: task.type,
            duration: task.duration,
            priority: task.priority,
            status: task.status,
            assignee: task.assignee,
            progress: task.progress,
            startDate: task.startDate,
            endDate: task.endDate,
            notes: task.notes,
          }, task.parentId);
        }

        if (result.errors.length > 0) {
          setImportError(`导入完成，但有 ${result.errors.length} 个错误：${result.errors.map(e => `第${e.row}行：${e.message}`).join(', ')}`);
        } else {
          setImportSuccess(`成功导入 ${result.tasks.length} 个任务`);
          setTimeout(() => setImportSuccess(null), 3000);
        }
      } else {
        setImportError('导入失败：' + result.errors.map(e => e.message).join(', '));
      }
    } catch (error) {
      setImportError(`导入失败：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsImporting(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* 导入按钮 */}
      <label
        className={cn(
          'flex items-center gap-1 px-3 py-1.5 rounded-md text-sm cursor-pointer transition-colors',
          'bg-secondary text-secondary-foreground hover:bg-secondary/80'
        )}
      >
        <Upload className="w-4 h-4" />
        导入 Excel
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={onFileChange}
          className="hidden"
          disabled={isImporting}
        />
      </label>

      {/* 导出按钮 */}
      <button
        onClick={handleExport}
        disabled={!currentProject}
        className="flex items-center gap-1 px-3 py-1.5 bg-secondary text-secondary-foreground rounded-md text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
      >
        <Download className="w-4 h-4" />
        导出 Excel
      </button>

      {/* 导入状态 */}
      {isImporting && (
        <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          正在导入...
        </span>
      )}

      {/* 导入成功 */}
      {importSuccess && (
        <span className="flex items-center gap-1.5 text-sm text-green-600">
          <CheckCircle className="w-3.5 h-3.5" />
          {importSuccess}
        </span>
      )}

      {/* 导入错误 */}
      {importError && (
        <span className="text-sm text-destructive max-w-xs truncate" title={importError}>{importError}</span>
      )}
    </div>
  );
}
