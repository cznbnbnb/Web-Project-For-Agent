import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { AIConfig } from '../../types';

/**
 * 统一 AI 接口层
 * 支持 Anthropic Claude 和 OpenAI 兼容接口
 */
export interface AIProvider {
  name: string;
  complete(prompt: string, system?: string): Promise<string>;
  chat(messages: ChatMessage[]): Promise<string>;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

/**
 * Anthropic Claude Provider
 */
export class AnthropicProvider implements AIProvider {
  name = 'Anthropic Claude';
  private client: Anthropic;
  private model: string;

  constructor(config: AIConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
    });
    this.model = config.model || 'claude-sonnet-4-20250514';
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const formattedMessages = messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      messages: formattedMessages,
    });

    const content = response.content[0];
    if (content.type === 'text') {
      return content.text;
    }
    return '';
  }
}

/**
 * OpenAI Compatible Provider
 * 支持 OpenAI 官方及兼容接口（DeepSeek、Moonshot 等）
 */
export class OpenAIProvider implements AIProvider {
  name = 'OpenAI Compatible';
  private client: OpenAI;
  private model: string;

  constructor(config: AIConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl, // 支持自定义接口地址
    });
    this.model = config.model || 'gpt-4o';
  }

  async complete(prompt: string, system?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        ...(system ? [{ role: 'system' as const, content: system }] : []),
        { role: 'user' as const, content: prompt },
      ],
    });

    return response.choices[0]?.message?.content || '';
  }

  async chat(messages: ChatMessage[]): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: messages.map(m => ({
        role: m.role as 'system' | 'user' | 'assistant',
        content: m.content,
      })),
    });

    return response.choices[0]?.message?.content || '';
  }
}

/**
 * 创建 AI Provider 实例
 */
export function createAIProvider(config: AIConfig): AIProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
    case 'custom':
      return new OpenAIProvider(config);
    default:
      return new OpenAIProvider(config);
  }
}

/**
 * 预定义的系统提示词
 */
export const SYSTEM_PROMPTS = {
  PROJECT_ASSISTANT: `你是一个专业的项目管理助手，擅长项目计划的创建、分析和优化。
你可以帮助用户：
1. 创建和编辑项目任务
2. 分析项目计划和关键路径
3. 识别潜在风险和延误
4. 提供项目排期建议
5. 生成项目状态报告

请用简洁、专业的方式回答，涉及任务操作时请明确指出具体操作。`,

  TASK_CREATOR: `你是一个项目计划解析助手，负责将自然语言转换为项目任务结构。

请分析用户的输入，提取以下信息：
- 任务名称
- 任务类型（任务/阶段/里程碑）
- 工期（天）
- 负责人
- 优先级（低/中/高/紧急）
- 前后置关系

请以 JSON 格式返回任务信息。`,

  SCHEDULER: `你是一个项目排程专家，熟悉关键路径法（CPM）和资源优化。

请分析项目计划，提供：
1. 关键路径识别
2. 任务浮动时间分析
3. 潜在延误风险
4. 优化建议

请考虑节假日和工作日限制。`,

  REPORT_GENERATOR: `你是一个项目报告撰写专家，擅长生成清晰、专业的项目状态报告。

请根据项目数据生成包含以下内容的报告：
1. 项目整体进度
2. 已完成任务
3. 进行中的任务
4. 延迟或受阻任务
5. 关键路径状态
6. 风险提示
7. 下周计划

使用 Markdown 格式输出。`,
};

/**
 * 项目计划分析助手
 */
export class ProjectAssistant {
  private provider: AIProvider;

  constructor(provider: AIProvider) {
    this.provider = provider;
  }

  /**
   * 分析项目计划
   */
  async analyzeProject(tasksJson: string): Promise<string> {
    const prompt = `请分析以下项目计划数据，识别关键路径、潜在风险和延误任务：

${tasksJson}

请提供：
1. 项目整体概况
2. 关键路径任务列表
3. 潜在风险点
4. 优化建议`;

    return this.provider.complete(prompt, SYSTEM_PROMPTS.PROJECT_ASSISTANT);
  }

  /**
   * 创建任务
   */
  async createTasks(naturalLanguage: string): Promise<string> {
    const prompt = `请将以下自然语言描述转换为项目任务结构（JSON 格式）：

${naturalLanguage}

返回格式示例：
[
  {
    "name": "任务名称",
    "type": "task|phase|milestone",
    "duration": 5,
    "assignee": "负责人",
    "priority": "medium",
    "dependencies": []
  }
]`;

    return this.provider.complete(prompt, SYSTEM_PROMPTS.TASK_CREATOR);
  }

  /**
   * 重新排程建议
   */
  async rescheduleAdvice(projectData: string, constraints: string): Promise<string> {
    const prompt = `请根据以下约束条件，为项目计划提供重新排程建议：

项目数据：
${projectData}

约束条件：
${constraints}

请提供具体的任务调整建议，包括：
1. 哪些任务需要调整时间
2. 调整的原因
3. 对整体项目的影响`;

    return this.provider.complete(prompt, SYSTEM_PROMPTS.SCHEDULER);
  }

  /**
   * 生成状态报告
   */
  async generateReport(projectData: string): Promise<string> {
    const prompt = `请根据以下项目数据生成本周项目状态报告：

${projectData}

请使用 Markdown 格式，包含项目概况、进度更新、风险提示等内容。`;

    return this.provider.complete(prompt, SYSTEM_PROMPTS.REPORT_GENERATOR);
  }

  /**
   * 自然语言查询
   */
  async query(projectData: string, question: string): Promise<string> {
    const prompt = `请根据以下项目数据回答用户问题：

项目数据：
${JSON.stringify(projectData, null, 2)}

用户问题：
${question}

请提供准确、简洁的回答。`;

    return this.provider.complete(prompt, SYSTEM_PROMPTS.PROJECT_ASSISTANT);
  }
}
