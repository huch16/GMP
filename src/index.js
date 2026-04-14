const ASSETS_MANIFEST = {};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      return handleWebSocket(request);
    }

    if (url.pathname.startsWith('/v1/')) {
      return handleAPIRequest(request);
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

async function handleWebSocket(request) {
  if (request.headers.get('Upgrade') !== 'websocket') {
    return new Response('Expected WebSocket', { status: 400 });
  }

  const url = new URL(request.url);
  const pathAndQuery = url.pathname + url.search;
  const targetUrl = `wss://generativelanguage.googleapis.com${pathAndQuery}`;

  const [client, proxy] = new WebSocketPair();
  proxy.accept();

  let pendingMessages = [];
  const targetWs = new WebSocket(targetUrl);

  targetWs.addEventListener('open', () => {
    for (const msg of pendingMessages) {
      targetWs.send(msg);
    }
    pendingMessages = [];
  });

  proxy.addEventListener('message', (event) => {
    if (targetWs.readyState === WebSocket.OPEN) {
      targetWs.send(event.data);
    } else {
      pendingMessages.push(event.data);
    }
  });

  targetWs.addEventListener('message', (event) => {
    if (proxy.readyState === WebSocket.OPEN) {
      proxy.send(event.data);
    }
  });

  targetWs.addEventListener('close', () => proxy.close());
  proxy.addEventListener('close', () => targetWs.close());

  return new Response(null, { status: 101, webSocket: client });
}

async function handleAPIRequest(request) {
  const auth = request.headers.get('Authorization');
  const apiKey = auth?.split(' ')[1];
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*',
        'Access-Control-Allow-Headers': '*',
      },
    });
  }

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
    <title>Gemini Multimodal Playground</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <div class="app-container">
        <div class="header">
            <h1>Gemini Multimodal Playground</h1>
            <div class="controls">
                <button id="settingsBtn" class="settings-btn">⚙️</button>
                <button id="disconnectBtn" class="disconnect-btn">Disconnect</button>
                <button id="connectBtn" class="connect-btn" style="display: none;">Connect</button>
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
            <label>API Key: <input type="password" id="apiKeyInput" placeholder="Enter your Gemini API Key"></label>
            <label>Model: <select id="modelSelect">
                <option value="models/gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash (Native Audio)</option>
                <option value="models/gemini-2.0-flash-exp">Gemini 2.0 Flash</option>
            </select></label>
            <label>Voice: <select id="voiceSelect">
                <option value="Aoede">Aoede (Female)</option>
                <option value="Puck">Puck (Male)</option>
                <option value="Charon">Charon (Male)</option>
                <option value="Fenrir">Fenrir (Male)</option>
                <option value="Kore">Kore (Female)</option>
                <option value="Leda">Leda (Female)</option>
                <option value="Orus">Orus (Male)</option>
                <option value="Zephyr">Zephyr (Male)</option>
            </select></label>
            <label>Temperature: <input type="range" id="tempInput" min="0" max="2" step="0.1" value="1.8"> <span id="tempValue">1.8</span></label>
            <label>System Instructions: <textarea id="systemInput" rows="3">You are a helpful assistant.</textarea></label>
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
.audio-indicator { display: flex; align-items: center; gap: 8px; }
.audio-bars { display: flex; gap: 2px; height: 20px; align-items: center; }
.audio-bar { width: 3px; background: white; border-radius: 2px; animation: audioWave 0.5s ease infinite; }
.audio-bar:nth-child(1) { height: 8px; animation-delay: 0s; }
.audio-bar:nth-child(2) { height: 16px; animation-delay: 0.1s; }
.audio-bar:nth-child(3) { height: 12px; animation-delay: 0.2s; }
.audio-bar:nth-child(4) { height: 18px; animation-delay: 0.3s; }
@keyframes audioWave { 0%, 100% { transform: scaleY(1); } 50% { transform: scaleY(0.5); } }
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
.btn-primary, .btn-secondary { padding: 12px 24px; border: none; border-radius: 8px; font-weight: 600; margin-right: 10px; }
.btn-primary { background: var(--accent); color: white; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
@media (max-width: 600px) { .app-container { padding: 10px; } .header h1 { font-size: 1.2rem; } .source-btn { padding: 8px 12px; } .source-btn .icon { font-size: 1.2rem; } }`};

const jsFiles = {
  'js/script.js': `class GeminiAgent {
  constructor() {
    this.ws = null;
    this.apiKey = localStorage.getItem('apiKey');
    this.config = this.getConfig();
    this.modelSampleRate = 27000;
    this.audioContext = null;
    this.analyser = null;
    this.isConnected = false;
    this.isRecording = false;
    this.mediaRecorder = null;
    this.audioChunks = [];
    this.recordingStream = null;
    this.isMicActive = localStorage.getItem('micEnabled') === 'true';
    this.isCameraActive = false;
    this.isScreenActive = false;
    this.cameraStream = null;
    this.screenStream = null;
  }

  getConfig() {
    return {
      model: localStorage.getItem('model') || 'models/gemini-2.5-flash-native-audio-preview-12-2025',
      generationConfig: {
        temperature: parseFloat(localStorage.getItem('temperature')) || 1.8,
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

  connect() {
    if (!this.apiKey) { alert('Please set your API Key in settings'); return; }
    const wsUrl = \`wss://\${location.host}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=\${this.apiKey}\`;
    this.ws = new WebSocket(wsUrl);
    this.ws.onopen = () => { this.isConnected = true; this.sendSetup(); };
    this.ws.onmessage = (e) => this.handleMessage(e.data);
    this.ws.onclose = () => { this.isConnected = false; this.onDisconnect?.(); };
    this.ws.onerror = (e) => console.error('WebSocket error:', e);
  }

  disconnect() {
    if (this.ws) { this.ws.close(); this.ws = null; }
    this.stopRecording();
    this.stopCamera();
    this.stopScreen();
  }

  sendSetup() {
    this.send({ setup: this.config });
    if (this.isMicActive) this.startRecording();
  }

  sendText(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  sendAudio(audioData) {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
    this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=16000', data: base64 }] } });
  }

  sendImage(imageData) {
    this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: imageData }] } });
  }

  send(data) { if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(data)); }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      if (msg.setupComplete) { this.onConnect?.(); }
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) { this.onText?.(part.text); }
          if (part.inlineData?.data) {
            const binary = atob(part.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            this.onAudio?.(bytes.buffer);
          }
        }
      }
      if (msg.serverContent?.turnComplete) { this.onTurnComplete?.(); }
      if (msg.serverContent?.interrupted) { this.onInterrupted?.(); }
    } catch (e) { console.error('Parse error:', e); }
  }

  async startRecording() {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.audioContext = new AudioContext({ sampleRate: 16000 });
      const source = this.audioContext.createMediaStreamSource(this.recordingStream);
      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);
      this.isRecording = true;
      this.captureAudio();
    } catch (e) { console.error('Recording error:', e); }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.recordingStream) { this.recordingStream.getTracks().forEach(t => t.stop()); this.recordingStream = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
  }

  captureAudio() {
    if (!this.isRecording || !this.analyser) return;
    const buffer = new Uint8Array(6400);
    const view = new DataView(buffer.buffer);
    for (let i = 0; i < buffer.length; i += 2) view.setInt16(i, Math.round((Math.random() * 2 - 1) * 1000), true);
    setTimeout(() => this.captureAudio(), 200);
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
    setTimeout(() => this.captureFrame(), 5000);
  }
}

class ChatUI {
  constructor() {
    this.agent = new GeminiAgent();
    this.setupEventListeners();
    this.audioQueue = [];
    this.isPlaying = false;
    this.setupAudioPipeline();
  }

  setupEventListeners() {
    document.getElementById('connectBtn').onclick = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; this.agent.connect(); };
    document.getElementById('disconnectBtn').onclick = () => { document.getElementById('disconnectBtn').style.display = 'none'; document.getElementById('connectBtn').style.display = 'block'; this.agent.disconnect(); };
    document.getElementById('micBtn').onclick = () => {
      const btn = document.getElementById('micBtn');
      if (this.agent.isMicActive) { btn.classList.remove('active'); this.agent.stopRecording(); } else { btn.classList.add('active'); if (this.agent.isConnected) this.agent.startRecording(); }
      this.agent.isMicActive = !this.agent.isMicActive;
      localStorage.setItem('micEnabled', this.agent.isMicActive);
    };
    document.getElementById('cameraBtn').onclick = () => { const btn = document.getElementById('cameraBtn'); if (this.agent.isCameraActive) { btn.classList.remove('active'); this.agent.stopCamera(); } else { btn.classList.add('active'); if (this.agent.isConnected) this.agent.startCamera(); } };
    document.getElementById('screenBtn').onclick = () => { const btn = document.getElementById('screenBtn'); if (this.agent.isScreenActive) { btn.classList.remove('active'); this.agent.stopScreen(); } else { btn.classList.add('active'); if (this.agent.isConnected) this.agent.startScreen(); } };
    document.getElementById('sendBtn').onclick = () => this.sendMessage();
    document.getElementById('messageInput').onkeypress = (e) => { if (e.key === 'Enter') this.sendMessage(); };
    document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('active');
    document.getElementById('closeSettings').onclick = () => document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('saveSettings').onclick = () => {
      localStorage.setItem('apiKey', document.getElementById('apiKeyInput').value);
      localStorage.setItem('model', document.getElementById('modelSelect').value);
      localStorage.setItem('voice', document.getElementById('voiceSelect').value);
      localStorage.setItem('temperature', document.getElementById('tempInput').value);
      localStorage.setItem('systemInstructions', document.getElementById('systemInput').value);
      this.agent.apiKey = localStorage.getItem('apiKey');
      this.agent.config = this.agent.getConfig();
      document.getElementById('settingsModal').classList.remove('active');
    };
    document.getElementById('tempInput').oninput = (e) => document.getElementById('tempValue').textContent = e.target.value;
    document.getElementById('apiKeyInput').value = localStorage.getItem('apiKey') || '';
    document.getElementById('modelSelect').value = localStorage.getItem('model') || 'models/gemini-2.5-flash-native-audio-preview-12-2025';
    document.getElementById('voiceSelect').value = localStorage.getItem('voice') || 'Aoede';
    document.getElementById('tempInput').value = localStorage.getItem('temperature') || '1.8';
    document.getElementById('tempValue').textContent = localStorage.getItem('temperature') || '1.8';
    document.getElementById('systemInput').value = localStorage.getItem('systemInstructions') || 'You are a helpful assistant.';
    if (localStorage.getItem('micEnabled') === 'true') document.getElementById('micBtn').classList.add('active');

    this.agent.onConnect = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; };
    this.agent.onDisconnect = () => { document.getElementById('connectBtn').style.display = 'block'; document.getElementById('disconnectBtn').style.display = 'none'; };
    this.agent.onText = (text) => this.addMessage('assistant', text);
    this.agent.onTurnComplete = () => this.addMessage('user', document.getElementById('messageInput').value);
    this.agent.onAudio = (buffer) => this.playAudio(buffer);
  }

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (text && this.agent.isConnected) { this.addMessage('user', text); this.agent.sendText(text); input.value = ''; }
  }

  addMessage(role, content) {
    const chat = document.getElementById('chatHistory');
    const div = document.createElement('div');
    div.className = \`message \${role}-message\`;
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

  playAudio(buffer) {
    const audioCtx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.decodeAudioData(buffer, (audioBuffer) => {
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
    });
  }
}

const ui = new ChatUI();`};
