const ASSETS_MANIFEST = {};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if ((request.headers.get('Upgrade') || '').toLowerCase() === 'websocket') {
      if (url.pathname.startsWith('/ws/gemini')) {
        return handleGeminiWebSocket(request, env);
      }
      if (url.pathname.startsWith('/ws/minimax')) {
        return handleMiniMaxWebSocket(request, env);
      }
      if (url.pathname.startsWith('/ws/glm')) {
        return handleGLMWebSocket(request, env);
      }
      return new Response('Not Found', { status: 404 });
    }

    if (url.pathname.startsWith('/v1/')) {
      return handleAPIRequest(request, env);
    }

    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(indexHTML, {
        headers: { 'content-type': 'text/html;charset=UTF-8' },
      });
    }

    if (url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/')) {
      const contentType = url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript';
      const key = url.pathname.slice(1);
      const content = url.pathname.startsWith('/css/') ? cssFiles[key] : jsFiles[key];
      if (content) {
        return new Response(content, { headers: { 'content-type': contentType } });
      }
    }

    return new Response('Not Found', { status: 404 });
  },
};

function checkAuth(request, env) {
  if (!env.ACCESS_TOKEN) return true;
  const url = new URL(request.url);
  if (url.searchParams.get('token') === env.ACCESS_TOKEN) return true;
  const auth = request.headers.get('Authorization') || '';
  return auth === `Bearer ${env.ACCESS_TOKEN}`;
}

function relay(proxy, upstream) {
  let pendingMessages = [];
  upstream.addEventListener('open', () => {
    for (const msg of pendingMessages) {
      upstream.send(msg);
    }
    pendingMessages = [];
  });
  proxy.addEventListener('message', (event) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(event.data);
    } else {
      pendingMessages.push(event.data);
    }
  });
  upstream.addEventListener('message', (event) => {
    if (proxy.readyState === WebSocket.OPEN) {
      proxy.send(event.data);
    }
  });
  upstream.addEventListener('close', (event) => {
    if (proxy.readyState !== WebSocket.CLOSED) {
      proxy.close(event.code || 1000, event.reason || undefined);
    }
  });
  proxy.addEventListener('close', (event) => {
    if (upstream.readyState !== WebSocket.CLOSED) {
      upstream.close(event.code || 1000, event.reason || undefined);
    }
  });
  upstream.addEventListener('error', (event) => {
    console.log('UPSTREAM_ERROR', JSON.stringify({ url: event.target?.url, message: event.message, code: event.code, reason: event.reason }));
  });
}

async function handleGeminiWebSocket(request, env) {
  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.GOOGLE_API_KEY) {
    return new Response('GOOGLE_API_KEY not configured', { status: 500 });
  }
  const targetUrl =
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${env.GOOGLE_API_KEY}`;

  const [client, proxy] = new WebSocketPair();
  proxy.accept();
  const upstream = new WebSocket(targetUrl);
  upstream.addEventListener('error', (e) => {
    console.log('GEMINI_UPSTREAM_ERROR', JSON.stringify({ message: e.message, reason: e.reason, code: e.code }));
  });
  relay(proxy, upstream);
  return new Response(null, { status: 101, webSocket: client });
}

async function handleMiniMaxWebSocket(request, env) {
  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.MINIMAX_API_KEY) {
    return new Response('MINIMAX_API_KEY not configured', { status: 500 });
  }
  const url = new URL(request.url);
  const model = url.searchParams.get('model') || 'abab6.5s-chat';
  const targetUrl = `wss://api.minimax.chat/ws/v1/realtime?model=${encodeURIComponent(model)}`;

  const upstreamResp = await fetch(targetUrl, {
    headers: {
      'Upgrade': 'websocket',
      'Authorization': `Bearer ${env.MINIMAX_API_KEY}`,
    },
  });
  if (!upstreamResp.webSocket) {
    return new Response('Upstream connection failed: ' + upstreamResp.status, { status: 502 });
  }

  const [client, proxy] = new WebSocketPair();
  proxy.accept();
  const upstream = upstreamResp.webSocket;
  upstream.accept();
  relay(proxy, upstream);

  return new Response(null, { status: 101, webSocket: client });
}

async function handleGLMWebSocket(request, env) {
  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }
  if (!env.ZHIPU_API_KEY) {
    return new Response('ZHIPU_API_KEY not configured', { status: 500 });
  }
  const targetUrl = 'wss://open.bigmodel.cn/api/paas/v4/realtime';

  const upstreamResp = await fetch(targetUrl, {
    headers: {
      'Upgrade': 'websocket',
      'Authorization': `Bearer ${env.ZHIPU_API_KEY}`,
    },
  });
  if (!upstreamResp.webSocket) {
    return new Response('Upstream connection failed: ' + upstreamResp.status, { status: 502 });
  }

  const [client, proxy] = new WebSocketPair();
  proxy.accept();
  const upstream = upstreamResp.webSocket;
  upstream.accept();
  relay(proxy, upstream);

  return new Response(null, { status: 101, webSocket: client });
}

async function handleAPIRequest(request, env) {
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

  if (!checkAuth(request, env)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const apiKey = env.GOOGLE_API_KEY;
  const url = new URL(request.url);

  if (url.pathname.endsWith('/models') && request.method === 'GET') {
    return handleModels(apiKey);
  }

  if (url.pathname.endsWith('/chat/completions') && request.method === 'POST') {
    const body = await request.json();
    return handleCompletions(body, apiKey, request.headers.get('Accept')?.includes('text/event-stream'));
  }

  if (url.pathname.endsWith('/embeddings') && request.method === 'POST') {
    const body = await request.json();
    return handleEmbeddings(body, apiKey);
  }

  return new Response('Not Found', { status: 404 });
}

const BASE_URL = 'https://generativelanguage.googleapis.com';

async function handleModels(apiKey) {
  const resp = await fetch(`${BASE_URL}/v1beta/models`, {
    headers: { 'x-goog-api-key': apiKey, 'x-goog-api-client': 'genai-js/0.21.0' },
  });
  const { models } = await resp.json();
  return new Response(JSON.stringify({
    object: 'list',
    data: models.map(m => ({ id: m.name.replace('models/', ''), object: 'model' })),
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function handleEmbeddings(req, apiKey) {
  const model = req.model?.startsWith('models/') ? req.model : `models/${req.model || 'text-embedding-004'}`;
  const resp = await fetch(`${BASE_URL}/v1beta/${model}:batchEmbedContents`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requests: (Array.isArray(req.input) ? req.input : [req.input]).map(text => ({
        model, content: { parts: { text } }, outputDimensionality: req.dimensions,
      })),
    }),
  });
  const { embeddings } = await resp.json();
  return new Response(JSON.stringify({
    object: 'list',
    data: embeddings.map((e, i) => ({ object: 'embedding', index: i, embedding: e.values })),
    model: req.model,
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function handleCompletions(req, apiKey, stream) {
  let model = req.model?.startsWith('models/') ? req.model.slice(7) : (req.model || 'gemini-1.5-pro-latest');
  const task = stream ? 'streamGenerateContent' : 'generateContent';
  let url = `${BASE_URL}/v1beta/models/${model}:${task}`;
  if (stream) url += '?alt=sse';

  const contents = [];
  let systemInstruction;

  for (const msg of req.messages || []) {
    if (msg.role === 'system') {
      systemInstruction = { parts: [{ text: msg.content }] };
    } else {
      const parts = [];
      if (Array.isArray(msg.content)) {
        for (const item of msg.content) {
          if (item.type === 'text') parts.push({ text: item.text });
          if (item.type === 'image_url') {
            const match = item.image_url.url.match(/^data:(.*?)(;base64)?,(.*)$/);
            if (match) parts.push({ inlineData: { mimeType: match[1], data: match[3] } });
          }
        }
      } else {
        parts.push({ text: msg.content });
      }
      contents.push({ role: msg.role === 'assistant' ? 'model' : 'user', parts });
    }
  }

  const harmCategory = ['HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT', 'HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_CIVIC_INTEGRITY'];
  const body = {
    systemInstruction,
    contents,
    safetySettings: harmCategory.map(c => ({ category: c, threshold: 'BLOCK_NONE' })),
    generationConfig: {
      temperature: req.temperature,
      topP: req.top_p,
      topK: req.top_k,
      maxOutputTokens: req.max_tokens || req.max_completion_tokens,
      stopSequences: req.stop,
    },
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    return new Response(errText, {
      status: resp.status,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  if (stream) {
    const streamResp = resp.body
      .pipeThrough(new TextDecoderStream())
      .pipeThrough(new TransformStream({
        transform(chunk, controller) {
          this.buffer = (this.buffer || '') + chunk;
          const lines = this.buffer.split('\n\n');
          this.buffer = lines.pop();
          for (const line of lines) {
            const match = line.match(/^data: (.*)$/);
            if (match) {
              const data = JSON.parse(match[1]);
              const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              const id = 'chatcmpl-' + Math.random().toString(36).slice(2, 11);
              controller.enqueue(`data: ${JSON.stringify({
                id, choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                created: Math.floor(Date.now() / 1000), model,
              })}\n\n`);
            }
          }
        },
        flush(controller) {
          if (this.buffer) {
            const match = this.buffer.match(/^data: (.*)$/);
            if (match) {
              const data = JSON.parse(match[1]);
              const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
              const id = 'chatcmpl-' + Math.random().toString(36).slice(2, 11);
              controller.enqueue(`data: ${JSON.stringify({
                id, choices: [{ index: 0, delta: { content: text }, finish_reason: 'stop' }],
                created: Math.floor(Date.now() / 1000), model,
              })}\n\n`);
            }
          }
          controller.enqueue('data: [DONE]\n\n');
        },
      }));
    return new Response(streamResp, { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } });
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
  const id = 'chatcmpl-' + Math.random().toString(36).slice(2, 11);
  return new Response(JSON.stringify({
    id, object: 'chat.completion', created: Math.floor(Date.now() / 1000), model,
    choices: [{ index: 0, message: { role: 'assistant', content: text }, finish_reason: 'stop' }],
    usage: { prompt_tokens: data.usageMetadata?.promptTokenCount || 0, completion_tokens: data.usageMetadata?.candidatesTokenCount || 0, total_tokens: data.usageMetadata?.totalTokenCount || 0 },
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

const indexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>GMP - Realtime Playground</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <div class="app-container">
        <div class="header">
            <h1>GMP Realtime Playground</h1>
            <div class="controls">
                <button id="settingsBtn" class="settings-btn">⚙️</button>
                <button id="connectBtn" class="connect-btn">Connect</button>
                <button id="disconnectBtn" class="disconnect-btn" style="display: none;">Disconnect</button>
            </div>
        </div>
        <div class="input-sources">
            <button id="micBtn" class="source-btn active" title="Microphone">
                <span class="icon">🎤</span>
                <span class="label">Mic</span>
            </button>
            <button id="cameraBtn" class="source-btn" title="Camera">
                <span class="icon">📷</span>
                <span class="label">Camera</span>
            </button>
            <button id="screenBtn" class="source-btn" title="Screen Share">
                <span class="icon">🖥️</span>
                <span class="label">Screen</span>
            </button>
        </div>
        <div id="chatHistory" class="chat-history"></div>
        <div class="visualizer-container">
            <canvas id="visualizer" class="visualizer"></canvas>
        </div>
        <div id="cameraPreview" class="camera-preview"></div>
        <div id="screenPreview" class="screen-preview"></div>
        <div class="text-input-container">
            <input type="text" id="messageInput" placeholder="Type your message..." class="text-input">
            <button id="sendBtn" class="send-btn">➤</button>
        </div>
    </div>
    <div id="settingsModal" class="modal">
        <div class="modal-content">
            <h2>Settings</h2>
            <label>Provider: <select id="providerSelect">
                <option value="gemini">Gemini Live</option>
                <option value="minimax">MiniMax Realtime</option>
                <option value="glm">Zhipu GLM-Realtime</option>
            </select></label>
            <label>Model: <select id="modelSelect">
                <optgroup label="Gemini" data-provider="gemini">
                <option value="models/gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash (Native Audio Preview)</option>
                <option value="models/gemini-3.1-flash-live-preview">Gemini 3.1 Flash (Live Preview)</option>
                <option value="models/gemini-2.5-flash-native-audio-preview-09-2025">Gemini 2.5 Flash (Native Audio Preview Sep)</option>
                </optgroup>
                <optgroup label="MiniMax" data-provider="minimax">
                    <option value="abab6.5s-chat">MiniMax Realtime (abab6.5s-chat)</option>
                </optgroup>
                <optgroup label="Zhipu GLM" data-provider="glm">
                    <option value="glm-realtime-flash">GLM-Realtime Flash (9B, 推荐)</option>
                    <option value="glm-realtime-air">GLM-Realtime Air (32B)</option>
                </optgroup>
            </select></label>
            <label>Voice: <input type="text" id="voiceInput" placeholder="Gemini: Aoede / MiniMax: female-yujie / GLM: tongtong"></label>
            <label>Temperature: <input type="range" id="tempInput" min="0" max="2" step="0.1" value="0.8"> <span id="tempValue">0.8</span></label>
            <label>System Instructions: <textarea id="systemInput" rows="3">You are a helpful assistant.</textarea></label>
            <label>Access Token (optional): <input type="password" id="accessTokenInput" placeholder="Leave empty if not required"></label>
            <p class="hint">API keys are stored as Worker secrets. Set <code>GOOGLE_API_KEY</code>, <code>MINIMAX_API_KEY</code> and <code>ZHIPU_API_KEY</code> via <code>wrangler secret put</code>.</p>
            <button id="saveSettings" class="btn-primary">Save</button>
            <button id="closeSettings" class="btn-secondary">Close</button>
        </div>
    </div>
    <script src="/js/script.js"></script>
</body>
</html>`;

const cssFiles = {
  'css/styles.css': `* { margin: 0; padding: 0; box-sizing: border-box; }
:root {
    --bg-primary: #1a1a2e;
    --bg-secondary: #16213e;
    --bg-tertiary: #0f3460;
    --text-primary: #e8e8e8;
    --text-secondary: #a0a0a0;
    --accent: #e94560;
    --accent-hover: #ff6b6b;
    --success: #4ade80;
    --border: #2a2a4a;
}
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg-primary); color: var(--text-primary); min-height: 100vh; }
.app-container { max-width: 900px; margin: 0 auto; padding: 20px; display: flex; flex-direction: column; height: 100vh; }
.header { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
.header h1 { font-size: 1.5rem; background: linear-gradient(135deg, var(--accent), #ff8c00); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
.controls { display: flex; gap: 10px; }
.source-btn { display: flex; flex-direction: column; align-items: center; padding: 12px 20px; background: var(--bg-secondary); border: 2px solid var(--border); border-radius: 12px; cursor: pointer; transition: all 0.2s; }
.source-btn:hover { background: var(--bg-tertiary); }
.source-btn.active { border-color: var(--accent); background: rgba(233, 69, 96, 0.1); }
.source-btn .icon { font-size: 1.5rem; }
.source-btn .label { font-size: 0.75rem; margin-top: 4px; color: var(--text-secondary); }
.input-sources { display: flex; gap: 10px; margin: 15px 0; }
.chat-history { flex: 1; overflow-y: auto; padding: 15px; background: var(--bg-secondary); border-radius: 12px; margin-bottom: 15px; }
.message { padding: 12px 16px; border-radius: 12px; margin-bottom: 10px; max-width: 85%; animation: fadeIn 0.3s ease; }
.user-message { background: var(--bg-tertiary); margin-left: auto; }
.assistant-message { background: var(--accent); color: white; }
.system-message { background: #333; color: #ffd75e; text-align: center; font-size: 0.85rem; margin: 4px auto; }
.visualizer-container { position: fixed; bottom: 80px; right: 20px; width: 60px; height: 60px; }
.visualizer { width: 100%; height: 100%; border-radius: 50%; background: var(--bg-secondary); }
.camera-preview, .screen-preview { position: fixed; bottom: 100px; left: 20px; width: 200px; height: 150px; background: var(--bg-secondary); border-radius: 12px; border: 2px solid var(--border); display: none; overflow: hidden; }
.camera-preview video, .screen-preview video { width: 100%; height: 100%; object-fit: cover; }
.text-input-container { display: flex; gap: 10px; padding: 15px; background: var(--bg-secondary); border-radius: 12px; }
.text-input { flex: 1; padding: 12px 16px; background: var(--bg-primary); border: 2px solid var(--border); border-radius: 8px; color: var(--text-primary); font-size: 1rem; }
.text-input:focus { outline: none; border-color: var(--accent); }
.send-btn { padding: 12px 24px; background: var(--accent); border: none; border-radius: 8px; color: white; font-size: 1.2rem; cursor: pointer; transition: background 0.2s; }
.send-btn:hover { background: var(--accent-hover); }
button { cursor: pointer; font-family: inherit; }
.disconnect-btn, .connect-btn, .settings-btn { padding: 10px 20px; border: none; border-radius: 8px; font-weight: 600; transition: all 0.2s; }
.disconnect-btn { background: var(--accent); color: white; }
.connect-btn { background: var(--success); color: var(--bg-primary); }
.settings-btn { background: var(--bg-tertiary); color: var(--text-primary); font-size: 1.2rem; }
.modal { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.8); display: none; justify-content: center; align-items: center; z-index: 1000; }
.modal.active { display: flex; }
.modal-content { background: var(--bg-secondary); padding: 30px; border-radius: 16px; width: 90%; max-width: 500px; }
.modal-content h2 { margin-bottom: 20px; color: var(--accent); }
.modal-content label { display: block; margin-bottom: 15px; color: var(--text-secondary); }
.modal-content input, .modal-content select, .modal-content textarea { width: 100%; padding: 10px; margin-top: 5px; background: var(--bg-primary); border: 1px solid var(--border); border-radius: 8px; color: var(--text-primary); }
.modal-content textarea { resize: vertical; }
.modal-content .hint { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 15px; }
.btn-primary, .btn-secondary { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; margin-right: 10px; }
.btn-primary { background: var(--accent); color: white; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 600px) { .app-container { padding: 10px; } .header h1 { font-size: 1.2rem; } .source-btn { padding: 8px 12px; } .source-btn .icon { font-size: 1.2rem; } }`};

const jsFiles = {
  'js/script.js': `class RealtimeAgent {
  constructor() {
    this.ws = null;
    this.token = localStorage.getItem('accessToken') || '';
    this.provider = localStorage.getItem('provider') || 'gemini';
    this.sampleRate = this.getSampleRate();
    this.audioContext = null;
    this.analyser = null;
    this.scriptProcessor = null;
    this.recordingStream = null;
    this.isConnected = false;
    this.isRecording = false;
    this.isMicActive = localStorage.getItem('micEnabled') === 'true';
    this.isCameraActive = false;
    this.isScreenActive = false;
    this.cameraStream = null;
    this.screenStream = null;
  }

  getSampleRate() {
    return this.provider === 'minimax' ? 24000 : 16000;
  }

  wsPath() {
    const p = this.provider === 'minimax' ? '/ws/minimax' : this.provider === 'glm' ? '/ws/glm' : '/ws/gemini';
    return p + (this.token ? '?token=' + encodeURIComponent(this.token) : '');
  }

  connect() {
    const wsUrl = 'wss://' + location.host + this.wsPath();
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => { this.isConnected = true; this.sendSetup(); };
    this.ws.onmessage = (e) => this.handleMessage(e.data);
    this.ws.onclose = (e) => {
      this.isConnected = false;
      this.onDisconnect?.();
      if (e.code && e.code !== 1000 && e.code !== 1005 && e.code !== 1006) {
        this.onError?.('连接关闭 (' + e.code + ')：' + (e.reason || '未知原因'));
      }
    };
    this.ws.onerror = (e) => { console.error('WebSocket error:', e); this.onError?.('WebSocket 连接失败，请检查网络/控制台'); };
  }

  disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.stopRecording();
    this.stopCamera();
    this.stopScreen();
  }

  send(data) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data)); }

  floatTo16BitPCM(input) {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }
    return new Uint8Array(buffer);
  }

  toBase64(bytes) {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  }

  async startRecording() {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new AudioContext({ sampleRate: this.sampleRate });
      const source = this.audioContext.createMediaStreamSource(this.recordingStream);
      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);
      this.scriptProcessor = this.audioContext.createScriptProcessor(4096, 1, 1);
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.isRecording) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcm = this.floatTo16BitPCM(inputData);
        this.sendAudio(pcm);
      };
      source.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.audioContext.destination);
      this.isRecording = true;
    } catch (e) { console.error('Recording error:', e); }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.scriptProcessor) { this.scriptProcessor.disconnect(); this.scriptProcessor = null; }
    if (this.recordingStream) { this.recordingStream.getTracks().forEach(t => t.stop()); this.recordingStream = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
  }

  async startCamera() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = this.cameraStream;
      video.autoplay = true;
      const preview = document.getElementById('cameraPreview');
      preview.innerHTML = '';
      preview.appendChild(video);
      preview.style.display = 'block';
      this.isCameraActive = true;
      this.captureFrame();
    } catch (e) { console.error('Camera error:', e); }
  }

  stopCamera() {
    this.isCameraActive = false;
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; }
    document.getElementById('cameraPreview').style.display = 'none';
  }

  async startScreen() {
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = this.screenStream;
      video.autoplay = true;
      const preview = document.getElementById('screenPreview');
      preview.innerHTML = '';
      preview.appendChild(video);
      preview.style.display = 'block';
      this.isScreenActive = true;
      this.screenStream.getVideoTracks()[0].onended = () => this.stopScreen();
    } catch (e) { console.error('Screen share error:', e); }
  }

  stopScreen() {
    this.isScreenActive = false;
    if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
    document.getElementById('screenPreview').style.display = 'none';
  }

  captureFrame() {
    if (!this.isCameraActive || !this.cameraStream) return;
    const video = document.querySelector('#cameraPreview video');
    if (video && video.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 240;
      canvas.getContext('2d').drawImage(video, 0, 0, 320, 240);
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => { const base64 = reader.result.split(',')[1]; this.sendImage(base64); };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.5);
    }
    setTimeout(() => this.captureFrame(), this.frameIntervalMs || 5000);
  }
}

class GeminiAgent extends RealtimeAgent {
  constructor() {
    super();
    this.provider = 'gemini';
    this.sampleRate = 16000;
  }

  getConfig() {
    return {
      model: localStorage.getItem('model') || 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      generationConfig: {
        temperature: parseFloat(localStorage.getItem('temperature')) ?? 0.8,
        top_p: 0.95,
        top_k: 65,
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: localStorage.getItem('voice') || 'Aoede' } }
        }
      },
      systemInstruction: { parts: [{ text: localStorage.getItem('systemInstructions') || 'You are a helpful assistant.' }] },
      tools: { functionDeclarations: [] },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_CIVIC_INTEGRITY', threshold: 'BLOCK_NONE' }
      ]
    };
  }

  sendSetup() {
    this.send({ setup: this.getConfig() });
    if (this.isMicActive) this.startRecording();
  }

  sendText(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  sendAudio(pcmData) {
    const base64 = this.toBase64(pcmData);
    this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } });
  }

  sendImage(imageData) {
    this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: imageData }] } });
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.setupComplete) { this.isConnected = true; this.onConnect?.(); }
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) { this.onText?.(part.text); }
          if (part.inlineData?.data) {
            const binary = atob(part.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const rate = parseInt((part.inlineData.mimeType || '').match(/rate=(\\d+)/)?.[1] || '24000', 10);
            this.onAudio?.(bytes.buffer, rate);
          }
        }
      }
      if (msg.serverContent?.turnComplete) { this.onTurnComplete?.(); }
      if (msg.serverContent?.interrupted) { this.onInterrupted?.(); }
    } catch (e) { console.error('Parse error:', e); }
  }
}

class MiniMaxAgent extends RealtimeAgent {
  constructor() {
    super();
    this.provider = 'minimax';
    this.sampleRate = 24000;
  }

  sendSetup() {
    const voice = localStorage.getItem('voice') || 'female-yujie';
    const temperature = parseFloat(localStorage.getItem('temperature')) ?? 0.8;
    const instructions = localStorage.getItem('systemInstructions') || 'You are a helpful assistant.';
    this.send({
      type: 'session.update',
      session: {
        modalities: ['text', 'audio'],
        instructions,
        voice,
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm16',
        temperature,
      }
    });
    if (this.isMicActive) this.startRecording();
  }

  sendText(text) {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }
    });
    this.send({ type: 'response.create', response: { modalities: ['text', 'audio'] } });
  }

  sendAudio(pcmData) {
    this.send({ type: 'input_audio_buffer.append', audio: this.toBase64(pcmData) });
  }

  stopRecording() {
    super.stopRecording();
    if (this.isConnected) {
      this.send({ type: 'input_audio_buffer.commit' });
      this.send({ type: 'response.create', response: { modalities: ['text', 'audio'] } });
    }
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'session.created':
        case 'conversation.created':
          if (!this._booted) { this._booted = true; this.isConnected = true; this.onConnect?.(); }
          break;
        case 'response.text.delta':
          this.onText?.(msg.delta);
          break;
        case 'response.audio_transcript.delta':
          this.onText?.(msg.delta);
          break;
        case 'response.audio.delta':
          if (msg.delta) {
            const binary = atob(msg.delta);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            this.onAudio?.(bytes.buffer, 24000);
          }
          break;
        case 'conversation.item.input_audio_transcription.completed':
          if (msg.transcript) this.onUserTranscript?.(msg.transcript);
          break;
        case 'response.done':
          this.onTurnComplete?.();
          break;
        case 'error':
          console.error('MiniMax error:', msg);
          break;
      }
    } catch (e) { console.error('Parse error:', e); }
  }
}

class GLMAgent extends RealtimeAgent {
  constructor() {
    super();
    this.provider = 'glm';
    this.sampleRate = 16000;
    this.frameIntervalMs = 500;
  }

  get model() {
    return localStorage.getItem('model') || 'glm-realtime-flash';
  }

  buildSession(chatMode) {
    return {
      type: 'session.update',
      session: {
        model: this.model,
        modalities: ['text', 'audio'],
        voice: localStorage.getItem('voice') || 'tongtong',
        instructions: localStorage.getItem('systemInstructions') || 'You are a helpful assistant.',
        input_audio_format: 'pcm16',
        output_audio_format: 'pcm',
        temperature: parseFloat(localStorage.getItem('temperature')) ?? 0.8,
        turn_detection: { type: 'server_vad', create_response: true, interrupt_response: true },
        beta_fields: { chat_mode: chatMode, tts_source: 'e2e' },
      }
    };
  }

  sendSetup() {
    this.send(this.buildSession(this.isCameraActive ? 'video_passive' : 'audio'));
    if (this.isMicActive) this.startRecording();
  }

  setChatMode(mode) {
    this.send(this.buildSession(mode));
  }

  sendText(text) {
    this.send({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] }
    });
    this.send({ type: 'response.create' });
  }

  sendAudio(pcmData) {
    this.send({ type: 'input_audio_buffer.append', audio: this.toBase64(pcmData) });
  }

  sendImage(imageData) {
    this.send({ type: 'input_audio_buffer.append_video_frame', video_frame: imageData });
  }

  async startCamera() {
    await super.startCamera();
    if (this.isConnected) this.setChatMode('video_passive');
  }

  stopCamera() {
    super.stopCamera();
    if (this.isConnected) this.setChatMode('audio');
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      switch (msg.type) {
        case 'session.updated':
          if (!this._booted) { this._booted = true; this.isConnected = true; this.onConnect?.(); }
          break;
        case 'response.text.delta':
        case 'response.audio_transcript.delta':
          if (msg.delta) this.onText?.(msg.delta);
          break;
        case 'response.audio.delta':
          if (msg.delta) {
            const binary = atob(msg.delta);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            this.onAudio?.(bytes.buffer, 24000);
          }
          break;
        case 'conversation.item.input_audio_transcription.completed':
          if (msg.transcript) this.onUserTranscript?.(msg.transcript);
          break;
        case 'response.done':
          this.onTurnComplete?.();
          break;
        case 'error':
          console.error('GLM error:', msg);
          break;
      }
    } catch (e) { console.error('Parse error:', e); }
  }
}

class ChatUI {
  constructor() {
    this.agent = this.createAgent();
    this.setupEventListeners();
    this.audioCtx = null;
    this.gainNode = null;
    this.setupAudioPipeline();
  }

  createAgent() {
    const provider = localStorage.getItem('provider') || 'gemini';
    if (provider === 'minimax') return new MiniMaxAgent();
    if (provider === 'glm') return new GLMAgent();
    return new GeminiAgent();
  }

  setupEventListeners() {
    document.getElementById('connectBtn').onclick = () => this.agent.connect();
    document.getElementById('disconnectBtn').onclick = () => this.agent.disconnect();
    document.getElementById('micBtn').onclick = () => {
      if (!this.agent.isConnected) { this.addMessage('system', '请先点击 Connect 建立连接'); return; }
      const btn = document.getElementById('micBtn');
      if (this.agent.isMicActive) { btn.classList.remove('active'); this.agent.stopRecording(); } else { btn.classList.add('active'); this.agent.startRecording(); }
      this.agent.isMicActive = !this.agent.isMicActive;
      localStorage.setItem('micEnabled', this.agent.isMicActive);
    };
    document.getElementById('cameraBtn').onclick = () => {
      if (this.agent.provider === 'minimax') { alert('MiniMax Realtime 暂不支持视频输入'); return; }
      if (!this.agent.isConnected) { this.addMessage('system', '请先点击 Connect 建立连接'); return; }
      const btn = document.getElementById('cameraBtn');
      if (this.agent.isCameraActive) { btn.classList.remove('active'); this.agent.stopCamera(); } else { btn.classList.add('active'); this.agent.startCamera(); }
    };
    document.getElementById('screenBtn').onclick = () => {
      if (this.agent.provider === 'minimax') { alert('MiniMax Realtime 暂不支持屏幕共享'); return; }
      if (!this.agent.isConnected) { this.addMessage('system', '请先点击 Connect 建立连接'); return; }
      const btn = document.getElementById('screenBtn');
      if (this.agent.isScreenActive) { btn.classList.remove('active'); this.agent.stopScreen(); } else { btn.classList.add('active'); this.agent.startScreen(); }
    };
    document.getElementById('sendBtn').onclick = () => this.sendMessage();
    document.getElementById('messageInput').onkeypress = (e) => { if (e.key === 'Enter') this.sendMessage(); };
    document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('active');
    document.getElementById('closeSettings').onclick = () => document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('providerSelect').onchange = () => this.onProviderChange();
    document.getElementById('saveSettings').onclick = () => this.saveSettings();
    document.getElementById('tempInput').oninput = (e) => document.getElementById('tempValue').textContent = e.target.value;

    const provider = localStorage.getItem('provider') || 'gemini';
    document.getElementById('providerSelect').value = provider;
    this.onProviderChange();
    const modelDefaults = {
      minimax: 'abab6.5s-chat',
      glm: 'glm-realtime-flash',
      gemini: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
    };
    const voiceDefaults = { minimax: 'female-yujie', glm: 'tongtong', gemini: 'Aoede' };
    document.getElementById('modelSelect').value = localStorage.getItem('model') || modelDefaults[provider];
    document.getElementById('voiceInput').value = localStorage.getItem('voice') || voiceDefaults[provider];
    document.getElementById('tempInput').value = localStorage.getItem('temperature') || '0.8';
    document.getElementById('tempValue').textContent = localStorage.getItem('temperature') || '0.8';
    document.getElementById('systemInput').value = localStorage.getItem('systemInstructions') || 'You are a helpful assistant.';
    document.getElementById('accessTokenInput').value = localStorage.getItem('accessToken') || '';
    if (localStorage.getItem('micEnabled') === 'true') document.getElementById('micBtn').classList.add('active');

    this.agent.onConnect = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; };
    this.agent.onDisconnect = () => { document.getElementById('connectBtn').style.display = 'block'; document.getElementById('disconnectBtn').style.display = 'none'; };
    this.agent.onText = (text) => this.addMessage('assistant', text);
    this.agent.onTurnComplete = () => {};
    this.agent.onUserTranscript = (text) => this.addMessage('user', text);
    this.agent.onAudio = (buffer, sampleRate) => this.playPcm(buffer, sampleRate);
    this.agent.onError = (msg) => this.addMessage('system', msg);
  }

  onProviderChange() {
    const provider = document.getElementById('providerSelect').value;
    const groups = document.querySelectorAll('#modelSelect optgroup');
    groups.forEach(g => {
      g.style.display = g.dataset.provider === provider ? '' : 'none';
    });
    const group = Array.from(groups).find(g => g.dataset.provider === provider);
    const first = group?.querySelector('option');
    if (first) document.getElementById('modelSelect').value = first.value;
  }

  saveSettings() {
    const provider = document.getElementById('providerSelect').value;
    localStorage.setItem('provider', provider);
    localStorage.setItem('model', document.getElementById('modelSelect').value);
    localStorage.setItem('voice', document.getElementById('voiceInput').value);
    localStorage.setItem('temperature', document.getElementById('tempInput').value);
    localStorage.setItem('systemInstructions', document.getElementById('systemInput').value);
    localStorage.setItem('accessToken', document.getElementById('accessTokenInput').value);
    this.agent.disconnect();
    this.agent = this.createAgent();
    this.bindAgentCallbacks();
    document.getElementById('settingsModal').classList.remove('active');
  }

  bindAgentCallbacks() {
    this.agent.onConnect = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; };
    this.agent.onDisconnect = () => { document.getElementById('connectBtn').style.display = 'block'; document.getElementById('disconnectBtn').style.display = 'none'; };
    this.agent.onText = (text) => this.addMessage('assistant', text);
    this.agent.onTurnComplete = () => {};
    this.agent.onUserTranscript = (text) => this.addMessage('user', text);
    this.agent.onAudio = (buffer, sampleRate) => this.playPcm(buffer, sampleRate);
    this.agent.onError = (msg) => this.addMessage('system', msg);
  }

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (text && this.agent.isConnected) { this.addMessage('user', text); this.agent.sendText(text); input.value = ''; }
  }

  addMessage(role, content) {
    const chat = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = 'message ' + role + '-message';
    div.textContent = content;
    chat.appendChild(div);
    chat.scrollTop = chat.scrollHeight;
  }

  setupAudioPipeline() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.gain.value = 0.8;
  }

  playPcm(buffer, sampleRate) {
    this.audioQueue = this.audioQueue || [];
    this.audioQueue.push({ buffer, sampleRate });
    if (this.audioPlaying) return;
    this.audioPlaying = true;
    this.playNext();
  }

  playNext() {
    const item = this.audioQueue.shift();
    if (!item) { this.audioPlaying = false; return; }
    const ctx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const view = new DataView(item.buffer);
    const frameCount = view.byteLength / 2;
    const audioBuffer = ctx.createBuffer(1, frameCount, item.sampleRate || 24000);
    const data = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      data[i] = view.getInt16(i * 2, true) / 32768;
    }
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode || ctx.destination);
    source.onended = () => this.playNext();
    source.start();
  }
}

const ui = new ChatUI();`};