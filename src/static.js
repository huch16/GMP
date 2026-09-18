const indexHTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <title>GMP - Realtime Playground</title>
    <link rel="stylesheet" href="/css/styles.css">
</head>
<body>
    <!-- Toast 通知容器 -->
    <div id="toastContainer" class="toast-container" aria-live="polite"></div>

    <div class="app-container">
        <!-- Top bar -->
        <header class="app-header">
            <h1 class="app-title">GMP Playground</h1>
            <button id="themeToggleBtn" class="theme-toggle" title="切换主题" aria-label="切换主题">
                <i class="fa-solid fa-circle-half-stroke"></i>
            </button>
            <div class="role-selector">
                <button id="roleBtn" class="role-btn">
                    <span id="roleAvatar">🤖</span>
                    <span id="roleName">通用助手</span>
                    <span class="caret">▾</span>
                </button>
                <button id="manageRolesBtn" class="role-manage-btn" title="管理角色">⚙️</button>
                <div id="roleMenu" class="role-menu hidden"></div>
            </div>
            <div class="connect-controls">
                <button id="connectBtn" class="connect-btn">Connect</button>
                <button id="disconnectBtn" class="disconnect-btn" style="display:none;">Disconnect</button>
            </div>
        </header>

        <!-- Chat area -->
        <main class="chat-area">
            <div id="chatHistory" class="chat-history"></div>
            <div class="visualizer-container">
                <canvas id="visualizer" class="visualizer"></canvas>
            </div>
            <div id="cameraPreview" class="camera-preview"></div>
            <div id="screenPreview" class="screen-preview"></div>
        </main>

        <!-- Input area -->
        <footer class="input-area">
            <input type="text" id="messageInput" placeholder="输入消息..." class="text-input">
            <button id="sendBtn" class="send-btn">➤</button>
        </footer>

        <!-- Bottom navigation -->
        <nav class="bottom-nav">
            <button id="micBtn" class="nav-btn" title="麦克风">
                <span class="icon">🎤</span>
                <span id="micStatus" class="mic-status">关</span>
            </button>
            <button id="cameraBtn" class="nav-btn" title="摄像头">
                <span class="icon">📷</span>
            </button>
            <button id="flipBtn" class="nav-btn" title="切换摄像头" style="display:none;">
                <span class="icon">🔄</span>
            </button>
            <button id="screenBtn" class="nav-btn" title="屏幕共享">
                <span class="icon">🖥️</span>
            </button>
            <button id="settingsBtn" class="nav-btn" title="设置">
                <span class="icon">⚙️</span>
            </button>
        </nav>
    </div>

    <!-- Settings modal -->
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
                <option value="models/gemini-3.8-live">Gemini 3.8 Live (默认)</option>
                <option value="models/gemini-3.1-flash-live-preview">Gemini 3.1 Flash Live (Preview)</option>
                <option value="models/gemini-2.5-flash-native-audio-preview-12-2025">Gemini 2.5 Flash (Native Audio Preview)</option>
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
            <button id="summarizeBtn" class="btn-secondary" style="margin-right:8px;">生成 AI 小结</button>
            <button id="clearMemoryBtn" class="btn-secondary" style="margin-right:8px;">清除对话记忆</button>
            <button id="saveSettings" class="btn-primary">Save</button>
            <button id="closeSettings" class="btn-secondary">Close</button>
        </div>
    </div>

    <!-- Role modal -->
    <div id="roleModal" class="modal">
        <div class="modal-content">
            <h2>角色管理</h2>
            <div id="roleList" class="role-list"></div>
            <button id="newRoleBtn" class="btn-primary">+ 新建角色</button>
            <div id="roleEdit" class="role-edit hidden">
                <label>名称: <input id="roleNameInput" type="text"></label>
                <label>头像 (emoji): <input id="roleAvatarInput" type="text" maxlength="2"></label>
                <label>描述: <textarea id="roleDescInput" rows="2"></textarea></label>
                <label>系统指令: <textarea id="rolePromptInput" rows="6"></textarea></label>
                <div class="role-edit-actions">
                    <button id="saveRoleBtn" class="btn-primary">保存</button>
                    <button id="deleteRoleBtn" class="btn-secondary">删除</button>
                    <button id="cancelRoleBtn" class="btn-secondary">取消</button>
                </div>
            </div>
            <button id="closeRoleModal" class="btn-secondary">关闭</button>
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
html, body { height: 100%; }
body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: var(--bg-primary);
    color: var(--text-primary);
    overflow: hidden;
}
.app-container {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh; /* 动态视口高度，避免软键盘遮挡底部导航 */
    max-width: 100%;
    margin: 0 auto;
    padding-bottom: env(safe-area-inset-bottom);
}
.app-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
}
.app-title {
    font-size: 1.1rem;
    background: linear-gradient(135deg, var(--accent), #ff8c00);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    flex: 1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.role-selector { display: flex; align-items: center; gap: 6px; margin-right: 8px; }
.role-btn {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    background: var(--bg-tertiary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
    font-size: 0.9rem;
    cursor: pointer;
}
.role-btn:hover { background: var(--accent); }
.role-btn .caret { font-size: 0.8rem; opacity: .8; }
.role-manage-btn { background: none; border: none; color: var(--text-primary); cursor: pointer; font-size: 1.1rem; }
.role-manage-btn:hover { color: var(--accent); }
.role-menu {
    position: absolute;
    top: 48px;
    right: 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 8px;
    width: 260px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 1500;
}
.role-menu.hidden { display: none; }
.role-menu-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; cursor: pointer; }
.role-menu-item:hover { background: var(--bg-tertiary); }
.role-menu-item .avatar { font-size: 1.2rem; }
.role-menu-item .meta { display: flex; flex-direction: column; }
.role-menu-item .meta .name { font-weight: 600; }
.role-menu-item .meta .desc { font-size: 0.75rem; color: var(--text-secondary); }

.connect-controls { display: flex; gap: 8px; }
.connect-btn, .disconnect-btn {
    padding: 6px 12px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
}
.connect-btn { background: var(--success); color: var(--bg-primary); }
.disconnect-btn { background: var(--accent); color: white; }

.chat-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
    padding-bottom: 64px; /* 为固定底部导航预留空间 */
}
.chat-history {
    flex: 1;
    overflow-y: auto;
    padding: 10px;
    background: var(--bg-primary);
}
.message {
    padding: 8px 12px;
    border-radius: 12px;
    margin-bottom: 8px;
    max-width: 85%;
    word-wrap: break-word;
    animation: fadeIn 0.3s ease;
}
.user-message { background: var(--bg-tertiary); margin-left: auto; }
.assistant-message { background: var(--accent); color: white; }
.system-message { background: #333; color: #ffd75e; text-align: center; font-size: 0.85rem; margin: 4px auto; }

.visualizer-container {
    position: absolute;
    bottom: 120px;
    right: 12px;
    width: 50px;
    height: 50px;
    pointer-events: none;
}
.visualizer {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--bg-secondary);
}
.camera-preview, .screen-preview {
    position: absolute;
    bottom: 120px;
    left: 12px;
    width: 140px;
    height: 90px;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 2px solid var(--border);
    display: none;
    overflow: hidden;
    pointer-events: none;
}
.camera-preview video, .screen-preview video { width: 100%; height: 100%; object-fit: cover; }

.input-area {
    display: flex;
    gap: 8px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
}
.text-input {
    flex: 1;
    padding: 8px 12px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 20px;
    color: var(--text-primary);
    font-size: 1rem;
    min-height: 44px;
    touch-action: manipulation;
}
.text-input:focus { outline: none; border-color: var(--accent); }
.send-btn {
    padding: 8px 12px;
    background: var(--accent);
    border: none;
    border-radius: 20px;
    color: white;
    font-size: 1.2rem;
    cursor: pointer;
    min-height: 44px;
    min-width: 44px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
}
.send-btn:hover { background: var(--accent-hover); }

.bottom-nav {
    display: flex;
    justify-content: space-around;
    padding: 8px 0;
    padding-bottom: calc(8px + env(safe-area-inset-bottom));
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    flex-shrink: 0;
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1000;
    touch-action: manipulation;
}
.nav-btn {
    flex: 1;
    background: none;
    color: var(--text-primary);
    font-size: 1.4rem;
    padding: 6px;
    border: none;
    cursor: pointer;
    min-height: 48px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
    user-select: none;
    pointer-events: auto;
}
.nav-btn:hover { color: var(--accent); }
.nav-btn.active { color: var(--accent); }

/* Mic status text */
.mic-status {
    font-size: 0.7rem;
    margin-left: 4px;
    color: var(--text-secondary);
}
.nav-btn.active .mic-status {
    color: var(--accent);
    font-weight: bold;
}

.modal {
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0,0,0,0.8);
    display: none;
    justify-content: center;
    align-items: center;
    z-index: 2000;
}
.modal.active { display: flex; }
.modal-content {
    background: var(--bg-secondary);
    padding: 20px;
    border-radius: 12px;
    width: 90%;
    max-width: 500px;
    max-height: 80vh;
    overflow-y: auto;
}
.modal-content h2 { margin-bottom: 16px; color: var(--accent); }
.modal-content label { display: block; margin-bottom: 12px; color: var(--text-secondary); }
.modal-content input, .modal-content select, .modal-content textarea {
    width: 100%;
    padding: 8px;
    margin-top: 4px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 8px;
    color: var(--text-primary);
}
.modal-content textarea { resize: vertical; }
.modal-content .hint { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 12px; }
.btn-primary, .btn-secondary {
    padding: 8px 16px;
    border: none;
    border-radius: 8px;
    font-weight: 600;
    margin-right: 8px;
    cursor: pointer;
}
.btn-primary { background: var(--accent); color: white; }
.btn-secondary { background: var(--bg-tertiary); color: var(--text-primary); }

.role-list { max-height: 200px; overflow-y: auto; margin-bottom: 12px; }
.role-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
}
.role-list-item:hover { background: var(--bg-tertiary); }
.role-list-item.active { background: var(--accent); color: white; }
.role-edit { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
.role-edit.hidden { display: none; }
.role-edit label { display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary); }
.role-edit input, .role-edit textarea {
    width: 100%;
    padding: 6px;
    background: var(--bg-primary);
    border: 1px solid var(--border);
    border-radius: 6px;
    color: var(--text-primary);
}
.role-edit-actions { display: flex; gap: 8px; margin-top: 8px; }

@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

@media (max-width: 480px) {
    .app-title { font-size: 1rem; }
    .role-btn { padding: 4px 6px; font-size: 0.85rem; }
    .visualizer-container { width: 40px; height: 40px; bottom: 110px; right: 8px; }
    .camera-preview, .screen-preview { width: 120px; height: 80px; bottom: 110px; left: 8px; }
    .nav-btn { font-size: 1.2rem; }
}

/* ===== Toast 通知 ===== */
.toast-container {
    position: fixed;
    top: 16px;
    right: 16px;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    gap: 8px;
    pointer-events: none;
    max-width: calc(100vw - 32px);
}
.toast {
    background: var(--bg-tertiary);
    color: var(--text-primary);
    padding: 10px 16px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    pointer-events: auto;
    font-size: 0.9rem;
    line-height: 1.4;
    animation: toastSlide 0.25s ease;
    border-left: 4px solid var(--accent);
    word-break: break-word;
}
.toast.error   { border-left-color: #ef4444; }
.toast.success { border-left-color: #4ade80; }
.toast.info    { border-left-color: #0ea5e9; }
.toast.fadeout { opacity: 0; transform: translateX(120%); transition: all 0.3s ease; }
@keyframes toastSlide {
    from { transform: translateX(120%); opacity: 0; }
    to   { transform: translateX(0); opacity: 1; }
}

/* ===== Theme toggle & 亮色主题 ===== */
.theme-toggle {
    background: none;
    border: none;
    color: var(--text-primary);
    cursor: pointer;
    font-size: 1.1rem;
    padding: 4px 8px;
    border-radius: 6px;
    margin-right: 4px;
    touch-action: manipulation;
    -webkit-tap-highlight-color: transparent;
}
.theme-toggle:hover { background: var(--bg-tertiary); }
html.light {
    --bg-primary: #ffffff;
    --bg-secondary: #f3f4f6;
    --bg-tertiary: #e5e7eb;
    --text-primary: #111827;
    --text-secondary: #6b7280;
    --border: #d1d5db;
}
html.light body { background: #ffffff; color: #111827; }

/* ===== 消息增强：时间戳 + 复制按钮 ===== */
.message {
    position: relative;
    padding: 8px 32px 22px 12px;
}
.message .timestamp {
    position: absolute;
    bottom: 4px;
    right: 8px;
    font-size: 0.65rem;
    opacity: 0.55;
}
.message .copy-btn {
    position: absolute;
    top: 4px;
    right: 4px;
    background: none;
    border: none;
    color: inherit;
    opacity: 0;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 2px 6px;
    border-radius: 4px;
    transition: opacity .2s;
}
.message:hover .copy-btn { opacity: 0.7; }
.message .copy-btn:hover { opacity: 1; background: rgba(127,127,127,0.15); }
.message.system .copy-btn,
.message.system .timestamp { display: none; }
`};

const jsFiles = {
  'js/script.js': `/* ---------- Toast 通知 ---------- */
function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => {
    t.classList.add('fadeout');
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/* ---------- 主题切换 ---------- */
function applyTheme(theme) {
  const html = document.documentElement;
  html.classList.toggle('light', theme === 'light');
  html.classList.toggle('dark', theme !== 'light');
  localStorage.setItem('theme', theme);
}
applyTheme(localStorage.getItem('theme') || 'dark');

/* ---------- 记忆功能（AI 小结） ---------- */
function loadMemory() {
  try { return JSON.parse(localStorage.getItem('gmp_memory') || '[]'); } catch(e) { return []; }
}
function loadSummary() {
  try { return JSON.parse(localStorage.getItem('gmp_memory_summary') || 'null'); } catch(e) { return null; }
}
function saveMemory(role, content) {
  const mem = loadMemory();
  mem.push({ role, content, ts: Date.now() });
  while (mem.length > 20) mem.shift();
  localStorage.setItem('gmp_memory', JSON.stringify(mem));
  // 当未压缩的原始记忆超过 10 条时自动请求 AI 小结
  if (mem.length > 10 && !window.__summarizing) summarizeMemory(true);
  updateSystemInstructionsWithMemory();
}
function clearMemory() {
  localStorage.removeItem('gmp_memory');
  localStorage.removeItem('gmp_memory_summary');
  const base = localStorage.getItem('systemInstructions') || '你是一个乐于助人的助手。';
  localStorage.setItem('systemInstructions', base);
  const sysInput = document.getElementById('systemInput');
  if (sysInput) sysInput.value = base;
}
function updateSystemInstructionsWithMemory() {
  const mem = loadMemory();
  const summary = loadSummary();
  if (!summary && mem.length === 0) return;
  const base = localStorage.getItem('systemInstructions') || '你是一个乐于助人的助手。';
  const parts = [base];
  if (summary && summary.text) {
    parts.push('【对话小结】');
    parts.push(summary.text);
  }
  if (mem.length > 0) {
    parts.push('【最近对话】');
    const tail = mem.slice(-6);
    parts.push(tail.map(m => (m.role === 'user' ? '用户' : '助手') + ': ' + m.content).join(String.fromCharCode(10)));
  }
  const combined = parts.join(String.fromCharCode(10));
  localStorage.setItem('systemInstructions', combined);
  const sysInput = document.getElementById('systemInput');
  if (sysInput) sysInput.value = combined;
}
async function summarizeMemory(auto = false) {
  if (window.__summarizing) return;
  const mem = loadMemory();
  if (mem.length === 0) return;
  window.__summarizing = true;
  try {
    const resp = await fetch('/api/ai/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: mem }),
    });
    if (!resp.ok) throw new Error('Summarize API ' + resp.status);
    const data = await resp.json();
    if (data.summary) {
      localStorage.setItem('gmp_memory_summary', JSON.stringify({
        text: data.summary,
        updatedAt: Date.now(),
        fromCount: mem.length,
      }));
      // 压缩后可以保留最近 5 条以防失真
      const tail = mem.slice(-5);
      localStorage.setItem('gmp_memory', JSON.stringify(tail));
      updateSystemInstructionsWithMemory();
      if (!auto) ui && ui.addMessage('system', '已生成 AI 小结');
    }
  } catch (e) {
    if (!auto) ui && ui.addMessage('system', '小结生成失败：' + e.message);
  } finally {
    window.__summarizing = false;
  }
}

class RealtimeAgent {
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
    this.isMicActive = false;
    this.isCameraActive = false;
    this.isScreenActive = false;
    this.cameraStream = null;
    this.screenStream = null;
    this.cameraFacing = 'user';
    this.frameIntervalMs = 1000;
  }

  getSampleRate() {
    return this.provider === 'minimax' ? 24000 : 16000;
  }

  getTemperature() {
    const v = parseFloat(localStorage.getItem('temperature'));
    return Number.isFinite(v) ? v : 0.8;
  }

  wsPath() {
    const p = this.provider === 'minimax' ? '/ws/minimax' : this.provider === 'glm' ? '/ws/glm' : '/ws/gemini';
    return p + (this.token ? '?token=' + encodeURIComponent(this.token) : '');
  }

  connect() {
    const wsUrl = 'wss://' + location.host + this.wsPath();
    this.ws = new WebSocket(wsUrl);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = () => { this.isConnected = true; this.sendSetup(); };
    this.ws.onmessage = async (e) => {
      let data = e.data;
      try {
        if (typeof Blob !== 'undefined' && data instanceof Blob) data = await data.text();
        else if (typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) data = new TextDecoder().decode(data);
      } catch (err) {}
      this.handleMessage(data);
    };
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
    this.pcmBuffer = [];
    this.audioPlaying = false;
    if (this.playPendingTimer) { clearTimeout(this.playPendingTimer); this.playPendingTimer = null; }
  }

  send(data) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (data instanceof ArrayBuffer) {
      this.ws.send(data);
    } else {
      this.ws.send(JSON.stringify(data));
    }
  }

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
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  trackVoiceActivity(inputData) {
    const now = performance.now();
    let sum = 0;
    for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
    const rms = Math.sqrt(sum / inputData.length);
    const voiceActive = rms > 0.008;
    if (this.modelSpeaking) {
      if (voiceActive) this.vadLastVoice = now;
      return;
    }
    if (voiceActive) {
      this.vadLastVoice = now;
      if (!this.activityOpen) {
        this.activityOpen = true;
        this.send({ realtimeInput: { activityStart: {} } });
      }
      return;
    }
    if (this.activityOpen && this.vadLastVoice && now - this.vadLastVoice > 700) {
      this.activityOpen = false;
      this.vadLastVoice = null;
      this.send({ realtimeInput: { activityEnd: {} } });
    }
  }

  async startRecording() {
    try {
      this.recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      // 使用 AudioWorklet（低延迟、离主线程），并在 worklet 中完成重采样+Int16 转换。
      const workletCode = [
        'class PCMProcessor extends AudioWorkletProcessor {',
        '  constructor() {',
        '    super();',
        '    this._buffer = [];',
        '    this._needed = 1024;',
        '    this._sourceRate = sampleRate;',
        '    this._targetRate = ' + this.sampleRate + ';',
        '    this._ratio = this._sourceRate / this._targetRate;',
        '    this._carry = 0;',
        '  }',
        '  process(inputs) {',
        '    const input = inputs[0][0];',
        '    if (!input) return true;',
        '    for (let i = 0; i < input.length; i++) {',
        '      this._carry += this._ratio;',
        '      while (this._carry >= 1) {',
        '        this._buffer.push(input[i] || 0);',
        '        this._carry -= 1;',
        '        if (this._buffer.length >= this._needed) this._flush();',
        '      }',
        '    }',
        '    return true;',
        '  }',
        '  _flush() {',
        '    const len = this._buffer.length;',
        '    const buf = new ArrayBuffer(len * 2);',
        '    const view = new DataView(buf);',
        '    for (let i = 0; i < len; i++) {',
        '      let s = Math.max(-1, Math.min(1, this._buffer[i]));',
        '      view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);',
        '    }',
        '    this.port.postMessage(new Uint8Array(buf), [buf]);',
        '    this._buffer = [];',
        '  }',
        '}',
        "registerProcessor('pcm-processor', PCMProcessor);"
      ].join(String.fromCharCode(10));
      const blob = new Blob([workletCode], { type: 'application/javascript' });
      const workletUrl = URL.createObjectURL(blob);

      try {
        this.audioContext = new AudioContext({ sampleRate: this.sampleRate, latencyHint: 'interactive' });
      } catch (e) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
      }
      try { if (this.audioContext.state === 'suspended') this.audioContext.resume(); } catch (e) {}

      await this.audioContext.audioWorklet.addModule(workletUrl);
      const source = this.audioContext.createMediaStreamSource(this.recordingStream);
      this.analyser = this.audioContext.createAnalyser();
      source.connect(this.analyser);

      this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
      this.audioWorkletNode.port.onmessage = (e) => {
        if (!this.isRecording) return;
        const pcm = e.data; // Uint8Array (Int16 LE)
        // VAD 需要原始 Float32；这里简化：使用 analyser 的 RMS
        const rms = this._lastRms || 0;
        this._handleVad(rms);
        this.sendAudio(pcm);
      };
      // 通过 AnalyserNode 实时获取 RMS 用于 VAD
      const buf = new Float32Array(this.analyser.fftSize);
      const tickVad = () => {
        if (!this.isRecording) return;
        this.analyser.getFloatTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
        this._lastRms = Math.sqrt(sum / buf.length);
        requestAnimationFrame(tickVad);
      };
      tickVad();

      source.connect(this.audioWorkletNode);
      this.audioWorkletNode.connect(this.audioContext.destination);

      this.vadLastVoice = null;
      this.vadPending = false;
      this.activityOpen = false;
      this.modelSpeaking = false;
      this.isRecording = true;
      return true;
    } catch (e) {
      console.error('Recording error:', e);
      this.onError?.('麦克风启动失败：' + (e.name || e.message || '请检查权限或设备'));
      this.isMicActive = false;
      document.getElementById('micBtn').classList.remove('active');
      localStorage.setItem('micEnabled', 'false');
      return false;
    }
  }

  _handleVad(rms) {
    const now = performance.now();
    const voiceActive = rms > 0.008;
    if (this.modelSpeaking) {
      if (voiceActive) this.vadLastVoice = now;
      return;
    }
    if (voiceActive) {
      this.vadLastVoice = now;
      if (!this.activityOpen) {
        this.activityOpen = true;
        this.send({ realtimeInput: { activityStart: {} } });
      }
      return;
    }
    if (this.activityOpen && this.vadLastVoice && now - this.vadLastVoice > 700) {
      this.activityOpen = false;
      this.vadLastVoice = null;
      this.send({ realtimeInput: { activityEnd: {} } });
    }
  }

  stopRecording() {
    this.isRecording = false;
    if (this.activityOpen) {
      this.activityOpen = false;
      this.send({ realtimeInput: { activityEnd: {} } });
    }
    if (this.audioWorkletNode) { this.audioWorkletNode.disconnect(); this.audioWorkletNode = null; }
    if (this.recordingStream) { this.recordingStream.getTracks().forEach(t => t.stop()); this.recordingStream = null; }
    if (this.audioContext) { this.audioContext.close(); this.audioContext = null; }
  }

  async startCamera() {
    try {
      this.cameraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: this.cameraFacing } });
      const video = document.createElement('video');
      video.srcObject = this.cameraStream;
      video.autoplay = true;
      video.muted = true;
      const preview = document.getElementById('cameraPreview');
      preview.innerHTML = '';
      preview.appendChild(video);
      preview.style.display = 'block';
      this.isCameraActive = true;
      this.captureFrame();
    } catch (e) {
      console.error('Camera error:', e);
      this.onError?.('摄像头启动失败：' + (e.name || e.message || '请检查权限或设备'));
      this.isCameraActive = false;
      document.getElementById('cameraBtn').classList.remove('active');
    }
  }

  stopCamera() {
    this.isCameraActive = false;
    if (this.cameraStream) { this.cameraStream.getTracks().forEach(t => t.stop()); this.cameraStream = null; }
    const flip = document.getElementById('flipBtn');
    if (flip) flip.style.display = 'none';
    document.getElementById('cameraPreview').style.display = 'none';
  }

  async switchCamera() {
    if (!this.isCameraActive || !this.cameraStream) return;
    const prev = this.cameraFacing;
    this.stopCamera();
    this.cameraFacing = prev === 'user' ? 'environment' : 'user';
    await this.startCamera();
    if (!this.isCameraActive) this.cameraFacing = prev;
  }

  async startScreen() {
    // 能力检测：移动端多数浏览器不支持 getDisplayMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
      this.onError?.('当前浏览器不支持屏幕共享，请使用桌面版 Chrome / Edge / Firefox。');
      const btn = document.getElementById('screenBtn');
      if (btn) btn.classList.remove('active');
      this.isScreenActive = false;
      return;
    }
    try {
      this.screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const video = document.createElement('video');
      video.srcObject = this.screenStream;
      video.autoplay = true;
      video.muted = true;
      const preview = document.getElementById('screenPreview');
      preview.innerHTML = '';
      preview.appendChild(video);
      preview.style.display = 'block';
      video.play().catch(() => {});
      this.isScreenActive = true;
      this.screenStream.getVideoTracks()[0].onended = () => this.stopScreen();
      this.captureFrame();
    } catch (e) {
      console.error('Screen share error:', e);
      this.onError?.('屏幕共享启动失败：' + (e.name || e.message || '请重试'));
      this.isScreenActive = false;
      const btn = document.getElementById('screenBtn');
      if (btn) btn.classList.remove('active');
    }
  }

  stopScreen() {
    this.isScreenActive = false;
    if (this.screenStream) { this.screenStream.getTracks().forEach(t => t.stop()); this.screenStream = null; }
    document.getElementById('screenPreview').style.display = 'none';
  }

  captureFrame() {
    const camOn = this.isCameraActive && this.cameraStream;
    const scrOn = this.isScreenActive && this.screenStream;
    if (camOn) this.sendVideoFrame('#cameraPreview video');
    if (scrOn) this.sendVideoFrame('#screenPreview video');
    if (!camOn && !scrOn) return;
    setTimeout(() => this.captureFrame(), this.frameIntervalMs || 1000);
  }

  sendVideoFrame(selector) {
    const video = document.querySelector(selector);
    if (!video || video.readyState < 2) return;
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640; canvas.height = 360;
      canvas.getContext('2d').drawImage(video, 0, 0, 640, 360);
      canvas.toBlob((blob) => {
        if (blob) {
          const reader = new FileReader();
          reader.onloadend = () => { const base64 = reader.result.split(',')[1]; this.sendImage(base64); };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.7);
    } catch (e) {}
  }
}

class GeminiAgent extends RealtimeAgent {
  constructor() {
    super();
    this.provider = 'gemini';
    this.sampleRate = 16000;
  }
  getDefaultModel() {
    return 'models/gemini-3.8-live';
  }
  get fallbackModel() {
    return 'models/gemini-2.5-flash-native-audio-preview-12-2025';
  }

  getConfig() {
    return {
      model: localStorage.getItem('model') || 'models/gemini-3.8-live',
      generationConfig: {
        temperature: this.getTemperature(),
        top_p: 0.95,
        top_k: 65,
        responseModalities: ['AUDIO', 'TEXT'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: localStorage.getItem('voice') || 'Aoede' } }
        }
      },
      systemInstruction: { parts: [{ text: localStorage.getItem('systemInstructions') || 'You are a helpful assistant.' }] },
      realtimeInputConfig: {
        automaticActivityDetection: {
          disabled: true,
        },
        turnCoverage: 'TURN_INCLUDES_ALL_INPUT',
      },
      tools: { functionDeclarations: [] },
    };
  }

  sendSetup() {
    this.send({ setup: this.getConfig() });
    if (this.isMicActive) this.startRecording();
  }

  sendText(text) {
    this.send({ clientContent: { turns: [{ role: 'user', parts: [{ text }] }], turnComplete: true } });
  }

  async sendAudio(pcmData) {
    const base64 = this.toBase64(pcmData);
    const payload = JSON.stringify({
      realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=' + this.sampleRate, data: base64 }] },
    });
    try {
      // 使用浏览器原生 CompressionStream (gzip) 压缩，再以二进制发送
      const compressed = await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      // 第一个字节为 0x01 标记为压缩音频，后接 gzip 数据
      const marker = new Uint8Array([0x01]);
      const merged = new Uint8Array(1 + compressed.byteLength);
      merged.set(marker, 0);
      merged.set(new Uint8Array(compressed), 1);
      this.ws && this.ws.readyState === WebSocket.OPEN && this.ws.send(merged.buffer);
    } catch (e) {
      // 压缩失败则回退到原始 JSON
      this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'audio/pcm;rate=' + this.sampleRate, data: base64 }] } });
    }
  }

  sendImage(imageData) {
    this.send({ realtimeInput: { mediaChunks: [{ mimeType: 'image/jpeg', data: imageData }] } });
  }

  handleMessage(data) {
    try {
      const msg = JSON.parse(data);
      // 上游错误（如模型不可用、配额超限）弹 Toast 并返回
      if (msg.error) {
        const errMsg = (msg.error.message || msg.error.code || JSON.stringify(msg.error));
        console.error('[Gemini] upstream error:', errMsg);
        this.onError?.('模型错误：' + errMsg);
        return;
      }
      if (msg.setupComplete) { this.isConnected = true; this.onConnect?.(); }
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.text) { this.onText?.(part.text); }
          if (part.inlineData?.data) {
            this.modelSpeaking = true;
            const binary = atob(part.inlineData.data);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            const rate = parseInt((part.inlineData.mimeType || '').match(/rate=(\\d+)/)?.[1] || '24000', 10);
            this.onAudio?.(bytes.buffer, rate);
          }
        }
      }
      if (msg.serverContent?.turnComplete) {
        setTimeout(() => { this.modelSpeaking = false; this.vadLastVoice = null; }, 600);
        this.onTurnComplete?.();
      }
      if (msg.serverContent?.interrupted) {
        this.modelSpeaking = false;
        this.onInterrupted?.();
      }
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
    const temperature = this.getTemperature();
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
        temperature: this.getTemperature(),
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
    this.agent.isMicActive = false;
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
    document.getElementById('connectBtn').onclick = async () => {
      const btn = document.getElementById('connectBtn');
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 检测中';
      try {
        // 1️⃣ 探测当前所选模型是否可用
        const wanted = this.agent.getSelectedModel ? this.agent.getSelectedModel() : null;
        const ok = wanted ? await this.probeModel(wanted) : true;
        if (!ok) {
          // 2️⃣ 不可用 → 降级到默认 fallback
          const fallback = this.agent.fallbackModel || 'models/gemini-2.5-flash-native-audio-preview-12-2025';
          showToast('当前模型不可用，已降级到 ' + fallback, 'info', 3000);
          this.setModel(fallback);
          // 重新创建 agent 以加载新模型
          this.agent.disconnect();
          this.agent = this.createAgent();
          this.bindAgentCallbacks();
        }
        await this.agent.connect();
        showToast('已连接 ' + (localStorage.getItem('model') || ''), 'success', 1500);
      } catch (e) {
        showToast('连接失败：' + (e.message || e), 'error', 4000);
      } finally {
        btn.disabled = false;
        btn.innerHTML = orig;
      }
    };
    document.getElementById('disconnectBtn').onclick = () => this.agent.disconnect();
    document.getElementById('micBtn').onclick = async () => {
      const btn = document.getElementById('micBtn');
      if (this.agent.isConnected) {
        if (this.agent.isMicActive) {
          this.agent.stopRecording();
          this.agent.isMicActive = false;
          btn.classList.remove('active');
        } else {
          const ok = await this.agent.startRecording();
          if (!ok) return;
          this.agent.isMicActive = true;
          btn.classList.add('active');
        }
      } else {
        this.agent.isMicActive = !this.agent.isMicActive;
        btn.classList.toggle('active', this.agent.isMicActive);
        this.addMessage('system', '麦克风已' + (this.agent.isMicActive ? '开启' : '关闭') + '（连接后生效）');
      }
    };
    document.getElementById('cameraBtn').onclick = async () => {
      if (this.agent.provider === 'minimax') { alert('MiniMax Realtime 暂不支持视频输入'); return; }
      if (!this.agent.isConnected) { this.addMessage('system', '请先点击 Connect 建立连接'); return; }
      const btn = document.getElementById('cameraBtn');
      const flip = document.getElementById('flipBtn');
      if (this.agent.isCameraActive) { btn.classList.remove('active'); flip.style.display = 'none'; this.agent.stopCamera(); }
      else {
        btn.classList.add('active');
        await this.agent.startCamera();
        flip.style.display = this.agent.isCameraActive ? 'inline-flex' : 'none';
        if (!this.agent.isCameraActive) btn.classList.remove('active');
      }
    };
    document.getElementById('flipBtn').onclick = async () => {
      const flip = document.getElementById('flipBtn');
      flip.style.opacity = '0.5';
      await this.agent.switchCamera();
      flip.style.opacity = '1';
    };
    document.getElementById('screenBtn').onclick = () => {
      console.log('[GMP] screenBtn clicked, provider=', this.agent.provider, 'connected=', this.agent.isConnected);
      if (this.agent.provider === 'minimax') { alert('MiniMax Realtime 暂不支持屏幕共享'); return; }
      if (!this.agent.isConnected) { this.addMessage('system', '请先点击 Connect 建立连接'); return; }
      const btn = document.getElementById('screenBtn');
      if (this.agent.isScreenActive) { btn.classList.remove('active'); this.agent.stopScreen(); } else { btn.classList.add('active'); this.agent.startScreen(); }
    };
    document.getElementById('sendBtn').onclick = () => this.sendMessage();
    document.getElementById('messageInput').onkeydown = (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    };
    document.getElementById('settingsBtn').onclick = () => document.getElementById('settingsModal').classList.add('active');
    document.getElementById('closeSettings').onclick = () => document.getElementById('settingsModal').classList.remove('active');
    document.getElementById('providerSelect').onchange = () => this.onProviderChange();
    document.getElementById('saveSettings').onclick = () => this.saveSettings();
    document.getElementById('tempInput').oninput = (e) => document.getElementById('tempValue').textContent = e.target.value;
    document.getElementById('clearMemoryBtn').onclick = () => { clearMemory(); showToast('已清除对话记忆', 'success'); };
    document.getElementById('summarizeBtn').onclick = async () => {
      const btn = document.getElementById('summarizeBtn');
      const orig = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 生成中';
      await summarizeMemory(false);
      btn.disabled = false;
      btn.innerHTML = orig;
    };
    document.getElementById('themeToggleBtn').onclick = () => {
      const cur = localStorage.getItem('theme') || 'dark';
      applyTheme(cur === 'dark' ? 'light' : 'dark');
    };

    const provider = localStorage.getItem('provider') || 'gemini';
    document.getElementById('providerSelect').value = provider;
    this.onProviderChange();
    const modelDefaults = {
      minimax: 'abab6.5s-chat',
      glm: 'glm-realtime-flash',
      gemini: 'models/gemini-3.8-live',
    };
    const voiceDefaults = { minimax: 'female-yujie', glm: 'tongtong', gemini: 'Aoede' };
    document.getElementById('modelSelect').value = localStorage.getItem('model') || modelDefaults[provider];
    document.getElementById('voiceInput').value = localStorage.getItem('voice') || voiceDefaults[provider];
    document.getElementById('tempInput').value = localStorage.getItem('temperature') || '0.8';
    document.getElementById('tempValue').textContent = localStorage.getItem('temperature') || '0.8';
    document.getElementById('systemInput').value = localStorage.getItem('systemInstructions') || '你是一个乐于助人的助手。';
    document.getElementById('accessTokenInput').value = localStorage.getItem('accessToken') || '';

    this.agent.onConnect = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; };
    this.agent.onDisconnect = () => { document.getElementById('connectBtn').style.display = 'block'; document.getElementById('disconnectBtn').style.display = 'none'; };
    this.agent.onText = (text) => { this.addMessage('assistant', text); saveMemory('assistant', text); };
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
    if (window.roleManager) window.roleManager.updateCurrentSystemPrompt(document.getElementById('systemInput').value);
    localStorage.setItem('accessToken', document.getElementById('accessTokenInput').value);
    this.agent.disconnect();
    this.agent = this.createAgent();
    this.bindAgentCallbacks();
    document.getElementById('settingsModal').classList.remove('active');
  }

  bindAgentCallbacks() {
    this.agent.onConnect = () => { document.getElementById('connectBtn').style.display = 'none'; document.getElementById('disconnectBtn').style.display = 'block'; };
    this.agent.onDisconnect = () => { document.getElementById('connectBtn').style.display = 'block'; document.getElementById('disconnectBtn').style.display = 'none'; };
    this.agent.onText = (text) => { this.addMessage('assistant', text); saveMemory('assistant', text); };
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
    if (!this._pendingBatch) {
      this._pendingBatch = [];
      requestAnimationFrame(() => {
        const frag = document.createDocumentFragment();
        for (const { role: r, content: c } of this._pendingBatch) {
          const d = document.createElement('div');
          d.className = 'message ' + r + '-message';
          const text = document.createElement('div');
          text.className = 'message-text';
          text.textContent = c;
          d.appendChild(text);
          // 时间戳
          const ts = document.createElement('span');
          ts.className = 'timestamp';
          ts.textContent = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
          d.appendChild(ts);
          // 复制按钮（非系统消息）
          if (r !== 'system') {
            const btn = document.createElement('button');
            btn.className = 'copy-btn';
            btn.innerHTML = '<i class="fa-solid fa-copy"></i>';
            btn.title = '复制';
            btn.onclick = (e) => {
              e.stopPropagation();
              navigator.clipboard.writeText(c).then(() => showToast('已复制', 'success', 1500));
            };
            d.appendChild(btn);
          }
          frag.appendChild(d);
        }
        chat.appendChild(frag);
        while (chat.childElementCount > 100) chat.removeChild(chat.firstChild);
        chat.scrollTop = chat.scrollHeight;
        this._pendingBatch = null;
      });
    }
    this._pendingBatch.push({ role, content });
  }

  /* ===== 模型可用性探测 & 自动降级 ===== */
  getSelectedModel() {
    return localStorage.getItem('model') || (this.agent && this.agent.getDefaultModel && this.agent.getDefaultModel());
  }
  setModel(modelId) {
    localStorage.setItem('model', modelId);
    const sel = document.getElementById('modelSelect');
    if (sel) {
      // 如果下拉框中没有该选项，动态加入
      if (![...sel.options].some(o => o.value === modelId)) {
        const opt = document.createElement('option');
        opt.value = modelId;
        opt.textContent = modelId + ' (降级)';
        sel.appendChild(opt);
      }
      sel.value = modelId;
    }
  }
  async probeModel(modelId) {
    // 用 Google REST API 查询模型信息（不需要额外配额）
    try {
      const key = await this.fetchGoogleKey();
      if (!key) return true; // 拿不到 Key 时跳过探测
      const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(modelId) + '?key=' + key;
      const resp = await fetch(url);
      return resp.ok;
    } catch (e) {
      console.warn('[GMP] probeModel failed, skip', e);
      return true; // 探测失败不阻断连接
    }
  }
  async fetchGoogleKey() {
    // 优先从 localStorage 读取用户输入的 Key（如果之前有暴露），否则调用后端公开配置接口
    try {
      const r = await fetch('/api/public-config');
      if (r.ok) {
        const cfg = await r.json();
        return cfg.googleApiKey || null;
      }
    } catch {}
    return null;
  }

  setupAudioPipeline() {
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
    this.gainNode.gain.value = 0.8;
  }

  playPcm(buffer, sampleRate) {
    if (!this.audioCtx) this.setupAudioPipeline();
    if (!this.pcmBuffer) { this.pcmBuffer = []; this.pcmSampleRate = sampleRate || 24000; }
    this.pcmBuffer.push(buffer);
    this.pcmSampleRate = sampleRate || this.pcmSampleRate;
    if (!this.audioPlaying) {
      this.audioPlaying = true;
      this.flushAndPlay();
    }
  }

  flushAndPlay() {
    const chunks = this.pcmBuffer || [];
    this.pcmBuffer = [];
    if (!chunks.length) { this.audioPlaying = false; return; }
    let total = 0;
    for (const c of chunks) total += c.byteLength;
    const merged = new Uint8Array(total);
    let off = 0;
    for (const c of chunks) { merged.set(new Uint8Array(c), off); off += c.byteLength; }
    const ctx = this.audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const view = new DataView(merged.buffer);
    const frameCount = view.byteLength / 2;
    const audioBuffer = ctx.createBuffer(1, frameCount, this.pcmSampleRate || 24000);
    const data = audioBuffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) data[i] = view.getInt16(i * 2, true) / 32768;
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode || ctx.destination);
    source.onended = () => {
      if (this.pcmBuffer && this.pcmBuffer.length) {
        this.flushAndPlay();
      } else {
        this.audioPlaying = false;
      }
    };
    source.start();
  }
}

/* ----------------------------------------------------------------------
 * 🎭 Role Management (frontend only)
 * ---------------------------------------------------------------------- */
const DEFAULT_ROLES = [
  { id: 'assistant',   name: '通用助手',   avatar: '🤖', description: '友好、乐于助人，适用于日常问答。', systemPrompt: 'You are a helpful assistant.' },
  { id: 'code',        name: '代码专家',   avatar: '👨‍💻', description: '擅长解释、编写、调试代码。', systemPrompt: 'You are an expert programmer. Provide concise, correct code snippets with explanations.' },
  { id: 'translator',  name: '古文翻译',   avatar: '📜', description: '专注古文/白话文互译，保留原文意境。', systemPrompt: 'You are a translator specializing in classical Chinese ↔ modern Chinese. Preserve nuance and tone.' },
  { id: 'poet',        name: '古诗创作',   avatar: '🖋️', description: '以古诗格律创作唐诗、宋词。', systemPrompt: 'You are a poet skilled in classical Chinese poetry. Compose regulated verses in the style of Tang and Song dynasties, respecting rhyme and tonal patterns.' },
  { id: 'psychologist',name: '心理咨询师', avatar: '🧠', description: '提供情感支持与倾听。', systemPrompt: 'You are an empathetic psychologist. Listen actively, give supportive feedback, and never give medical advice.' },
  { id: 'custom',      name: '自定义',     avatar: '✏️', description: '自行编辑系统指令。', systemPrompt: '' }
];

class RoleManager {
  constructor() {
    this.storageKey = 'gmp_roles_v1';
    this.currentKey = 'gmp_current_role_v1';
    this.roles = this.loadRoles();
    this.currentRoleId = localStorage.getItem(this.currentKey) || this.roles[0].id;
    this.editingId = null;
    this.renderCurrent();
    this.populateMenu();
    this.attachEvents();
  }

  loadRoles() {
    let stored = [];
    try { stored = JSON.parse(localStorage.getItem(this.storageKey) || '[]'); } catch(e) {}
    const map = new Map();
    DEFAULT_ROLES.forEach(r => map.set(r.id, { ...r }));
    stored.forEach(r => map.set(r.id, r));
    return Array.from(map.values());
  }
  saveRoles() { localStorage.setItem(this.storageKey, JSON.stringify(this.roles)); }

  getCurrent() { return this.roles.find(r => r.id === this.currentRoleId) || this.roles[0]; }
  setCurrent(id) {
    if (!this.roles.find(r => r.id === id)) return;
    this.currentRoleId = id;
    localStorage.setItem(this.currentKey, id);
    this.renderCurrent();
    this.populateMenu();
    const role = this.getCurrent();
    const sysInput = document.getElementById('systemInput');
    if (sysInput) {
      sysInput.value = role.systemPrompt;
      localStorage.setItem('systemInstructions', role.systemPrompt);
    }
  }
  updateCurrentSystemPrompt(text) {
    const role = this.getCurrent();
    role.systemPrompt = text;
    this.saveRoles();
  }

  renderCurrent() {
    const role = this.getCurrent();
    const av = document.getElementById('roleAvatar');
    const nm = document.getElementById('roleName');
    if (av) av.textContent = role.avatar;
    if (nm) nm.textContent = role.name;
  }

  populateMenu() {
    const menu = document.getElementById('roleMenu');
    if (!menu) return;
    menu.innerHTML = '';
    this.roles.forEach(r => {
      const item = document.createElement('div');
      item.className = 'role-menu-item';
      if (r.id === this.currentRoleId) item.style.background = 'rgba(233,69,96,0.2)';
      item.innerHTML = '<span class="avatar">' + r.avatar + '</span><div class="meta"><span class="name">' + r.name + '</span><span class="desc">' + r.description + '</span></div>';
      item.onclick = () => { this.setCurrent(r.id); menu.classList.add('hidden'); };
      menu.appendChild(item);
    });
  }

  attachEvents() {
    const btn = document.getElementById('roleBtn');
    const menu = document.getElementById('roleMenu');
    const manageBtn = document.getElementById('manageRolesBtn');
    if (btn) btn.onclick = (e) => { e.stopPropagation(); menu.classList.toggle('hidden'); };
    document.addEventListener('click', (e) => { if (!menu.contains(e.target) && e.target !== btn) menu.classList.add('hidden'); });
    if (manageBtn) manageBtn.onclick = () => this.openModal();
    document.getElementById('closeRoleModal').onclick = () => this.closeModal();
    document.getElementById('newRoleBtn').onclick = () => this.startCreate();
    document.getElementById('saveRoleBtn').onclick = () => this.saveEdit();
    document.getElementById('deleteRoleBtn').onclick = () => this.deleteRole();
    document.getElementById('cancelRoleBtn').onclick = () => this.cancelEdit();
  }

  openModal() {
    document.getElementById('roleModal').classList.add('active');
    this.renderList();
    this.cancelEdit();
  }
  closeModal() { document.getElementById('roleModal').classList.remove('active'); }

  renderList() {
    const list = document.getElementById('roleList');
    list.innerHTML = '';
    this.roles.forEach(r => {
      const item = document.createElement('div');
      item.className = 'role-list-item' + (r.id === this.currentRoleId ? ' active' : '');
      item.innerHTML = '<span style="font-size:1.2rem;">' + r.avatar + '</span><div style="flex:1;"><div style="font-weight:600;">' + r.name + '</div><div style="font-size:.75rem;color:#a0a0a0;">' + r.description + '</div></div>';
      item.onclick = () => this.startEdit(r.id);
      list.appendChild(item);
    });
  }

  startEdit(id) {
    this.editingId = id;
    const role = this.roles.find(r => r.id === id);
    document.getElementById('roleEdit').classList.remove('hidden');
    document.getElementById('roleNameInput').value = role.name;
    document.getElementById('roleAvatarInput').value = role.avatar;
    document.getElementById('roleDescInput').value = role.description;
    document.getElementById('rolePromptInput').value = role.systemPrompt;
    const isBuiltIn = DEFAULT_ROLES.some(d => d.id === id);
    document.getElementById('deleteRoleBtn').style.display = (isBuiltIn && id !== 'custom') ? 'none' : 'inline-block';
  }

  startCreate() {
    const id = 'custom_' + Date.now();
    const newRole = { id, name: '新角色', avatar: '✨', description: '自行编辑描述', systemPrompt: '' };
    this.roles.push(newRole);
    this.saveRoles();
    this.renderList();
    this.startEdit(id);
  }

  saveEdit() {
    if (!this.editingId) return;
    const role = this.roles.find(r => r.id === this.editingId);
    role.name = document.getElementById('roleNameInput').value.trim() || role.name;
    role.avatar = document.getElementById('roleAvatarInput').value.trim() || role.avatar;
    role.description = document.getElementById('roleDescInput').value.trim();
    role.systemPrompt = document.getElementById('rolePromptInput').value;
    this.saveRoles();
    if (role.id === this.currentRoleId) this.setCurrent(role.id);
    this.renderList();
    this.cancelEdit();
  }

  deleteRole() {
    if (!this.editingId) return;
    const role = this.roles.find(r => r.id === this.editingId);
    if (!role) return;
    if (!confirm('确定删除角色 “' + role.name + '” 吗？')) return;
    this.roles = this.roles.filter(r => r.id !== this.editingId);
    this.saveRoles();
    if (this.currentRoleId === this.editingId) {
      this.currentRoleId = this.roles[0].id;
      localStorage.setItem(this.currentKey, this.currentRoleId);
      this.renderCurrent();
      this.setCurrent(this.currentRoleId);
    }
    this.renderList();
    this.cancelEdit();
  }

  cancelEdit() {
    this.editingId = null;
    document.getElementById('roleEdit').classList.add('hidden');
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.roleManager = new RoleManager();
  const role = window.roleManager.getCurrent();
  const sysInput = document.getElementById('systemInput');
  if (sysInput) sysInput.value = role.systemPrompt;
});

// 初始化时同步历史记忆到系统指令
updateSystemInstructionsWithMemory();
const ui = new ChatUI();`};
export { indexHTML, cssFiles, jsFiles };
