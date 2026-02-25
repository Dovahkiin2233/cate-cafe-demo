#!/usr/bin/env node

/**
 * callback-server.js — HTTP 回调服务器（猫咖聊天室）
 * 
 * 纯原生 Node.js 实现，不用任何框架
 * 监听 3200 端口，接收 AI 通过 MCP 工具发送的消息
 * 启动时自动生成 .env 文件
 */

const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 生成一对 UUID 作为验证凭证
const invocationId = crypto.randomUUID();
const callbackToken = crypto.randomUUID();

const PORT = 3200;

// 写入 .env 文件
const envPath = path.join(__dirname, '.env');
const envContent = `# 猫咖 MCP 回传系统 - 环境变量配置
# 自动生成于 ${new Date().toISOString()}

CAT_CAFE_API_URL=http://localhost:${PORT}
CAT_CAFE_INVOCATION_ID=${invocationId}
CAT_CAFE_CALLBACK_TOKEN=${callbackToken}
`;

try {
  fs.writeFileSync(envPath, envContent);
  console.log(`✅ .env 文件已生成：${envPath}`);
} catch (err) {
  console.error(`❌ 无法写入 .env 文件：${err.message}`);
}

// 模拟的对话历史（用于 thread-context 返回）
const mockContext = {
  messages: [
    { role: 'user', content: '请写一首关于猫的诗' }
  ]
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS 头
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // POST /api/callbacks/post-message — AI 发送消息到这里
  if (req.method === 'POST' && pathname === '/api/callbacks/post-message') {
    let body = '';
    
    req.on('data', chunk => { body += chunk.toString(); });

    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const { invocationId: reqId, callbackToken: reqToken, content } = data;

        // 验证凭证 — 这就是认证机制
        if (reqId !== invocationId || reqToken !== callbackToken) {
          console.log('  ❌ 验证失败：invocationId 或 callbackToken 不匹配');
          res.statusCode = 401;
          res.end(JSON.stringify({ error: 'Unauthorized' }));
          return;
        }

        // 验证通过，打印消息（模拟"消息出现在聊天室"）
        console.log('  ✅ 验证通过');
        console.log(`  📬 收到消息：${content}`);
        console.log('  ─────────────────────────────────────');

        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (err) {
        console.log(`  ❌ 解析错误：${err.message}`);
        res.statusCode = 400;
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // GET /api/callbacks/thread-context — AI 获取对话上下文
  if (req.method === 'GET' && pathname === '/api/callbacks/thread-context') {
    const reqId = url.searchParams.get('invocationId');
    const reqToken = url.searchParams.get('callbackToken');

    if (reqId !== invocationId || reqToken !== callbackToken) {
      console.log('  ❌ 验证失败');
      res.statusCode = 401;
      res.end(JSON.stringify({ error: 'Unauthorized' }));
      return;
    }

    console.log('  ✅ 验证通过，返回上下文');
    res.statusCode = 200;
    res.end(JSON.stringify(mockContext));
    return;
  }

  // 404
  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         Callback Server - 猫咖聊天室回传服务器            ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║ 监听端口：${PORT}`);
  console.log(`║ Invocation ID: ${invocationId}`);
  console.log(`║ Callback Token: ${callbackToken}`);
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ API 端点：');
  console.log('║   POST /api/callbacks/post-message  - 发送消息到聊天室');
  console.log('║   GET  /api/callbacks/thread-context - 获取对话上下文');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log('║ 按 Ctrl+C 停止服务器');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
  console.log('请在 MCP Server 中设置以下环境变量：');
  console.log(`  CAT_CAFE_API_URL=http://localhost:${PORT}`);
  console.log(`  CAT_CAFE_INVOCATION_ID=${invocationId}`);
  console.log(`  CAT_CAFE_CALLBACK_TOKEN=${callbackToken}`);
  console.log('');
});
