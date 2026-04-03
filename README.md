# Project Planner — AI-Native Project Management Tool

A project planning tool with a full **MCP (Model Context Protocol) Server**, designed for AI agents (Claude Code, Cursor, etc.) to create and manage project schedules via natural language. Also ships a React Web UI for visual editing.

---

## For AI Agents: MCP Server Quick Start

> If you are an AI agent reading this, follow these steps to get the MCP tools available in your session.

### Prerequisites

- Node.js 18+
- Claude Code CLI (or any MCP-compatible agent)

### 1. Clone and Build

```bash
git clone <repo-url>
cd <repo-dir>
npm run build:mcp
```

This installs dependencies and compiles the MCP server to `mcp-server/dist/index.js`.

### 2. Register the MCP Server

The project root already contains `.mcp.json`, which Claude Code picks up **automatically** when you open the project directory. No manual registration needed.

If you need to register manually (e.g., for global use):

```bash
claude mcp add project-planner --scope user node /absolute/path/to/mcp-server/dist/index.js
```

### 3. Verify Tools Are Available

In Claude Code, run `/mcp` to confirm `project-planner` is listed and connected.

### 4. Use the Planning Skill

The file `.claude/commands/plan.md` is a Claude Code skill. Invoke it with:

```
/plan
```

It provides a step-by-step workflow for creating a complete project schedule using the MCP tools.

---

## MCP Tools Reference (19 tools)

### Project Management

| Tool | Description |
|------|-------------|
| `create_project` | Create a new project with name, description, working days, holidays |
| `list_projects` | List all saved projects |
| `get_project` | Get full project data including all tasks |
| `update_project` | Update project metadata |
| `delete_project` | Delete a project |

### Task Operations

| Tool | Description |
|------|-------------|
| `add_task` | Add a task/phase/milestone. Supports `parentId` for hierarchy |
| `update_task` | Update task fields (name, duration, assignee, status, progress, dates) |
| `delete_task` | Delete a task (cascades to children) |
| `list_tasks` | List all tasks in table or tree format |
| `add_dependency` | Add FS/SS/FF/SF dependency between tasks |
| `remove_dependency` | Remove a dependency |

### Scheduling

| Tool | Description |
|------|-------------|
| `reschedule_project` | Recalculate all task dates. Skips weekends and Chinese public holidays |
| `get_critical_path` | Return the critical path and float analysis |
| `analyze_schedule` | Return a Markdown analysis report (critical path, risks, summary) |

### Import / Export

| Tool | Description |
|------|-------------|
| `export_json` | Return project as JSON string |
| `export_json_file` | Write project JSON to a file path |
| `import_json` | Import a project from a JSON string |
| `export_excel` | Export project to an Excel file (`.xlsx`) |
| `import_excel` | Import tasks from an Excel file |

---

## Typical Agent Workflow

```
1. create_project(name="My Project", description="...")
   → returns projectId (save this for all subsequent calls)

2. add_task(projectId, name="Phase 1: Requirements", type="phase", duration=5)
   → returns taskId (phaseId)

3. add_task(projectId, name="User Research", type="task", duration=3, parentId=<phaseId>, assignee="Alice")
4. add_task(projectId, name="Requirements Doc", type="task", duration=2, parentId=<phaseId>)

5. add_task(projectId, name="Phase 1 Complete", type="milestone", duration=0)

6. add_dependency(projectId, taskId=<milestoneId>, predecessorId=<lastTaskId>, type="FS")

7. reschedule_project(projectId, startDate="2026-05-01")
   → returns all task dates, automatically skips holidays/weekends

8. analyze_schedule(projectId)
   → returns Markdown report with critical path and risk summary

9. export_excel(projectId, outputPath="/path/to/output.xlsx")
   # or save JSON for Web UI import:
   export_json_file(projectId, outputPath="/path/to/project.json")
```

### Data Persistence

Project data is stored as JSON files at:

```
~/.project-planner/projects/<projectId>.json
```

The Web UI reads the same files — create a project with MCP, then open the Web UI to visualize it.

---

## Web UI Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. Features:
- Task list (tree view) + Gantt chart
- WBS auto-numbering
- Drag-and-drop task editing
- Critical path highlighting
- Excel import/export
- AI assistant (Ctrl/Cmd+K) — supports Anthropic Claude and OpenAI-compatible APIs

### AI Assistant Configuration

Open settings in the Web UI and configure:

| Provider | Model | API Key Source |
|----------|-------|----------------|
| Anthropic | Claude Sonnet 4 | https://console.anthropic.com |
| OpenAI | GPT-4o | https://platform.openai.com |
| Custom | DeepSeek, Moonshot, etc. | Provider's website |

---

## Project Structure

```
.
├── src/                        # React Web UI
│   ├── components/             # UI components
│   ├── engine/                 # CPM scheduler (pure TS, no browser deps)
│   ├── lib/                    # Calendar, WBS, holidays, utils
│   ├── store/                  # Zustand state management
│   └── types/                  # Shared TypeScript types
├── mcp-server/                 # MCP Server (standalone Node.js package)
│   ├── src/
│   │   ├── index.ts            # Server entry point (stdio transport)
│   │   ├── storage.ts          # JSON file persistence
│   │   ├── tools/              # Tool definitions & handlers
│   │   └── engine/, lib/       # Copied pure-TS logic from src/
│   └── package.json
├── .mcp.json                   # Auto-loaded by Claude Code (project scope)
└── .claude/commands/plan.md    # /plan skill — project planning workflow
```

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Web Framework | React 19 + TypeScript |
| Build | Vite 8 |
| Styles | Tailwind CSS 4 |
| State | Zustand |
| Local Storage | IndexedDB (Dexie) |
| MCP Server | @modelcontextprotocol/sdk (stdio) |
| Scheduling Engine | Critical Path Method (CPM) |
| Date handling | date-fns |
| Excel | SheetJS (xlsx) |
| AI SDKs | @anthropic-ai/sdk + openai |

---

## Holiday Support

Scheduling automatically skips **Chinese public statutory holidays** (2024–2027 built-in, official State Council data). Any date that falls on a holiday or weekend is advanced to the next working day. This applies to:
- Manual date edits in the Web UI
- Excel imports
- MCP `reschedule_project`

---

## License

MIT
