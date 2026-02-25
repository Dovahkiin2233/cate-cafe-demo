#!/usr/bin/env node

/**
 * run-cat.js — 调用 Claude CLI + 挂载 MCP Server
 * 
 * 纯原生 Node.js 实现
 * 使用 child_process.spawn 调用 Claude CLI
 * 解析 NDJSON 输出，显示 AI 的"内心独白"
 * 
 * 用法：
 *   CAT_CAFE_API_URL=http://localhost:3200 \
 *   CAT_CAFE_INVOCATION_ID=xxx \
 *   CAT_CAFE_CALLBACK_TOKEN=yyy \
 *   node run-cat.js
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 从环境变量读取配置
const API_URL = process.env.CAT_CAFE_API_URL || 'http://localhost:3200';
const INVOCATION_ID = process.env.CAT_CAFE_INVOCATION_ID;
const CALLBACK_TOKEN = process.env.CAT_CAFE_CALLBACK_TOKEN;

// 默认提示词 — 让 AI 写诗并发送
const DEFAULT_PROMPT = `你是一个诗人。请写一首关于猫的短诗（4 句中文）。

写完后，立即调用 cat_cafe_post_message 工具把诗发送到聊天室。
只发送诗的内容，不需要解释。`;

const prompt = process.argv.slice(2).join(' ') || DEFAULT_PROMPT;

// 检查环境变量
if (!INVOCATION_ID || !CALLBACK_TOKEN) {
  console.error('❌ 错误：缺少必需的环境变量');
  console.error('');
  console.error('用法:');
  console.error('  CAT_CAFE_API_URL=http://localhost:3200 \\');
  console.error('  CAT_CAFE_INVOCATION_ID=xxx \\');
  console.error('  CAT_CAFE_CALLBACK_TOKEN=yyy \\');
  console.error('  node run-cat.js');
  console.error('');
  console.error('请先运行 callback-server.js 获取凭证');
  process.exit(1);
}

// MCP Server 配置
const mcpConfig = {
  mcpServers: {
    'cat-cafe': {
      command: 'node',
      args: [path.join(__dirname, 'cat-cafe-mcp.js')],
      env: {
        CAT_CAFE_API_URL: API_URL,
        CAT_CAFE_INVOCATION_ID: INVOCATION_ID,
        CAT_CAFE_CALLBACK_TOKEN: CALLBACK_TOKEN
      }
    }
  }
};

// 写入临时配置文件
const mcpConfigFile = path.join(__dirname, '.mcp-config.tmp.json');
fs.writeFileSync(mcpConfigFile, JSON.stringify(mcpConfig, null, 2));

// 构建 claude 命令
const args = [
  '-p', prompt,
  '--output-format', 'stream-json',  // NDJSON 输出
  '--verbose',
  '--permission-mode', 'bypassPermissions',  // 自动批准工具调用
  '--mcp-config', mcpConfigFile
];

// 跨平台 spawn
function spawnCommand(name, args, options) {
  if (process.platform === 'win32') {
    return spawn(name, args, options);
  } else {
    return spawn(name, args, options);
  }
}

const claude = spawnCommand('claude', args, {
  stdio: ['ignore', 'pipe', 'pipe']
});

// 解析 NDJSON 输出 — 这就是 AI 的"内心独白"
const readline = require('readline');
const rl = readline.createInterface({
  input: claude.stdout,
  crlfDelay: Infinity
});

let sessionId = null;

rl.on('line', (line) => {
  if (!line.trim()) return;

  try {
    const event = JSON.parse(line);
    
    // 提取 session ID
    if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
      sessionId = event.session_id;
    }

    // 提取并打印文本（AI 的思考过程 + 最终回复）
    if (event.type === 'assistant' && event.message) {
      const content = event.message.content || [];
      for (const block of content) {
        if (block.type === 'text' && block.text) {
          process.stdout.write(block.text);
        }
      }
    }
  } catch (err) {
    // 忽略解析错误
  }
});

// stderr 输出（MCP 日志等）
claude.stderr.on('data', (data) => {
  process.stderr.write(data);
});

claude.on('close', (code) => {
  // 清理临时文件
  try {
    fs.unlinkSync(mcpConfigFile);
  } catch (e) {}
  
  console.log();
  if (code === 0) {
    console.log('[完成]');
    if (sessionId) {
      console.log(`Session: ${sessionId}`);
    }
  } else {
    console.error(`[错误] 进程退出码：${code}`);
    process.exit(code);
  }
});

claude.on('error', (err) => {
  console.error(`[错误] 无法启动 Claude CLI: ${err.message}`);
  process.exit(1);
});
