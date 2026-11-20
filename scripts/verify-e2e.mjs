import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';

const TEST_PORT = 3456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zumbido05-test-'));
const dbPath = path.join(tmpDir, 'test.db');

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_AUDIO_DATA_URL =
  'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////';

async function waitForServer(timeoutMs = 8000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const r = await fetch(`${BASE_URL}/api/health`);
      if (r.ok) return r.json();
    } catch {
      // retry
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  throw new Error('Server failed to start within timeout');
}

async function apiReq(urlPath, { method = 'GET', token = null, body = null } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${urlPath}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

function connectClient(token) {
  return new Promise((resolve, reject) => {
    const s = io(BASE_URL, { auth: { token }, transports: ['websocket'] });
    s.on('connect', () => resolve(s));
    s.on('connect_error', reject);
  });
}

const serverProc = spawn(process.execPath, ['server.js'], {
  env: {
    ...process.env,
    PORT: String(TEST_PORT),
    DB_PATH: dbPath,
    JWT_SECRET: 'super-secret-integration-test-key-2026'
  },
  stdio: ['ignore', 'pipe', 'pipe']
});

let serverStderr = '';
serverProc.stderr.on('data', (d) => { serverStderr += d.toString(); });

try {
  const health = await waitForServer();
  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'zumbido-05');
  console.log('✓ 1. Health endpoint OK');

  // 2. PWA & Static endpoints
  for (const asset of ['/manifest.json', '/sw.js', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
    const r = await fetch(`${BASE_URL}${asset}`);
    assert.equal(r.status, 200, `Expected 200 for ${asset}`);
  }
  const manifest = await (await fetch(`${BASE_URL}/manifest.json`)).json();
  assert.equal(manifest.short_name, 'Zumbido 05');
  console.log('✓ 2. PWA manifest, service worker & PNG icons HTTP 200');

  // 3. Register two real users + verify password rejection
  const regAna = await apiReq('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'ana@ejemplo.com',
      password: 'password123',
      nickname: '[c=#e60073]Ana_Retro[/c]',
      personalMessage: '(8) Evanescence - Bring Me To Life (8)',
      avatar: TINY_PNG_DATA_URL
    }
  });
  assert.equal(regAna.status, 201);
  assert.equal(regAna.data.user.avatar, TINY_PNG_DATA_URL);

  const regLuis = await apiReq('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'luis@ejemplo.com',
      password: 'password456',
      nickname: 'Luis_05',
      avatar: 'bubbles'
    }
  });
  assert.equal(regLuis.status, 201);

  const badLogin = await apiReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'ana@ejemplo.com', password: 'wrongpassword' }
  });
  assert.equal(badLogin.status, 401);

  const goodLogin = await apiReq('/api/auth/login', {
    method: 'POST',
    body: { email: 'ana@ejemplo.com', password: 'password123' }
  });
  assert.equal(goodLogin.status, 200);
  console.log('✓ 3. Registration, real avatar upload, bcrypt password check & JWT login OK');

  const anaToken = goodLogin.data.token;
  const luisToken = regLuis.data.token;
  const anaId = regAna.data.user.id;
  const luisId = regLuis.data.user.id;

  // 4. Friend request, acceptance, and custom group
  const reqRes = await apiReq('/api/friends/request', {
    method: 'POST',
    token: anaToken,
    body: { email: 'luis@ejemplo.com' }
  });
  assert.equal(reqRes.status, 201);
  assert.equal(reqRes.data.outgoingRequests.length, 1);

  const luisFriendsBefore = await apiReq('/api/friends', { token: luisToken });
  assert.equal(luisFriendsBefore.data.incomingRequests.length, 1);

  const acceptRes = await apiReq('/api/friends/respond', {
    method: 'POST',
    token: luisToken,
    body: { friendId: anaId, action: 'accept' }
  });
  assert.equal(acceptRes.status, 200);
  assert.equal(acceptRes.data.friends.length, 1);

  const groupRes = await apiReq(`/api/friends/${luisId}/group`, {
    method: 'PUT',
    token: anaToken,
    body: { groupName: 'Familia' }
  });
  assert.equal(groupRes.status, 200);
  assert.equal(groupRes.data.friends[0].groupName, 'Familia');
  console.log('✓ 4. Friend requests, acceptance & custom group update OK');

  // 5. Real-time Socket.io JWT messaging: text, image, voice, ink, wink, nudge + cooldown
  const anaSocket = await connectClient(anaToken);
  const luisSocket = await connectClient(luisToken);

  const receivedByLuis = [];
  luisSocket.on('receive_message', (m) => receivedByLuis.push(m));
  let luisGotNudge = false;
  luisSocket.on('receive_nudge', () => { luisGotNudge = true; });
  let luisGotWink = false;
  luisSocket.on('receive_wink', () => { luisGotWink = true; });

  const emitAck = (sock, evt, payload) =>
    new Promise((resolve) => sock.emit(evt, payload, resolve));

  const m1 = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'text',
    text: '¡Hola Luis desde Zumbido 05! :)',
    font: 'Comic Sans MS',
    color: '#0055ea',
    isBold: true
  });
  assert.equal(m1.ok, true);

  const m2 = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'image',
    text: 'foto.png',
    mediaData: TINY_PNG_DATA_URL
  });
  assert.equal(m2.ok, true);

  const m3 = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'voice',
    text: 'Clip de voz (2s)',
    mediaData: TINY_AUDIO_DATA_URL
  });
  assert.equal(m3.ok, true);

  const m4 = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'ink',
    text: 'Dibujo',
    mediaData: TINY_PNG_DATA_URL
  });
  assert.equal(m4.ok, true);

  const w1 = await emitAck(anaSocket, 'send_wink', { toUserId: luisId, winkId: 'water' });
  assert.equal(w1.ok, true);

  const n1 = await emitAck(anaSocket, 'send_nudge', { toUserId: luisId });
  assert.equal(n1.ok, true);

  // Immediate second nudge must hit 5s cooldown
  const n2 = await emitAck(anaSocket, 'send_nudge', { toUserId: luisId });
  assert.equal(n2.cooldown, true);

  await new Promise((r) => setTimeout(r, 150));
  assert.equal(receivedByLuis.length, 4);
  assert.equal(luisGotNudge, true);
  assert.equal(luisGotWink, true);
  console.log('✓ 5. Real-time text, image, voice, ink, wink, nudge & 5s nudge cooldown OK');

  // 6. Persistence, unread count, pagination & mark-read
  const luisFriendsUnread = await apiReq('/api/friends', { token: luisToken });
  assert.equal(luisFriendsUnread.data.friends[0].unreadCount, 6); // 4 msgs + 1 wink + 1 nudge

  const page1 = await apiReq(`/api/messages/${anaId}?limit=3`, { token: luisToken });
  assert.equal(page1.status, 200);
  assert.equal(page1.data.messages.length, 3);
  assert.equal(page1.data.hasMore, true);

  const page2 = await apiReq(`/api/messages/${anaId}?limit=3&before=${page1.data.messages[0].id}`, { token: luisToken });
  assert.equal(page2.status, 200);
  assert.equal(page2.data.messages.length, 3);
  assert.equal(page2.data.hasMore, false);

  const readRes = await apiReq(`/api/messages/${anaId}/read`, { method: 'POST', token: luisToken });
  assert.equal(readRes.status, 200);
  const luisFriendsAfterRead = await apiReq('/api/friends', { token: luisToken });
  assert.equal(luisFriendsAfterRead.data.friends[0].unreadCount, 0);
  console.log('✓ 6. SQLite WAL persistence, pagination, unread count & mark-read OK');

  // 7. Block contact prevents messaging
  const blockRes = await apiReq(`/api/friends/${anaId}/block`, {
    method: 'PUT',
    token: luisToken,
    body: { blocked: true }
  });
  assert.equal(blockRes.status, 200);

  const blockedMsg = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'text',
    text: 'No debería llegar'
  });
  assert.ok(blockedMsg.error);
  console.log('✓ 7. Contact blocking enforcement OK');

  anaSocket.disconnect();
  luisSocket.disconnect();
  console.log('\nALL E2E INTEGRATION TESTS PASSED! 🎉');
} catch (err) {
  console.error('E2E TEST FAILED:', err);
  if (serverStderr) console.error('Server stderr:', serverStderr);
  process.exitCode = 1;
} finally {
  serverProc.kill('SIGTERM');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
