import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '../../store/projectStore';
import { createAIProvider, ProjectAssistant } from '../../engine/agent/AIProvider';
import { X, Send, Sparkles, Loader2, TrendingUp, FileText, RotateCcw, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';
import { rescheduleProject } from '../../engine/chainScheduler';

export function AgentCommandPalette() {
  const { currentProject, aiConfig, setCurrentProject } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 切换打开/关闭 (Cmd/Ctrl + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || !currentProject || !aiConfig) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const provider = createAIProvider(aiConfig);
      const assistant = new ProjectAssistant(provider);

      // 分析用户意图
      let response: string;

      if (userMessage.includes('创建') || userMessage.includes('添加')) {
        // 创建任务
        const result = await assistant.createTasks(userMessage);
        response = `已解析任务：\n\n\`\`\`json\n${result}\n\`\`\`\n\n请确认是否要添加到项目中。`;
      } else if (userMessage.includes('分析') || userMessage.includes('风险') || userMessage.includes('关键路径')) {
        // 分析项目
        const tasksJson = JSON.stringify(currentProject.tasks, null, 2);
        response = await assistant.analyzeProject(tasksJson);
      } else if (userMessage.includes('报告') || userMessage.includes('状态')) {
        // 生成报告
        const tasksJson = JSON.stringify(currentProject.tasks, null, 2);
        response = await assistant.generateReport(tasksJson);
      } else if (userMessage.includes('重新排程') || userMessage.includes('重排')) {
        // 重新排程
        const scheduledTasks = rescheduleProject(currentProject);
        await setCurrentProject({
          ...currentProject,
          tasks: scheduledTasks,
        });
        response = `排程完成！共 ${scheduledTasks.length} 个任务已重新计算排期。`;
      } else {
        // 通用查询
        const tasksJson = JSON.stringify(currentProject.tasks, null, 2);
        response = await assistant.query(tasksJson, userMessage);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `错误：${error instanceof Error ? error.message : '请求失败，请检查 AI 配置'}`,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const quickActions = [
    { label: '分析项目', prompt: '分析当前项目计划，识别关键路径和潜在风险', icon: <TrendingUp className="w-3.5 h-3.5" /> },
    { label: '生成报告', prompt: '生成项目状态报告', icon: <FileText className="w-3.5 h-3.5" /> },
    { label: '重新排程', prompt: '重新计算项目排程', icon: <RotateCcw className="w-3.5 h-3.5" /> },
    { label: '创建任务', prompt: '创建任务：需求分析，工期 5 天，负责人张三', icon: <Plus className="w-3.5 h-3.5" /> },
  ];

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-primary text-primary-foreground rounded-full shadow-lg hover:bg-primary/90 transition-colors z-40"
        title="AI 助手 (Ctrl+K)"
      >
        <Sparkles className="w-5 h-5" />
      </button>
    );
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" style={{ background: 'var(--card)', border: '1px solid var(--border)' }}>
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-semibold">AI 项目助手</span>
            {!aiConfig && (
              <span className="text-xs text-destructive">（未配置 AI）</span>
            )}
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 hover:bg-muted rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">有什么可以帮您？</p>
              <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                {quickActions.map((action, i) => (
                  <button
                    key={i}
                    onClick={() => setInput(action.prompt)}
                    className="flex items-center gap-2 p-2.5 text-sm text-left hover:bg-muted rounded-lg transition-colors border border-border/50 hover:border-border"
                  >
                    <span className="text-muted-foreground">{action.icon}</span>
                    {action.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-6">
                快捷键：Ctrl/Cmd + K 打开/关闭
              </p>
            </div>
          ) : (
            <>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    'p-3 rounded-lg max-w-[80%]',
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground ml-auto'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <div className="bg-muted p-3 rounded-lg max-w-[80%] flex items-center gap-2">
                  <Loader2 className="w-4 h-4 text-muted-foreground animate-spin flex-shrink-0" />
                  <p className="text-sm text-muted-foreground">思考中...</p>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* 输入框 */}
        <form onSubmit={handleSubmit} className="p-4 border-t border-border">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={aiConfig ? "输入指令，如：分析项目风险" : "请先配置 AI"}
              className="flex-1 px-3 py-2 border border-input rounded-md bg-background text-foreground"
              disabled={!aiConfig || isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || !aiConfig || isLoading}
              className="p-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
