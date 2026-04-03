# 项目规划工作流

使用 project-planner MCP 工具创建并排程一个完整的项目计划。

## 标准工作流

### 1. 创建项目
```
create_project(name="项目名称", description="描述")
```
→ 记录返回的 projectId，后续所有操作都需要用到

### 2. 按层级添加任务
**顺序：先添加父任务（phase），再添加子任务（task）**
```
add_task(projectId, name="需求分析", type="phase", duration=5)
add_task(projectId, name="用户调研", type="task", duration=3, parentId=<阶段ID>, assignee="张三")
add_task(projectId, name="需求文档", type="task", duration=2, parentId=<阶段ID>)
```

### 3. 设置里程碑
```
add_task(projectId, name="需求确认", type="milestone", duration=0)
```

### 4. 建立前置依赖
```
add_dependency(projectId, taskId=<后继任务>, predecessorId=<前置任务>, type="FS")
```
依赖类型：
- `FS`（完成-开始）：最常用，前置完成后才能开始
- `SS`（开始-开始）：同时开始
- `FF`（完成-完成）：同时结束
- `SF`（开始-完成）：少见

### 5. 自动排程
```
reschedule_project(projectId, startDate="2026-01-05")
```
→ 自动跳过中国法定节假日和周末
→ 返回所有任务的开始/结束日期

### 6. 分析关键路径
```
analyze_schedule(projectId)
```
→ 返回关键路径、风险任务、完成情况摘要

### 7. 导出结果
```
export_excel(projectId, outputPath="/path/to/output.xlsx")
# 或导出 JSON（可在 Web UI 中导入可视化）
export_json_file(projectId, outputPath="/path/to/project.json")
```

## 常用模式

### 快速创建多任务项目
一次性描述项目需求，AI 自动拆解任务：
> "帮我创建一个电商平台开发项目，包含需求、设计、前端、后端、测试五个阶段，每阶段3-5个任务，项目从2026-03-01开始"

### 更新任务状态
```
update_task(projectId, taskId, status="in_progress", progress=30)
```

### 查看当前任务列表
```
list_tasks(projectId, format="table")
```

## 注意事项
- 节假日已内置中国法定节假日（2024-2027），无需手动配置
- 里程碑 duration=0，不占用工作日
- reschedule_project 每次都会重算所有日期，建议在添加完所有任务和依赖后调用一次
- 数据持久化在 ~/.project-planner/projects/ 目录，JSON 格式
