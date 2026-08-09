import { indexHTML, cssFiles, jsFiles } from './static.js';
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

function normalizeWSData(data) {
  if (typeof data === 'string') return data;
  if (data !== null && typeof data === 'object') {
    try {
      if (data instanceof ArrayBuffer) return new TextDecoder().decode(data);
      if (ArrayBuffer.isView(data)) return new TextDecoder().decode(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
    } catch (e) {}
  }
  return data;
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
      proxy.send(normalizeWSData(event.data));
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
    let origin = '';
    try { origin = new URL(event.target?.url || '').origin; } catch (e) {}
    console.log('UPSTREAM_ERROR', JSON.stringify({ origin, message: event.message, code: event.code, reason: event.reason }));
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
    `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${env.GOOGLE_API_KEY}`;

  let upstream;
  try {
    upstream = new WebSocket(targetUrl);
  } catch (e) {
    console.log('GEMINI_UPSTREAM_CREATE_FAIL', e.message);
    return new Response('Upstream WebSocket creation failed', { status: 502 });
  }

  const [client, proxy] = new WebSocketPair();
  proxy.accept();
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
const JSON_HEADERS = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

async function upstreamError(resp) {
  let body = '';
  try { body = await resp.text(); } catch (e) {}
  const snippet = body.slice(0, 1000);
  console.log('UPSTREAM_REST_ERROR', JSON.stringify({ status: resp.status, body: snippet.slice(0, 500) }));
  return new Response(JSON.stringify({ error: { status: resp.status, message: snippet || 'Upstream request failed' } }), {
    status: resp.status,
    headers: JSON_HEADERS,
  });
}

function invalidUpstream() {
  return new Response(JSON.stringify({ error: { message: 'Invalid JSON from upstream' } }), {
    status: 502,
    headers: JSON_HEADERS,
  });
}

async function handleModels(apiKey) {
  const resp = await fetch(`${BASE_URL}/v1beta/models`, {
    headers: { 'x-goog-api-key': apiKey, 'x-goog-api-client': 'genai-js/0.21.0' },
  });
  if (!resp.ok) return upstreamError(resp);
  let data;
  try { data = await resp.json(); } catch (e) { return invalidUpstream(); }
  const { models } = data;
  return new Response(JSON.stringify({
    object: 'list',
    data: models.map(m => ({ id: m.name.replace('models/', ''), object: 'model' })),
  }), {
    headers: JSON_HEADERS,
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
  if (!resp.ok) return upstreamError(resp);
  let data;
  try { data = await resp.json(); } catch (e) { return invalidUpstream(); }
  const { embeddings } = data;
  return new Response(JSON.stringify({
    object: 'list',
    data: embeddings.map((e, i) => ({ object: 'embedding', index: i, embedding: e.values })),
    model: req.model,
  }), {
    headers: JSON_HEADERS,
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

  if (!resp.ok) return upstreamError(resp);

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
              try {
                const data = JSON.parse(match[1]);
                const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
                const id = 'chatcmpl-' + Math.random().toString(36).slice(2, 11);
                controller.enqueue(`data: ${JSON.stringify({
                  id, choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
                  created: Math.floor(Date.now() / 1000), model,
                })}\n\n`);
              } catch (e) {
                console.log('SSE_PARSE_SKIP', e.message);
              }
            }
          }
        },
        flush(controller) {
          if (this.buffer) {
            const match = this.buffer.match(/^data: (.*)$/);
            if (match) {
              try {
                const data = JSON.parse(match[1]);
                const text = data.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
                const id = 'chatcmpl-' + Math.random().toString(36).slice(2, 11);
                controller.enqueue(`data: ${JSON.stringify({
                  id, choices: [{ index: 0, delta: { content: text }, finish_reason: 'stop' }],
                  created: Math.floor(Date.now() / 1000), model,
                })}\n\n`);
              } catch (e) {
                console.log('SSE_PARSE_SKIP', e.message);
              }
            }
          }
          controller.enqueue('data: [DONE]\n\n');
        },
      }));
    return new Response(streamResp, { headers: { 'Content-Type': 'text/event-stream', 'Access-Control-Allow-Origin': '*' } });
  }

  let data;
  try { data = await resp.json(); } catch (e) { return invalidUpstream(); }
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

