# 项目规划工作流

使用 project-planner MCP 工具创建并排程一个完整的项目计划。

## ⚠️ 核心原则（必读）

1. **不要手动设置开始/结束日期**：任务的 `startDate` / `endDate` 由 `reschedule_project` 自动计算，手动填写会导致日期错误（如落在周末、节假日）。只有在没有任何前置任务的"根任务"上才可以设置 `startDate` 作为项目起始锚点。
2. **不要同时编辑 Web UI**：Agent 通过 MCP 写入数据，Web UI 加载的是 IndexedDB 中的数据。Agent 操作期间不要在 Web UI 手动修改，完成后通过"导入 JSON"刷新。
3. **以工期（duration）为准**：只填工作日天数，系统自动推算开始/结束日期，自动跳过周末和法定节假日。
4. **节假日已内置**：中国 2024–2027 法定节假日已自动排除，无需手动配置。

---

## 标准工作流

### 1. 创建项目
```
create_project(name="项目名称", description="描述")
```
→ 记录返回的 `projectId`，后续所有操作都需要用到

### 2. 按层级添加任务（仅填工期，不填日期）
**顺序：先添加父任务（phase），再添加子任务（task）**
```
add_task(projectId, name="需求分析", type="phase", duration=5)
add_task(projectId, name="用户调研", type="task", duration=3, parentId=<阶段ID>, assignee="张三")
add_task(projectId, name="需求文档", type="task", duration=2, parentId=<阶段ID>)
```
**⚠️ 不要在 add_task 中填写 startDate，统一由 reschedule_project 计算**

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

### 5. 一次性自动排程（所有任务添加完后统一调用）
```
reschedule_project(projectId, startDate="2026-01-05")
```
→ 自动跳过中国法定节假日和周末
→ 返回所有任务的开始/结束日期
**⚠️ 必须在添加完所有任务和依赖后再调用一次，中途不要重复调用**

### 6. 验证排程结果
```
list_tasks(projectId, format="table")
```
→ 检查所有任务的开始/结束日期是否合理
→ 验证工期与开始/结束日期是否匹配（结束日期 = 开始日期 + duration-1 个工作日）
→ 验证没有任务落在周末或节假日（周六=6, 周日=0）

### 7. 分析关键路径（可选）
```
analyze_schedule(projectId)
```
→ 返回关键路径、风险任务、完成情况摘要

### 8. 导出 JSON 供 Web UI 加载
```
export_json_file(projectId, outputPath="/path/to/project.json")
```
→ 在 Web UI 点击"导入 Excel/JSON" → 选择此文件 → 即可在界面中可视化和手动编辑
→ **导入后，Web UI 是唯一的编辑入口，不要再通过 MCP 修改同一个项目**

---

## 常用模式

### 快速创建多任务项目
一次性描述项目需求，AI 自动拆解任务：
> "帮我创建一个电商平台开发项目，包含需求、设计、前端、后端、测试五个阶段，每阶段3-5个任务，项目从2026-03-03开始"

### 更新任务状态（进行中时）
```
update_task(projectId, taskId, status="in_progress", progress=30)
```
**⚠️ 更新状态时不要同时修改 startDate/endDate，保持排程结果不变**

### 查看当前任务列表
```
list_tasks(projectId, format="table")
```

---

## 注意事项
- 节假日已内置中国法定节假日（2024-2027），无需手动配置
- 里程碑 duration=0，不占用工作日
- `reschedule_project` 每次都会重算所有日期，**只在任务全部添加完成后调用一次**
- 数据持久化在 `~/.project-planner/projects/` 目录，JSON 格式
- 项目开始日期（`startDate`）如果是非工作日，系统自动顺延到下一个工作日
- 2026年4月4日（清明节）、4月5日、4月6日为法定节假日，排程会自动跳过
