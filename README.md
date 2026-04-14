# GMP (Gemini Multimodal Playground)

基于 Cloudflare Workers 的 Gemini 多模态对话平台，结合了 [gemini-2-live-api-demo](https://github.com/ViaAnthroposBenevolentia/gemini-2-live-api-demo) 和 [gemini-playground](https://github.com/tech-shrimp/gemini-playground) 的优点。

## 功能特性

- 🎤 实时语音对话（支持打断）
- 📷 摄像头实时画面输入
- 🖥️ 屏幕共享
- 📝 文本对话
- 🔊 语音回复
- 🔄 API 代理（OpenAI 格式）
- ☁️ Cloudflare Workers 免费托管

## 快速部署

### 方式一：一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/gemini-multimodal-playground)](https://deploy.workers.cloudflare.com/?url=https://github.com/YOUR_USERNAME/gemini-multimodal-playground)

### 方式二：手动部署

1. Fork 本仓库
2. 获取 Cloudflare API Token：
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 API Tokens → Create Token
   - 使用 "Edit Cloudflare Workers" 模板
3. 在 GitHub 仓库 Settings → Secrets 中添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Push 到 main 分支，自动部署

### 方式三：本地调试

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 本地开发
cd src && wrangler dev

# 部署
wrangler deploy
```

## 使用方法

### Web 界面
1. 打开部署后的 URL
2. 点击 ⚙️ 设置按钮
3. 输入 Gemini API Key（从 [Google AI Studio](https://aistudio.google.com) 获取）
4. 点击 Connect 连接

### API 代理
部署后自动提供 OpenAI 兼容的 API：

```bash
# 获取模型列表
curl https://your-worker.workers.dev/v1/models \
  -H "Authorization: Bearer YOUR_GEMINI_API_KEY"

# 对话
curl https://your-worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer YOUR_GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
├─────────────────────────────────────────────────────────────┤
│  /                    → 静态页面 (HTML/CSS/JS)               │
│  /css/*              → 样式文件                              │
│  /js/*               → JavaScript 文件                       │
│  /v1/chat/completions → REST API 代理 (OpenAI 格式)         │
│  /v1/models          → 模型列表                              │
│  /ws/*               → WebSocket Live API 代理               │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript（无依赖）
- **后端**: Cloudflare Workers
- **API**: Gemini 2.0 Multimodal Live API
- **代理**: OpenAI 格式转换

## 国内访问

Cloudflare Workers 在国内访问可能受限，建议：

1. 绑定自定义域名
2. 或使用 Deno Deploy 部署（参见 [原 gemini-playground](https://github.com/tech-shrimp/gemini-playground)）

## License

MIT
