# GMP (Realtime Multimodal Playground)

基于 Cloudflare Workers 的实时多模态对话平台，支持 **Gemini Live**、**MiniMax Realtime** 与 **Zhipu GLM-Realtime** 三提供方切换，结合了 [gemini-2-live-api-demo](https://github.com/ViaAnthroposBenevolentia/gemini-2-live-api-demo) 和 [gemini-playground](https://github.com/tech-shrimp/gemini-playground) 的优点。

## 功能特性

- 🎤 实时语音对话（支持打断）
- 📷 摄像头实时画面输入（Gemini / GLM-Realtime）
- 🖥️ 屏幕共享（Gemini）
- 📝 文本对话
- 🔊 语音回复
- 🔄 API 代理（OpenAI 格式）
- 🔁 提供方切换：Gemini Live / MiniMax Realtime / Zhipu GLM-Realtime
- ☁️ Cloudflare Workers 免费托管
- 🔐 API Key 由服务端 Secret 托管，前端不持有

> GLM-Realtime 是国产方案中唯一支持实时视频+语音+文本的模型，国内手机无需代理即可使用（视频输入按 2fps 推送 base64 JPEG 帧）。

## 快速部署

### 方式一：一键部署

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/?url=https://github.com/huch16/GMP)](https://deploy.workers.cloudflare.com/?url=https://github.com/huch16/GMP)

### 方式二：手动部署

1. Fork 本仓库
2. 获取 Cloudflare API Token：
   - 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
   - 进入 API Tokens → Create Token
   - 使用 "Edit Cloudflare Workers" 模板
3. 在 GitHub 仓库 Settings → Secrets 中添加：
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. 配置 API Key Secrets：
   - 本地：`wrangler secret put GOOGLE_API_KEY` / `MINIMAX_API_KEY` / `ZHIPU_API_KEY`
   - 或在 Cloudflare Dashboard → Worker → Settings → Variables 中添加
   - 可选：设置 `ACCESS_TOKEN` 以限制 `/v1/*` 与 `/ws/*` 访问
5. Push 到 main 分支，自动部署

### 方式三：本地调试

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录 Cloudflare
wrangler login

# 设置 Secrets
wrangler secret put GOOGLE_API_KEY
wrangler secret put MINIMAX_API_KEY
wrangler secret put ZHIPU_API_KEY

# 本地开发
wrangler dev

# 部署
wrangler deploy
```

## 使用方法

### Web 界面
1. 打开部署后的 URL
2. 点击 ⚙️ 设置按钮
3. 选择 Provider（Gemini Live / MiniMax Realtime / Zhipu GLM-Realtime）
4. 如设置了 `ACCESS_TOKEN`，填写 Access Token
5. 点击 Connect 连接
6. 点击 🎤 开始语音对话，或输入文字后回车

> GLM-Realtime 模式下点击 📷 开启摄像头，视频帧会以 2fps 实时发送给模型。

### API 代理
部署后自动提供 OpenAI 兼容的 API（Gemini 后端）：

```bash
# 获取模型列表
curl https://your-worker.workers.dev/v1/models \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_OR_ANYTHING"

# 对话
curl https://your-worker.workers.dev/v1/chat/completions \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_OR_ANYTHING" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-2.5-flash",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

> 注意：API Key 已移至服务端 Secret，客户端不再需要也不应持有 Gemini/MiniMax/Zhipu Key。若未设置 `ACCESS_TOKEN`，`/v1/*` 与 `/ws/*` 开放访问（适合个人使用，公网建议设置）。

## 架构说明

```
┌─────────────────────────────────────────────────────────────┐
│                    Cloudflare Workers                        │
├─────────────────────────────────────────────────────────────┤
│  /                    → 静态页面 (HTML/CSS/JS)               │
│  /css/*              → 样式文件                              │
│  /js/*               → JavaScript 文件                       │
│  /v1/chat/completions → REST API 代理 (OpenAI 格式, Gemini)  │
│  /v1/models          → 模型列表                              │
│  /ws/gemini          → Gemini Live WebSocket 代理            │
│  /ws/minimax         → MiniMax Realtime WebSocket 代理       │
│  /ws/glm             → Zhipu GLM-Realtime WebSocket 代理     │
└─────────────────────────────────────────────────────────────┘
```

## 技术栈

- **前端**: 原生 HTML/CSS/JavaScript（无依赖）
- **后端**: Cloudflare Workers
- **API**: Gemini Live API / MiniMax Realtime API / Zhipu GLM-Realtime API
- **代理**: OpenAI 格式转换

## 国内访问（推荐方案：绑定自定义域名）

`*.workers.dev` 域名在国内 DNS 污染/限速，**建议为 Worker 绑定自己的域名**，这也是生产环境的标准做法：

1. **准备域名**：注册一个域名（.com/.cn/.net 等），托管到 Cloudflare（或仅 DNS 接入 Cloudflare，免费）。
2. **绑定 Worker**：Cloudflare Dashboard → 你的域名 → **Workers Routes** → Add route：
   - Route：`example.com/*`（可加子域名如 `gmp.example.com/*`）
   - Worker：选择 `gemini-multimodal-playground`
3. **等待生效**：DNS 生效后，直接用 `https://gmp.example.com` 访问，国内可达性远优于 `*.workers.dev`。

> 说明：
> - Gemini 是唯一支持实时视频+语音+文本全模态的模型，但 `generativelanguage.googleapis.com` 在国内直连不稳定，需要为 Worker 与上游建立可达链路（本 Worker 仅代理 /ws 与 /v1，不涉及播放链路）。
> - 若仅需语音+文本，国内可切 MiniMax / Zhipu GLM-Realtime 直连。
> - Deno Deploy 带宽限制不适合语音流，不建议迁移。

## License

MIT
