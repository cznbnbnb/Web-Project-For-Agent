# Claude Code 集成指南

> 将项目计划编辑器与 Claude Code CLI 深度集成

## 目录结构

```
/Users/cznbnb/Project/Web Project For Agent/
├── .claude/
│   ├── commands/
│   │   ├── project-status.md    # 查看项目状态
│   │   ├── project-add.md       # 添加任务
│   │   ├── project-analyze.md   # 分析项目
│   │   └── project-reschedule.md # 重新排程
│   └── hooks/
│       └── config.json          # 钩子配置
└── src/
    └── engine/
        └── agent/               # AI 代理
```

## 命令文件

### project-status.md

```markdown
<file_read file="src/store/projectStore.ts" />

查看当前项目计划状态，包括：
1. 任务总数
2. 各状态任务数量
3. 关键路径任务
4. 项目开始和结束日期
5. 整体进度百分比

输出格式：
## 项目概况
- 任务总数：X
- 已完成：Y (Z%)
- 进行中：A
- 未开始：B
- 受阻：C

## 关键路径
[列出关键路径任务]

## 风险提示
[识别潜在风险]
```

### project-add.md

```markdown
<file_read file="src/lib/excel.ts" />

根据用户描述创建项目任务。

用户输入格式：
- "创建任务 [名称]，工期 [X] 天，负责人 [姓名]"
- "添加阶段 [名称]"
- "添加里程碑 [名称]"

解析后调用 export 函数或直接修改数据。
```

### project-analyze.md

```markdown
<file_read file="src/engine/scheduler.ts" />

分析项目计划：
1. 运行 Scheduler 进行排程
2. 识别关键路径
3. 计算各任务浮动时间
4. 识别潜在延误风险
5. 给出优化建议

输出详细分析报告。
```

### project-reschedule.md

```markdown
<file_read file="src/engine/scheduler.ts" />

重新排程项目计划：
1. 调用 rescheduleProject 函数
2. 考虑节假日配置
3. 更新任务日期
4. 输出新的项目时间表

用户可提供约束条件如"跳过周末"、"考虑国庆假期"等。
```

## 使用示例

```bash
# 查看项目状态
claude /project-status

# 添加任务
claude /project-add 创建任务 "API 设计"，工期 3 天，负责人王五

# 分析项目
claude /project-analyze

# 重新排程
claude /project-reschedule 考虑五一假期，重新排程
```
