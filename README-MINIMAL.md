# 猫咖 MCP 回传系统

最小 MCP 回传系统，演示"AI 主动说话"的机制。

## 核心概念

| 概念 | 说明 |
|------|------|
| **内心独白** | Claude CLI 的 stdout 输出，包含完整思考过程 |
| **主动发言** | AI 通过 MCP 工具调用 HTTP callback，选择性发送内容 |
| **认证机制** | invocationId + callbackToken 验证，错误凭证返回 401 |

## 文件说明

| 文件 | 技术栈 | 说明 |
|------|--------|------|
| `callback-server.js` | 纯 Node.js | HTTP 回调服务器，监听 3200 端口 |
| `cat-cafe-mcp.js` | MCP SDK | MCP Server，提供两个工具 |
| `run-cat.js` | 纯 Node.js | 调用 Claude CLI，解析 NDJSON 输出 |
| `run.js` | 纯 Node.js | 一键启动演示 |

## 快速开始

```bash
# 一键启动
node run.js
```

或分步启动：

**终端 1：**
```bash
node callback-server.js
# 记录输出的 Invocation ID 和 Callback Token
```

**终端 2：**
```bash
CAT_CAFE_API_URL=http://localhost:3200 \
CAT_CAFE_INVOCATION_ID=xxx \
CAT_CAFE_CALLBACK_TOKEN=yyy \
node run-cat.js
```

## 预期结果

### 终端 1（Callback Server）— "主动发言"
```
[Server] POST /api/callbacks/post-message
[Server]   ✅ 验证通过
📬 收到消息：猫儿轻步踏雪来
            眼如明珠夜光开
            慵懒蜷缩暖阳下
            梦中追逐蝴蝶飞
─────────────────────────────────────
```

### 终端 2（Claude CLI）— "内心独白"
```
诗已创作完成并发送到猫咖聊天室。
[完成]
Session: xxx
```

**两个终端的输出不同！** 这就是"内心独白 vs 主动发言"的区别。

## 核心设计

### 1. 架构图

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│  Callback       │◄────────│  MCP Server     │◄────────│  Claude CLI     │
│  Server         │  HTTP   │  (cat-cafe-mcp) │  stdin  │  (AI Agent)     │
│  :3200          │         │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
       │                           │                             │
       ▼                           ▼                             ▼
  终端 1：接收"主动发言"          工具层                      终端 2：显示"内心独白"
  (只有 AI 选择发送的内容)                                   (AI 的完整思考过程)
```

### 2. 认证机制

```javascript
// callback-server.js 生成凭证
const invocationId = crypto.randomUUID();
const callbackToken = crypto.randomUUID();

// cat-cafe-mcp.js 发送时携带凭证
fetch(`${API_URL}/api/callbacks/post-message`, {
  body: JSON.stringify({
    invocationId: INVOCATION_ID,
    callbackToken: CALLBACK_TOKEN,
    content
  })
});

// callback-server.js 验证
if (reqId !== invocationId || reqToken !== callbackToken) {
  res.statusCode = 401;  // 认证失败
}
```

### 3. NDJSON 解析

```javascript
// run-cat.js 逐行解析 Claude 输出
rl.on('line', (line) => {
  const event = JSON.parse(line);
  
  // 提取文本内容
  if (event.type === 'assistant' && event.message) {
    for (const block of event.message.content) {
      if (block.type === 'text' && block.text) {
        process.stdout.write(block.text);
      }
    }
  }
});
```

### 4. MCP 工具定义

```javascript
// cat-cafe-mcp.js
server.tool(
  'cat_cafe_post_message',
  '向猫咖聊天室发送一条消息',
  { content: z.string() },
  async ({ content }) => {
    // HTTP POST 到 callback server
  }
);
```

## 依赖安装

```bash
npm install
```

已包含：
- `@modelcontextprotocol/sdk` — MCP SDK
- `zod` — Schema 验证

## 故障排除

### "验证失败"
检查 Invocation ID 和 Callback Token 是否与 callback-server.js 输出的一致。

### "401 Unauthorized"
凭证不匹配。可能是：
- 环境变量设置错误
- callback-server.js 重启后生成了新凭证

### AI 不调用工具
- 提示词明确要求 AI 调用工具
- 使用 `--permission-mode bypassPermissions` 自动批准
