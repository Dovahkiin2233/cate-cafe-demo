#!/usr/bin/env node

/**
 * run.js — 一键启动猫咖 MCP 演示
 * 
 * 1. 启动 callback-server.js
 * 2. 捕获输出的凭证
 * 3. 保存到 .env 文件
 * 4. 启动 run-cat.js（从 .env 读取配置）
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

let catStarted = false;

console.log('🐱 猫咖 MCP 回传系统');
console.log('═══════════════════════════════════════════');
console.log('');

// 启动 callback server
const server = spawn('node', [path.join(__dirname, 'callback-server.js')], {
  stdio: ['ignore', 'pipe', 'pipe']
});

let invocationId = null;
let callbackToken = null;

server.stdout.on('data', (data) => {
  const str = data.toString();
  
  // 提取凭证
  const idMatch = str.match(/Invocation ID: ([a-f0-9-]+)/i);
  if (idMatch && !invocationId) invocationId = idMatch[1];
  
  const tokenMatch = str.match(/Callback Token: ([a-f0-9-]+)/i);
  if (tokenMatch && !callbackToken) callbackToken = tokenMatch[1];
  
  // 打印服务器输出
  process.stdout.write(`[Server] ${str}`);
  
  // 服务器就绪，保存凭证并启动 cat
  if (str.includes('按 Ctrl+C') && invocationId && callbackToken && !catStarted) {
    catStarted = true;
    
    // 保存到 .env 文件
    const envContent = `# 猫咖 MCP 回传系统 - 环境变量配置
# 自动生成于 ${new Date().toISOString()}

CAT_CAFE_API_URL=http://localhost:3200
CAT_CAFE_INVOCATION_ID=${invocationId}
CAT_CAFE_CALLBACK_TOKEN=${callbackToken}
`;
    fs.writeFileSync(path.join(__dirname, '.env'), envContent);
    
    console.log('');
    console.log('[凭证已获取并保存到 .env 文件]');
    console.log(`  Invocation ID: ${invocationId}`);
    console.log(`  Callback Token: ${callbackToken}`);
    console.log('');
    console.log('[启动 Claude CLI + MCP...]');
    console.log('═══════════════════════════════════════════');
    console.log('');
    
    // 启动 run-cat.js（它会自动从 .env 读取）
    const cat = spawn('node', [path.join(__dirname, 'run-cat.js')], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env
    });
    
    cat.stdout.on('data', (data) => process.stdout.write(data.toString()));
    cat.stderr.on('data', (data) => process.stderr.write(data.toString()));
    
    cat.on('close', (code) => {
      console.log('');
      console.log('═══════════════════════════════════════════');
      console.log('[完成] 正在关闭服务器...');
      server.kill();
      process.exit(code);
    });
  }
});

server.stderr.on('data', (data) => process.stderr.write(`[Server Error] ${data.toString()}`));

server.on('error', (err) => {
  console.error('[错误] 无法启动服务器:', err.message);
  process.exit(1);
});
