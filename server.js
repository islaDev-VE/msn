import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Map of roomId -> Map of socketId -> userProfile
const rooms = new Map();

io.on('connection', (socket) => {
  let currentRoom = null;
  let currentUser = null;

  socket.on('join_room', ({ roomId, profile }) => {
    currentRoom = roomId || 'lobby';
    currentUser = {
      socketId: socket.id,
      id: socket.id,
      email: profile.email || 'usuario@hotmail.com',
      nickname: profile.nickname || 'Amigo MSN',
      status: profile.status || 'online',
      avatar: profile.avatar || 'butterfly',
      personalMessage: profile.personalMessage || ''
    };

    socket.join(currentRoom);

    if (!rooms.has(currentRoom)) {
      rooms.set(currentRoom, new Map());
    }
    rooms.get(currentRoom).set(socket.id, currentUser);

    const roomUsers = Array.from(rooms.get(currentRoom).values());
    io.to(currentRoom).emit('room_users', roomUsers);

    // Notify others that a user signed in
    socket.to(currentRoom).emit('user_joined', {
      user: currentUser,
      timestamp: Date.now()
    });
  });

  socket.on('update_profile', (updatedProfile) => {
    if (!currentRoom || !currentUser) return;
    const roomMap = rooms.get(currentRoom);
    if (roomMap && roomMap.has(socket.id)) {
      currentUser = {
        ...currentUser,
        ...updatedProfile
      };
      roomMap.set(socket.id, currentUser);
      io.to(currentRoom).emit('room_users', Array.from(roomMap.values()));
    }
  });

  socket.on('send_message', (messageData) => {
    if (!currentRoom) return;
    const enrichedMessage = {
      ...messageData,
      id: 'msg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5),
      from: currentUser || { nickname: 'Anónimo', email: 'unknown@hotmail.com' },
      timestamp: Date.now()
    };
    io.to(currentRoom).emit('receive_message', enrichedMessage);
  });

  socket.on('send_nudge', () => {
    if (!currentRoom || !currentUser) return;
    io.to(currentRoom).emit('receive_nudge', {
      from: currentUser,
      timestamp: Date.now()
    });
  });

  socket.on('send_wink', (winkData) => {
    if (!currentRoom || !currentUser) return;
    io.to(currentRoom).emit('receive_wink', {
      from: currentUser,
      winkId: winkData.winkId,
      timestamp: Date.now()
    });
  });

  socket.on('typing_status', ({ isTyping }) => {
    if (!currentRoom || !currentUser) return;
    socket.to(currentRoom).emit('user_typing', {
      from: currentUser,
      isTyping
    });
  });

  socket.on('disconnect', () => {
    if (currentRoom && rooms.has(currentRoom)) {
      const roomMap = rooms.get(currentRoom);
      roomMap.delete(socket.id);
      if (roomMap.size === 0) {
        rooms.delete(currentRoom);
      } else {
        io.to(currentRoom).emit('room_users', Array.from(roomMap.values()));
        if (currentUser) {
          socket.to(currentRoom).emit('user_left', {
            user: currentUser,
            timestamp: Date.now()
          });
        }
      }
    }
  });
});

// Serve static frontend files if built
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'msn-75-backend', activeRooms: rooms.size });
});

app.get('*', (req, res) => {
  if (req.accepts('html')) {
    const indexPath = path.join(distPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        res.status(200).send('MSN Messenger 7.5 API Server is running. Vite dev server runs on port 3000.');
      }
    });
  } else {
    res.status(404).json({ error: 'Not found' });
  }
});

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`[MSN 7.5 Server] Listening on port ${PORT}`);
});
