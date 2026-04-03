# 快速开始指南

## 项目运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview
```

## 功能概览

### 1. 任务列表视图
- 树形结构展示任务层级
- 支持拖拽排序
- WBS 自动编号
- 任务增删改查

### 2. 甘特图视图
- 时间轴可视化
- 关键路径标记
- 任务依赖关系
- 支持日/周/月缩放

### 3. Excel 导入导出
- 一键导出项目计划
- 智能解析导入
- 数据校验

### 4. AI 助手
- 按 `Ctrl/Cmd + K` 打开
- 自然语言创建任务
- 项目分析
- 状态报告生成

## 配置 AI

1. 点击顶部 **AI 设置**
2. 选择服务商（Anthropic / OpenAI / 自定义）
3. 填入 API Key
4. 保存后即可使用

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl/Cmd + K` | 打开 AI 助手 |
| `Ctrl/Cmd + L` | 切换视图 |

## 数据结构

### Task 类型

```typescript
interface Task {
  id: string;
  name: string;
  type: 'task' | 'milestone' | 'phase';
  wbs: string;
  parentId?: string;
  duration?: number;
  startDate?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked' | 'cancelled';
  assignee?: string;
  progress: number;
}
```

## 下一步

- 查看 [Agent 操作手册](./agent-handbook/README.md)
- 查看 [节假日配置](./holidays.md)
- 查看 [Claude Code 集成](./agent-handbook/claude-code-integration.md)
