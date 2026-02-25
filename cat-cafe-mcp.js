#!/usr/bin/env node

/**
 * cat-cafe-mcp.js — 最小 MCP Server
 * 
 * 使用 @modelcontextprotocol/sdk 实现
 * 提供两个工具：cat_cafe_post_message 和 cat_cafe_get_context
 */

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

// 从环境变量读取配置
const API_URL = process.env.CAT_CAFE_API_URL || 'http://localhost:3200';
const INVOCATION_ID = process.env.CAT_CAFE_INVOCATION_ID;
const CALLBACK_TOKEN = process.env.CAT_CAFE_CALLBACK_TOKEN;

console.error('[Cat Cafe MCP] 启动...');
console.error(`[Cat Cafe MCP] API URL: ${API_URL}`);

// 创建 MCP Server
const server = new McpServer({
  name: 'cat-cafe',
  version: '1.0.0'
});

/**
 * 工具 1: cat_cafe_post_message
 * 向聊天室发送消息 — 这就是"猫主动说话"的出口
 */
server.tool(
  'cat_cafe_post_message',
  '向猫咖聊天室发送一条消息。只发送最终结果，不要发送思考过程。',
  {
    content: z.string().describe('要发送的消息内容')
  },
  async ({ content }) => {
    console.error(`[Cat Cafe MCP] 发送消息：${content}`);

    try {
      const response = await fetch(`${API_URL}/api/callbacks/post-message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invocationId: INVOCATION_ID,
          callbackToken: CALLBACK_TOKEN,
          content
        })
      });

      if (response.status === 401) {
        console.error('[Cat Cafe MCP] ❌ 验证失败');
        return {
          content: [{ type: 'text', text: '❌ 验证失败：凭证不正确' }]
        };
      }

      if (!response.ok) {
        console.error(`[Cat Cafe MCP] ❌ HTTP ${response.status}`);
        return {
          content: [{ type: 'text', text: `❌ 发送失败：HTTP ${response.status}` }]
        };
      }

      console.error('[Cat Cafe MCP] ✅ 发送成功');
      return {
        content: [{ type: 'text', text: `✅ 已发送：${content}` }]
      };
    } catch (err) {
      console.error(`[Cat Cafe MCP] ❌ ${err.message}`);
      return {
        content: [{ type: 'text', text: `❌ 错误：${err.message}` }]
      };
    }
  }
);

/**
 * 工具 2: cat_cafe_get_context
 * 获取对话上下文
 */
server.tool(
  'cat_cafe_get_context',
  '从猫咖聊天室获取当前对话的上下文历史',
  {},
  async () => {
    console.error('[Cat Cafe MCP] 获取上下文...');

    try {
      const url = new URL(`${API_URL}/api/callbacks/thread-context`);
      url.searchParams.set('invocationId', INVOCATION_ID);
      url.searchParams.set('callbackToken', CALLBACK_TOKEN);

      const response = await fetch(url.toString());

      if (response.status === 401) {
        return {
          content: [{ type: 'text', text: '❌ 验证失败' }]
        };
      }

      const context = await response.json();
      return {
        content: [{ 
          type: 'text', 
          text: `📜 上下文：${JSON.stringify(context, null, 2)}` 
        }]
      };
    } catch (err) {
      return {
        content: [{ type: 'text', text: `❌ 错误：${err.message}` }]
      };
    }
  }
);

// 启动服务器
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Cat Cafe MCP] ✅ 已连接，等待指令...');
}

main().catch((err) => {
  console.error('[Cat Cafe MCP] ❌ 启动失败:', err);
  process.exit(1);
});
