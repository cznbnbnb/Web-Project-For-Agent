#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { projectTools, handleProjectTool } from './tools/project.js';
import { taskTools, handleTaskTool } from './tools/task.js';
import { scheduleTools, handleScheduleTool } from './tools/schedule.js';
import { exportTools, handleExportTool } from './tools/export.js';

const ALL_TOOLS = [...projectTools, ...taskTools, ...scheduleTools, ...exportTools];

const server = new Server(
  { name: 'project-planner', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: ALL_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (projectTools.some(t => t.name === name)) {
      return handleProjectTool(name, args as Record<string, unknown>);
    }
    if (taskTools.some(t => t.name === name)) {
      return handleTaskTool(name, args as Record<string, unknown>);
    }
    if (scheduleTools.some(t => t.name === name)) {
      return handleScheduleTool(name, args as Record<string, unknown>);
    }
    if (exportTools.some(t => t.name === name)) {
      return await handleExportTool(name, args as Record<string, unknown>);
    }
    return { content: [{ type: 'text', text: `未知工具: ${name}` }], isError: true };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `工具执行错误: ${error instanceof Error ? error.message : String(error)}` }],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // MCP server 使用 stdio，不能向 stdout 输出日志
  process.stderr.write('Project Planner MCP Server started\n');
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
