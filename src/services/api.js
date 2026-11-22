const TOKEN_KEY = 'zumbido05_token';

export function getStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function setStoredToken(token) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

async function request(path, options = {}) {
  const token = getStoredToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(path, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detailMsg = typeof data.detail === 'string' ? data.detail : null;
    const err = new Error(data.error || detailMsg || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  getMe() {
    return request('/api/auth/me');
  },
  updateProfile(payload) {
    return request('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  },

  // Friends
  getFriends() {
    return request('/api/friends');
  },
  sendFriendRequest(email) {
    return request('/api/friends/request', {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },
  respondFriendRequest(friendId, action) {
    return request('/api/friends/respond', {
      method: 'POST',
      body: JSON.stringify({ friendId, action })
    });
  },
  updateFriendGroup(friendId, groupName) {
    return request(`/api/friends/${friendId}/group`, {
      method: 'PUT',
      body: JSON.stringify({ groupName })
    });
  },
  setFriendBlocked(friendId, blocked) {
    return request(`/api/friends/${friendId}/block`, {
      method: 'PUT',
      body: JSON.stringify({ blocked })
    });
  },
  removeFriend(friendId) {
    return request(`/api/friends/${friendId}`, {
      method: 'DELETE'
    });
  },

  // Messages
  getMessages(friendId, { beforeId = null, limit = 30 } = {}) {
    const qs = new URLSearchParams();
    qs.set('limit', String(limit));
    if (beforeId) qs.set('before', String(beforeId));
    return request(`/api/messages/${friendId}?${qs.toString()}`);
  },
  markRead(friendId) {
    return request(`/api/messages/${friendId}/read`, {
      method: 'POST'
    });
  }
};
