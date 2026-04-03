import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '../../store/projectStore';
import type { AIConfig, AIProvider } from '../../types';
import { Settings2, Check, X, Key, Info } from 'lucide-react';
import { cn } from '../../lib/utils';

const PRESET_PROVIDERS: { value: AIProvider; label: string; models: string[] }[] = [
  {
    value: 'anthropic',
    label: 'Anthropic',
    models: ['claude-sonnet-4-20250514', 'claude-opus-4-20250514', 'claude-3-5-sonnet-20241022'],
  },
  {
    value: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
  },
  {
    value: 'custom',
    label: '自定义 (兼容 OpenAI)',
    models: ['deepseek-chat', 'moonshot-v1-8k', 'gpt-4o'],
  },
];

export function AISettings() {
  const { aiConfig, setAIConfig } = useProjectStore();
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState<AIConfig>(
    aiConfig || {
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-4-20250514',
    }
  );

  const selectedPreset = PRESET_PROVIDERS.find(p => p.value === formData.provider);
  const availableModels = selectedPreset?.models || [];

  const handleSave = async () => {
    await setAIConfig(formData);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm font-medium hover:bg-secondary/80 transition-colors"
      >
        <Settings2 className="w-4 h-4" />
        AI 设置
        {aiConfig && (
          <span className={cn(
            'px-1.5 py-0.5 rounded-full text-xs font-medium',
            aiConfig.provider === 'anthropic' ? 'bg-green-100 text-green-700' :
            aiConfig.provider === 'openai' ? 'bg-blue-100 text-blue-700' :
            'bg-purple-100 text-purple-700'
          )}>
            {aiConfig.provider === 'anthropic' ? 'Claude' : aiConfig.provider === 'openai' ? 'OpenAI' : '自定义'}
          </span>
        )}
      </button>
    );
  }

  return createPortal(
    <div
      className="fixed inset-0 bg-black/70 flex items-start justify-center z-50 p-8 overflow-y-auto"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="rounded-xl shadow-2xl w-full max-w-lg"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-purple-500/5 to-transparent">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Settings2 className="w-5 h-5 text-purple-500" />
            AI 配置
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-6 space-y-5">
          {/* Provider 选择 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              <span className="flex items-center gap-2">
                <span className="w-1 h-4 bg-purple-500 rounded-full" />
                AI 服务商
              </span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {PRESET_PROVIDERS.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => {
                    setFormData({
                      ...formData,
                      provider: preset.value,
                      model: preset.models[0],
                    });
                  }}
                  className={cn(
                    'px-4 py-3 text-sm font-medium rounded-lg border-2 transition-all',
                    formData.provider === preset.value
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300'
                      : 'border-border hover:border-muted-foreground/30'
                  )}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-2">
                <span className="w-1 h-4 bg-blue-500 rounded-full" />
                API Key
              </span>
            </label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="password"
                value={formData.apiKey}
                onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                className="w-full pl-10 pr-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
                placeholder="sk-..."
              />
            </div>
          </div>

          {/* 模型选择 */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              <span className="flex items-center gap-2">
                <span className="w-1 h-4 bg-green-500 rounded-full" />
                模型
              </span>
            </label>
            {formData.provider === 'custom' ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
                  placeholder="输入模型名称，如 deepseek-chat"
                />
                <div className="flex gap-2 flex-wrap">
                  {availableModels.map(model => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => setFormData({ ...formData, model })}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md border transition-colors',
                        formData.model === model
                          ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                          : 'border-border text-muted-foreground hover:border-muted-foreground/50'
                      )}
                    >
                      {model}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <select
                value={formData.model}
                onChange={e => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
              >
                {availableModels.map(model => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* 自定义接口地址 */}
          {formData.provider === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                <span className="flex items-center gap-2">
                  <span className="w-1 h-4 bg-orange-500 rounded-full" />
                  自定义 API 地址
                </span>
              </label>
              <input
                type="url"
                value={formData.baseUrl || ''}
                onChange={e => setFormData({ ...formData, baseUrl: e.target.value })}
                className="w-full px-4 py-2.5 border border-input rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-colors"
                placeholder="https://api.example.com/v1"
              />
              <p className="text-xs text-muted-foreground mt-2">
                💡 用于 DeepSeek、Moonshot 等兼容 OpenAI 格式的接口
              </p>
            </div>
          )}

          {/* 保存按钮 */}
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-5 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted rounded-lg transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleSave}
              disabled={!formData.apiKey}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              <Check className="w-4 h-4" />
              保存配置
            </button>
          </div>
        </div>

        {/* 使用说明 */}
        <div className="mx-6 mb-6 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-100 dark:border-purple-900/30">
          <p className="text-xs text-muted-foreground leading-relaxed flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 text-purple-500 flex-shrink-0 mt-0.5" />
            <span>
              <span className="font-medium text-purple-700 dark:text-purple-300">提示：</span>
              {formData.provider === 'anthropic' && ' 使用 Anthropic Claude 模型，需要访问 console.anthropic.com 获取 API Key'}
              {formData.provider === 'openai' && ' 使用 OpenAI 官方模型，需要访问 platform.openai.com 获取 API Key'}
              {formData.provider === 'custom' && ' 支持 DeepSeek、Moonshot 等兼容 OpenAI 格式的接口，在自定义 API 地址中填入对应服务的 baseURL'}
            </span>
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}
