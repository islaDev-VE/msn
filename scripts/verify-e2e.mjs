import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { io } from 'socket.io-client';

const TEST_PORT = 8456;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zumbido05-py-test-'));
const dbPath = path.join(tmpDir, 'test.db');

const TINY_PNG_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const TINY_AUDIO_DATA_URL =
  'data:audio/webm;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQRChYECGFOAZwH/////////';

async function waitForServer(timeoutMs = 10000) {
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
  throw new Error('Python FastAPI server failed to start within timeout');
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

const pythonBin = fs.existsSync('.venv/bin/python') ? '.venv/bin/python' : 'python3';
const serverProc = spawn(
  pythonBin,
  ['-m', 'uvicorn', 'backend.main:app', '--host', '127.0.0.1', '--port', String(TEST_PORT)],
  {
    env: {
      ...process.env,
      PORT: String(TEST_PORT),
      DATABASE_URL: `sqlite:///${dbPath}`,
      VAPID_KEYS_FILE: path.join(tmpDir, 'vapid.json'),
      JWT_SECRET: 'super-secret-python-integration-test-key-2026'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  }
);

let serverStderr = '';
serverProc.stderr.on('data', (d) => { serverStderr += d.toString(); });

try {
  const health = await waitForServer();
  assert.equal(health.status, 'ok');
  assert.equal(health.service, 'zumbido-05');
  assert.equal(health.runtime, 'python-fastapi');
  assert.ok(typeof health.buildId === 'string' && health.buildId.length >= 3);
  console.log('✓ 1. Python FastAPI health & buildId endpoint OK');

  // 2. PWA & Static endpoints + Cache-Control headers
  for (const asset of ['/', '/manifest.json', '/sw.js']) {
    const r = await fetch(`${BASE_URL}${asset}`);
    assert.equal(r.status, 200, `Expected 200 for ${asset}`);
    const cc = (r.headers.get('cache-control') || '').toLowerCase();
    assert.ok(cc.includes('no-store'), `Expected Cache-Control no-store for ${asset}, got: ${cc}`);
  }
  for (const asset of ['/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png']) {
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

  // 5. Real-time python-socketio + JS socket.io-client JWT messaging
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
    text: '¡Hola Luis desde Python FastAPI + Zumbido 05! :)',
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

  const n2 = await emitAck(anaSocket, 'send_nudge', { toUserId: luisId });
  assert.equal(n2.cooldown, true);

  await new Promise((r) => setTimeout(r, 150));
  assert.equal(receivedByLuis.length, 4);
  assert.equal(luisGotNudge, true);
  assert.equal(luisGotWink, true);
  console.log('✓ 5. Real-time text, image, voice, ink, wink, nudge & 5s nudge cooldown OK');

  // 6. Persistence, unread count, pagination & mark-read
  const luisFriendsUnread = await apiReq('/api/friends', { token: luisToken });
  assert.equal(luisFriendsUnread.data.friends[0].unreadCount, 6);

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
  console.log('✓ 6. SQLAlchemy SQLite WAL persistence, pagination, unread count & mark-read OK');

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

  // 8. Magic Invitation Links (unregistered user -> auto-friend + real-time notification + revoke)
  const notFoundReq = await apiReq('/api/friends/request', {
    method: 'POST',
    token: anaToken,
    body: { email: 'carla.nueva@retro.com' }
  });
  assert.equal(notFoundReq.status, 404);
  assert.equal(notFoundReq.data.code, 'USER_NOT_FOUND');

  const invList = await apiReq('/api/invitations', { token: anaToken });
  assert.equal(invList.status, 200);
  assert.ok(invList.data.personal?.code);

  const emailInvRes = await apiReq('/api/invitations', {
    method: 'POST',
    token: anaToken,
    body: { email: 'carla.nueva@retro.com' }
  });
  assert.equal(emailInvRes.status, 201);
  const invCode = emailInvRes.data.invitation.code;
  assert.equal(emailInvRes.data.invitation.invitedEmail, 'carla.nueva@retro.com');

  const publicInv = await apiReq(`/api/invitations/${invCode}`);
  assert.equal(publicInv.status, 200);
  assert.equal(publicInv.data.valid, true);
  assert.equal(publicInv.data.inviter.id, anaId);
  assert.equal(publicInv.data.inviter.email, undefined); // never expose inviter email publicly

  let anaGotInviteJoined = null;
  anaSocket.on('invite_joined', (payload) => { anaGotInviteJoined = payload; });

  const regCarla = await apiReq('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'carla.nueva@retro.com',
      password: 'password123',
      nickname: 'Carla 2005',
      inviteCode: invCode
    }
  });
  assert.equal(regCarla.status, 201);
  assert.equal(regCarla.data.invitedBy.id, anaId);

  await new Promise((r) => setTimeout(r, 150));
  assert.ok(anaGotInviteJoined);
  assert.equal(anaGotInviteJoined.user.email, 'carla.nueva@retro.com');

  const carlaFriends = await apiReq('/api/friends', { token: regCarla.data.token });
  assert.equal(carlaFriends.data.friends.length, 1);
  assert.equal(carlaFriends.data.friends[0].id, anaId);

  const invAfter = await apiReq('/api/invitations', { token: anaToken });
  const usedInv = invAfter.data.invitations.find((i) => i.code === invCode);
  assert.equal(usedInv.usesCount, 1);

  const delInv = await apiReq(`/api/invitations/${invCode}`, { method: 'DELETE', token: anaToken });
  assert.equal(delInv.status, 200);
  const revokedLookup = await apiReq(`/api/invitations/${invCode}`);
  assert.equal(revokedLookup.status, 404);
  console.log('✓ 8. Magic invitation links, auto-friendship, real-time notification & revocation OK');

  // 9. islaDev branding assets, WebAPK manifest & Web Push (VAPID) subscription endpoints
  for (const asset of [
    '/icons/isladev-icon.png',
    '/icons/isladev-logo.png',
    '/icons/badge-72.png',
    '/icons/icon-maskable-512.png'
  ]) {
    const r = await fetch(`${BASE_URL}${asset}`);
    assert.equal(r.status, 200, `Expected 200 for ${asset}`);
  }
  const manifestRes = await fetch(`${BASE_URL}/manifest.json`);
  const manifestJson = await manifestRes.json();
  assert.equal(manifestJson.id, '/');
  assert.equal(manifestJson.prefer_related_applications, false);
  assert.ok(manifestJson.icons.some((i) => i.purpose === 'any'));
  assert.ok(manifestJson.icons.some((i) => i.purpose === 'maskable'));

  const vapidRes = await apiReq('/api/push/public-key');
  assert.equal(vapidRes.status, 200);
  assert.equal(vapidRes.data.enabled, true);
  assert.ok(typeof vapidRes.data.publicKey === 'string' && vapidRes.data.publicKey.length >= 60);

  const testEndpoint = 'https://fcm.googleapis.com/fcm/send/fake-test-endpoint-zumbido05';
  const subRes = await apiReq('/api/push/subscribe', {
    method: 'POST',
    token: anaToken,
    body: {
      endpoint: testEndpoint,
      keys: { p256dh: 'test-p256dh-key', auth: 'test-auth-secret' }
    }
  });
  assert.equal(subRes.status, 201);
  assert.equal(subRes.data.devices, 1);

  const unsubRes = await apiReq('/api/push/subscribe', {
    method: 'DELETE',
    token: anaToken,
    body: { endpoint: testEndpoint }
  });
  assert.equal(unsubRes.status, 200);
  assert.equal(unsubRes.data.removed, true);

  // Verify persisted VAPID PEM key loads as a valid Vapid01 instance and signs FCM claims
  const { execFileSync } = await import('node:child_process');
  const signOut = execFileSync(
    pythonBin,
    [
      '-c',
      'import os; from backend.push import _load_or_create_vapid_keys; k=_load_or_create_vapid_keys(); h=k["vapid"].sign({"aud":"https://fcm.googleapis.com","sub":k["subject"]}); assert "Authorization" in h; print("SIGN_OK")'
    ],
    {
      env: { ...process.env, VAPID_KEYS_FILE: path.join(tmpDir, 'vapid.json') },
      encoding: 'utf-8'
    }
  ).trim();
  assert.equal(signOut, 'SIGN_OK');
  console.log('✓ 9. islaDev assets & Web Push VAPID subscribe/unsubscribe/sign OK');

  // 10. Security hardening & regression tests
  const homeRes = await fetch(`${BASE_URL}/`);
  assert.ok((homeRes.headers.get('content-security-policy') || '').includes("default-src 'self'"));

  for (const badEndpoint of [
    'https://127.0.0.1/secret',
    'https://evil.example.com/push',
    'https://fcm.googleapis.com:8443/fcm/send/badport',
    'https://user:pass@fcm.googleapis.com/fcm/send/creds'
  ]) {
    const ssrfRes = await apiReq('/api/push/subscribe', {
      method: 'POST',
      token: anaToken,
      body: { endpoint: badEndpoint, keys: { p256dh: 'k', auth: 'a' } }
    });
    assert.equal(ssrfRes.status, 400, `Expected 400 SSRF block for ${badEndpoint}`);
  }

  const badNickReg = await apiReq('/api/auth/register', {
    method: 'POST',
    body: { email: 'invisible@retro.com', password: 'password123', nickname: '[b][c=#ff0000][/c][/b]' }
  });
  assert.equal(badNickReg.status, 400);

  const badNickProf = await apiReq('/api/auth/profile', {
    method: 'PUT',
    token: anaToken,
    body: { nickname: '[i][/i]' }
  });
  assert.equal(badNickProf.status, 400);

  // Blocked user (Luis blocked Ana in test #7) cannot bypass block using Ana's personal invite link
  const anaPersonalCode = invList.data.personal.code;
  const blockedInviteAccept = await apiReq(`/api/invitations/${anaPersonalCode}/accept`, {
    method: 'POST',
    token: luisToken
  });
  assert.equal(blockedInviteAccept.status, 403);

  // Unblock Luis -> Ana to verify empty image media rejection & reject-accepted protection
  await apiReq(`/api/friends/${anaId}/block`, {
    method: 'PUT',
    token: luisToken,
    body: { blocked: false }
  });
  const emptyImgAck = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'image',
    text: 'empty.png',
    mediaData: ''
  });
  assert.ok(emptyImgAck.error);

  const rejectAccepted = await apiReq('/api/friends/respond', {
    method: 'POST',
    token: anaToken,
    body: { friendId: luisId, action: 'reject' }
  });
  assert.equal(rejectAccepted.status, 404);
  console.log('✓ 10. Security hardening (SSRF, CSP, invisible nick, empty media, blocked invite, pending reject) OK');

  // 11. DM Read Receipts (friend_read_messages), Replies/Quotes, Emoji Reactions & New Winks
  const dmSentAck = await emitAck(anaSocket, 'send_message', {
    toUserId: luisId,
    type: 'text',
    text: 'Mensaje original para citar https://isladev.com'
  });
  assert.equal(dmSentAck.ok, true);
  const origMsgId = dmSentAck.message.id;

  const friendReadPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout friend_read_messages')), 3000);
    anaSocket.once('friend_read_messages', (ev) => {
      clearTimeout(t);
      resolve(ev);
    });
  });
  luisSocket.emit('mark_read', { friendId: anaId });
  const friendReadEv = await friendReadPromise;
  assert.equal(friendReadEv.byUserId, luisId);

  const replyAck = await emitAck(luisSocket, 'send_message', {
    toUserId: anaId,
    type: 'text',
    text: 'Respuesta citada!',
    replyToId: origMsgId
  });
  assert.equal(replyAck.ok, true);
  assert.equal(replyAck.message.replyTo.id, origMsgId);
  assert.ok(replyAck.message.replyTo.text.includes('Mensaje original'));

  const reactionPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout reaction_updated')), 3000);
    anaSocket.once('reaction_updated', (ev) => {
      clearTimeout(t);
      resolve(ev);
    });
  });
  const reactAck = await emitAck(luisSocket, 'toggle_reaction', {
    scope: 'dm',
    messageId: origMsgId,
    emoji: '❤️'
  });
  assert.equal(reactAck.ok, true);
  const reactEv = await reactionPromise;
  assert.equal(reactEv.messageId, origMsgId);
  assert.equal(reactEv.reactions[0].emoji, '❤️');
  assert.equal(reactEv.reactions[0].count, 1);

  // Toggle off & invalid emoji rejection
  const reactOff = await emitAck(luisSocket, 'toggle_reaction', {
    scope: 'dm',
    messageId: origMsgId,
    emoji: '❤️'
  });
  assert.equal(reactOff.reactions.length, 0);
  const badReact = await emitAck(luisSocket, 'toggle_reaction', {
    scope: 'dm',
    messageId: origMsgId,
    emoji: '💀'
  });
  assert.ok(badReact.error);

  const newWinkAck = await emitAck(anaSocket, 'send_wink', {
    toUserId: luisId,
    winkId: 'hearts'
  });
  assert.equal(newWinkAck.ok, true);
  assert.equal(newWinkAck.message.winkId, 'hearts');
  console.log('✓ 11. DM read receipts (✓✓), reply quotes, emoji reactions & new winks OK');

  // 12. Group Chats (create, invite, messages, reply, reactions, wink, nudge, read, leave)
  const regPedro = await apiReq('/api/auth/register', {
    method: 'POST',
    body: {
      email: 'pedro.grupo@retro.com',
      password: 'password123',
      nickname: 'Pedro05'
    }
  });
  assert.equal(regPedro.status, 201);
  const pedroToken = regPedro.data.token;
  const pedroId = regPedro.data.user.id;
  await apiReq('/api/friends/request', {
    method: 'POST',
    token: anaToken,
    body: { email: 'pedro.grupo@retro.com' }
  });
  await apiReq('/api/friends/respond', {
    method: 'POST',
    token: pedroToken,
    body: { friendId: anaId, action: 'accept' }
  });
  const pedroSocket = await connectClient(pedroToken);

  const createGrp = await apiReq('/api/groups', {
    method: 'POST',
    token: anaToken,
    body: { name: 'Sala Retro 2005', memberIds: [luisId], avatar: '🎧' }
  });
  assert.equal(createGrp.status, 201);
  const groupId = createGrp.data.group.id;
  assert.equal(createGrp.data.group.members.length, 2);

  // Add Pedro to group
  const addMem = await apiReq(`/api/groups/${groupId}/members`, {
    method: 'POST',
    token: anaToken,
    body: { memberIds: [pedroId] }
  });
  assert.equal(addMem.status, 200);
  assert.equal(addMem.data.group.members.length, 3);

  // Real-time group message + reply + reaction + wink + nudge
  const luisGroupMsgPromise = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Timeout receive_group_message')), 3000);
    luisSocket.once('receive_group_message', (msg) => {
      clearTimeout(t);
      resolve(msg);
    });
  });
  const gMsgAck = await emitAck(anaSocket, 'send_group_message', {
    groupId,
    type: 'text',
    text: 'Bienvenidos a la sala!'
  });
  assert.equal(gMsgAck.ok, true);
  const luisGotGroupMsg = await luisGroupMsgPromise;
  assert.equal(luisGotGroupMsg.groupId, groupId);

  const gReplyAck = await emitAck(pedroSocket, 'send_group_message', {
    groupId,
    type: 'text',
    text: 'Gracias Ana!',
    replyToId: gMsgAck.message.id
  });
  assert.equal(gReplyAck.ok, true);
  assert.equal(gReplyAck.message.replyTo.id, gMsgAck.message.id);

  const gReactAck = await emitAck(luisSocket, 'toggle_reaction', {
    scope: 'group',
    messageId: gMsgAck.message.id,
    emoji: '🔥'
  });
  assert.equal(gReactAck.ok, true);
  assert.equal(gReactAck.reactions[0].emoji, '🔥');

  const gWinkAck = await emitAck(anaSocket, 'send_group_wink', {
    groupId,
    winkId: 'party'
  });
  assert.equal(gWinkAck.ok, true);
  assert.equal(gWinkAck.message.winkId, 'party');

  const gNudgeAck = await emitAck(anaSocket, 'send_group_nudge', { groupId });
  assert.equal(gNudgeAck.ok, true);

  // Unread + mark_group_read (Luis hasn't read any of the 4 messages; Pedro sent msg #2 so wink + nudge = 2 unread)
  const luisGroupsBefore = await apiReq('/api/groups', { token: luisToken });
  const luisGroupObj = luisGroupsBefore.data.groups.find((g) => g.id === groupId);
  assert.equal(luisGroupObj.unreadCount, 4);

  const pedroGroupsBefore = await apiReq('/api/groups', { token: pedroToken });
  const pedroGroupObj = pedroGroupsBefore.data.groups.find((g) => g.id === groupId);
  assert.equal(pedroGroupObj.unreadCount, 2);

  await apiReq(`/api/groups/${groupId}/read`, { method: 'POST', token: pedroToken });
  const pedroGroupsAfter = await apiReq('/api/groups', { token: pedroToken });
  assert.equal(pedroGroupsAfter.data.groups.find((g) => g.id === groupId).unreadCount, 0);

  // History fetch
  const gHist = await apiReq(`/api/groups/${groupId}/messages`, { token: luisToken });
  assert.equal(gHist.status, 200);
  assert.ok(gHist.data.messages.length >= 4);

  // Leave group & verify access revoked
  const leaveRes = await apiReq(`/api/groups/${groupId}/leave`, { method: 'POST', token: pedroToken });
  assert.equal(leaveRes.status, 200);
  const pedroForbidden = await apiReq(`/api/groups/${groupId}/messages`, { token: pedroToken });
  assert.equal(pedroForbidden.status, 403);
  pedroSocket.disconnect();
  console.log('✓ 12. Group chats (create, invite, messages, reply, reactions, wink, nudge, read, leave) OK');

  anaSocket.disconnect();
  luisSocket.disconnect();
  console.log('\nALL PYTHON FASTAPI + SOCKET.IO E2E TESTS PASSED! 🎉');
} catch (err) {
  console.error('E2E TEST FAILED:', err);
  if (serverStderr) console.error('Server stderr:', serverStderr);
  process.exitCode = 1;
} finally {
  serverProc.kill('SIGTERM');
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
