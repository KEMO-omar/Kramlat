import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';
import { WebSocketServer, WebSocket } from 'ws';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Database Setup
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Initial Database Template
const INITIAL_DB = {
  admin: {
    password: 'kramlat2026', // Default master password, changeable by admin
    updatedAt: new Date().toISOString()
  },
  settings: {
    counterText: 'عيد سعيد',
    activeChallenge: 'code_breaker',
    mastermind: {
      randomMode: true,
      defaultDigits: 4,
      allowDuplicates: true
    },
    announcement: {
      visible: true,
      title: '🚀 إعلان الإمبراطورية الكبرى',
      text: 'انطلق الموسم الجديد بتحديات مباشرة ومكافآت كبرى للأبطال.'
    }
  }
};

// Database helper functions
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf8');
      return INITIAL_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading database, restoring defaults:', err);
    return INITIAL_DB;
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing database:', err);
    return false;
  }
}

// In-memory active admin sessions
const activeSessions = new Map();

function cleanSessions() {
  const now = Date.now();
  for (const [token, data] of activeSessions.entries()) {
    if (now - data.createdAt > 24 * 60 * 60 * 1000) {
      activeSessions.delete(token);
    }
  }
}

function requireAdminAuth(req, res, next) {
  cleanSessions();
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

  if (!token || !activeSessions.has(token)) {
    return res.status(401).json({ success: false, error: 'غير مصرح بالدخول. يرجى تسجيل الدخول بكلمة السر أولاً.' });
  }

  req.adminSession = activeSessions.get(token);
  next();
}

// ----------------------------------------------------
// API ROUTES: Admin Authentication & Password Control
// ----------------------------------------------------

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, error: 'يرجى إدخال كلمة السر' });
  }

  const db = readDB();
  const currentPassword = db.admin?.password || 'kramlat2026';

  if (password === currentPassword) {
    const token = crypto.randomBytes(32).toString('hex');
    activeSessions.set(token, {
      createdAt: Date.now(),
      role: 'super_admin'
    });

    return res.json({
      success: true,
      message: 'تم تسجيل الدخول بنجاح! مرحباً يا قائد المجرة 👑',
      token
    });
  } else {
    return res.status(401).json({
      success: false,
      error: 'كلمة السر غير صحيحة! يرجى المحاولة مرة أخرى.'
    });
  }
});

app.get('/api/admin/verify', (req, res) => {
  cleanSessions();
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

  if (token && activeSessions.has(token)) {
    return res.json({ success: true, authenticated: true });
  }
  return res.json({ success: false, authenticated: false });
});

app.post('/api/admin/change-password', requireAdminAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!newPassword || newPassword.trim().length < 4) {
    return res.status(400).json({
      success: false,
      error: 'يجب أن تتكون كلمة السر الجديدة من 4 أحرف أو أرقام على الأقل.'
    });
  }

  const db = readDB();
  const storedPassword = db.admin?.password || 'kramlat2026';

  if (currentPassword && currentPassword !== storedPassword) {
    return res.status(400).json({
      success: false,
      error: 'كلمة السر الحالية غير صحيحة!'
    });
  }

  db.admin = {
    password: newPassword.trim(),
    updatedAt: new Date().toISOString()
  };

  const saved = writeDB(db);
  if (!saved) {
    return res.status(500).json({ success: false, error: 'فشل حفظ التعديلات في قاعدة البيانات!' });
  }

  return res.json({
    success: true,
    message: 'تم تحديث كلمة السر وحفظها في قاعدة البيانات بنجاح! 🔐✨'
  });
});

app.get('/api/admin/settings', (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    settings: db.settings || {},
    updatedAt: db.admin?.updatedAt
  });
});

app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
  const db = readDB();
  db.settings = Object.assign({}, db.settings, req.body.settings || {});
  writeDB(db);
  res.json({ success: true, message: 'تم حفظ إعدادات المجرة بنجاح!' });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'تم تسجيل الخروج.' });
});

// ----------------------------------------------------
// MULTIPLAYER MASTERMIND ENGINE (REST API + WebSocket)
// ----------------------------------------------------
const multiplayerRooms = new Map();

function normalizeDigits(str) {
  if (!str) return '';
  return str.toString()
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/\s+/g, '');
}

function generateRoomId() {
  let id = '';
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (multiplayerRooms.has(id));
  return id;
}

// Evaluate Mastermind Guess against Secret
function evaluateMastermind(guess, secret, digits = 4) {
  const normGuess = normalizeDigits(guess);
  const normSecret = normalizeDigits(secret);
  const secretCopy = normSecret.split('');
  const guessCopy = normGuess.split('');
  const clues = new Array(digits).fill('red');

  let greens = 0;
  let yellows = 0;

  // Pass 1: exact matches
  for (let i = 0; i < digits; i++) {
    if (guessCopy[i] === secretCopy[i]) {
      clues[i] = 'green';
      greens++;
      secretCopy[i] = null;
      guessCopy[i] = null;
    }
  }

  // Pass 2: misplaced matches
  for (let i = 0; i < digits; i++) {
    if (guessCopy[i] !== null) {
      const matchIdx = secretCopy.indexOf(guessCopy[i]);
      if (matchIdx !== -1) {
        clues[i] = 'yellow';
        yellows++;
        secretCopy[matchIdx] = null;
      }
    }
  }

  return { clues, greens, yellows, digits };
}

// Sanitize room data for a specific player (NEVER leak opponent's secret code!)
function sanitizeRoomForPlayer(room, role) {
  const isP1 = role === 'player1';
  const me = isP1 ? room.player1 : room.player2;
  const opponent = isP1 ? room.player2 : room.player1;

  return {
    id: room.id,
    digits: room.digits,
    status: room.status,
    winner: room.winner,
    winnerName: room.winner ? (room.winner === 'player1' ? room.player1?.name : room.player2?.name) : null,
    lastReaction: room.lastReaction || null,
    me: me ? {
      id: me.id,
      name: me.name,
      role: isP1 ? 'player1' : 'player2',
      hasChosenSecret: !!me.secret,
      mySecret: me.secret,
      guesses: me.guesses,
      won: me.won,
      ready: me.ready
    } : null,
    opponent: opponent ? {
      name: opponent.name,
      role: isP1 ? 'player2' : 'player1',
      hasChosenSecret: !!opponent.secret,
      // Opponent's secret is strictly hidden until game_over
      mySecret: room.status === 'game_over' ? opponent.secret : null,
      guessCount: opponent.guesses.length,
      lastFeedback: opponent.guesses.length > 0 ? {
        greens: opponent.guesses[opponent.guesses.length - 1].greens,
        yellows: opponent.guesses[opponent.guesses.length - 1].yellows
      } : null,
      won: opponent.won,
      ready: opponent.ready
    } : null
  };
}

// Broadcast message to room players
function broadcastToRoom(room, messageObj) {
  if (room.player1?.ws && room.player1.ws.readyState === WebSocket.OPEN) {
    try {
      const payload = Object.assign({}, messageObj, {
        room: sanitizeRoomForPlayer(room, 'player1')
      });
      room.player1.ws.send(JSON.stringify(payload));
    } catch(e) {}
  }

  if (room.player2?.ws && room.player2.ws.readyState === WebSocket.OPEN) {
    try {
      const payload = Object.assign({}, messageObj, {
        room: sanitizeRoomForPlayer(room, 'player2')
      });
      room.player2.ws.send(JSON.stringify(payload));
    } catch(e) {}
  }
}

// ----------------------------------------------------
// REST API ENDPOINTS FOR MULTIPLAYER (100% Reliable Fallback)
// ----------------------------------------------------

// 1. Create Room via REST
app.post('/api/multiplayer/room/create', (req, res) => {
  const roomId = generateRoomId();
  const playerName = (req.body.playerName || 'القائد').trim().slice(0, 20);
  const digits = parseInt(req.body.digits, 10) || 4;
  const token = crypto.randomUUID();

  const room = {
    id: roomId,
    digits: digits,
    status: 'waiting',
    player1: {
      id: token,
      ws: null,
      name: playerName,
      secret: null,
      guesses: [],
      won: false,
      ready: false
    },
    player2: null,
    winner: null,
    lastReaction: null,
    createdAt: Date.now(),
    lastActivity: Date.now()
  };

  multiplayerRooms.set(roomId, room);

  return res.json({
    success: true,
    roomId: roomId,
    playerToken: token,
    role: 'player1',
    room: sanitizeRoomForPlayer(room, 'player1')
  });
});

// 2. Join Room via REST
app.post('/api/multiplayer/room/join', (req, res) => {
  const roomId = normalizeDigits(req.body.roomId);
  const playerName = (req.body.playerName || 'المتحدي').trim().slice(0, 20);
  const room = multiplayerRooms.get(roomId);

  if (!room) {
    return res.status(404).json({
      success: false,
      error: `الغرفة رقم #${roomId} غير موجودة أو انتهت صلاحيتها! ⚠️`
    });
  }

  // Check if player is re-joining with existing token
  const existingToken = req.body.token || req.headers['x-player-token'];
  if (existingToken) {
    if (room.player1?.id === existingToken) {
      return res.json({
        success: true,
        roomId: room.id,
        playerToken: existingToken,
        role: 'player1',
        room: sanitizeRoomForPlayer(room, 'player1')
      });
    }
    if (room.player2?.id === existingToken) {
      return res.json({
        success: true,
        roomId: room.id,
        playerToken: existingToken,
        role: 'player2',
        room: sanitizeRoomForPlayer(room, 'player2')
      });
    }
  }

  if (room.player2) {
    return res.status(400).json({
      success: false,
      error: 'عذراً! الغرفة ممتلئة بالفعل باثنين من اللاعبين ⚠️'
    });
  }

  const token = crypto.randomUUID();
  room.player2 = {
    id: token,
    ws: null,
    name: playerName,
    secret: null,
    guesses: [],
    won: false,
    ready: false
  };
  room.status = 'setup';
  room.lastActivity = Date.now();

  broadcastToRoom(room, {
    type: 'room_ready_for_setup',
    message: `انضم ${playerName}! الآن اختاروا أرقامكم السرية لمنافسكم 🔐`
  });

  return res.json({
    success: true,
    roomId: room.id,
    playerToken: token,
    role: 'player2',
    room: sanitizeRoomForPlayer(room, 'player2')
  });
});

// 3. Get Room State via REST (Polling / State fetch)
app.get('/api/multiplayer/room/:id/state', (req, res) => {
  const roomId = normalizeDigits(req.params.id);
  const token = req.query.token || req.headers['x-player-token'];
  const room = multiplayerRooms.get(roomId);

  if (!room) {
    return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });
  }

  let role = 'spectator';
  if (token && room.player1?.id === token) role = 'player1';
  else if (token && room.player2?.id === token) role = 'player2';

  return res.json({
    success: true,
    role: role,
    room: sanitizeRoomForPlayer(room, role)
  });
});

// 4. Set Secret via REST
app.post('/api/multiplayer/room/secret', (req, res) => {
  const roomId = normalizeDigits(req.body.roomId);
  const token = req.body.token || req.headers['x-player-token'];
  const secret = normalizeDigits(req.body.secret);
  const room = multiplayerRooms.get(roomId);

  if (!room) {
    return res.status(404).json({ success: false, error: 'الغرفة غير موجودة' });
  }

  let player = null;
  let role = null;
  if (room.player1?.id === token) { player = room.player1; role = 'player1'; }
  else if (room.player2?.id === token) { player = room.player2; role = 'player2'; }

  if (!player) {
    return res.status(403).json({ success: false, error: 'غير مصرح لك في هذه الغرفة' });
  }

  if (secret.length !== room.digits) {
    return res.status(400).json({ success: false, error: `يجب أن تتكون الشفرة من ${room.digits} أرقام!` });
  }

  player.secret = secret;
  player.ready = true;
  room.lastActivity = Date.now();

  if (room.player1?.ready && room.player2?.ready) {
    room.status = 'playing';
    broadcastToRoom(room, {
      type: 'game_started',
      message: '🚀 تم قفل الشفرات السرية! بدأت المواجهة المباشرة الآن، خمن شفرة منافسك!'
    });
  } else {
    broadcastToRoom(room, {
      type: 'secret_locked',
      message: `${player.name} قفل شفرته السرية! في انتظار الطرف الآخر...`
    });
  }

  return res.json({
    success: true,
    room: sanitizeRoomForPlayer(room, role)
  });
});

// 5. Submit Guess via REST
app.post('/api/multiplayer/room/guess', (req, res) => {
  const roomId = normalizeDigits(req.body.roomId);
  const token = req.body.token || req.headers['x-player-token'];
  const guess = normalizeDigits(req.body.guess);
  const room = multiplayerRooms.get(roomId);

  if (!room || room.status !== 'playing') {
    return res.status(400).json({ success: false, error: 'اللعبة ليست جارية حالياً' });
  }

  let player = null;
  let opponent = null;
  let role = null;

  if (room.player1?.id === token) {
    player = room.player1;
    opponent = room.player2;
    role = 'player1';
  } else if (room.player2?.id === token) {
    player = room.player2;
    opponent = room.player1;
    role = 'player2';
  }

  if (!player || !opponent || !opponent.secret) {
    return res.status(403).json({ success: false, error: 'بيانات التحدي غير مكتملة' });
  }

  if (guess.length !== room.digits) {
    return res.status(400).json({ success: false, error: `التخمين يجب أن يتكون من ${room.digits} أرقام!` });
  }

  const evalResult = evaluateMastermind(guess, opponent.secret, room.digits);
  const guessRecord = {
    attemptNumber: player.guesses.length + 1,
    guess: guess.split(''),
    clues: evalResult.clues,
    greens: evalResult.greens,
    yellows: evalResult.yellows,
    timestamp: Date.now()
  };

  player.guesses.push(guessRecord);
  room.lastActivity = Date.now();

  if (evalResult.greens === room.digits) {
    player.won = true;
    room.status = 'game_over';
    room.winner = role;

    broadcastToRoom(room, {
      type: 'game_over',
      winner: role,
      winnerName: player.name,
      message: `🎉 فاز ${player.name} بفك الشفرة السرية أولاً في ${player.guesses.length} محاولات!`
    });
  } else {
    broadcastToRoom(room, {
      type: 'guess_recorded',
      whoGuessed: role,
      whoGuessedName: player.name
    });
  }

  return res.json({
    success: true,
    room: sanitizeRoomForPlayer(room, role),
    won: evalResult.greens === room.digits
  });
});

// 6. Chat / Taunt via REST
app.post('/api/multiplayer/room/taunt', (req, res) => {
  const roomId = normalizeDigits(req.body.roomId);
  const token = req.body.token || req.headers['x-player-token'];
  const room = multiplayerRooms.get(roomId);
  if (!room) return res.status(404).json({ success: false });

  let senderName = 'لاعب';
  let role = 'spectator';
  if (room.player1?.id === token) { senderName = room.player1.name; role = 'player1'; }
  else if (room.player2?.id === token) { senderName = room.player2.name; role = 'player2'; }

  room.lastReaction = {
    sender: senderName,
    role: role,
    emoji: req.body.emoji || '🔥',
    text: req.body.text || '',
    time: Date.now()
  };

  broadcastToRoom(room, {
    type: 'chat_reaction',
    sender: senderName,
    role: role,
    emoji: req.body.emoji || '🔥',
    text: req.body.text || ''
  });

  res.json({ success: true });
});

// 7. Rematch via REST
app.post('/api/multiplayer/room/rematch', (req, res) => {
  const roomId = normalizeDigits(req.body.roomId);
  const room = multiplayerRooms.get(roomId);
  if (!room) return res.status(404).json({ success: false });

  room.status = 'setup';
  room.winner = null;
  room.lastReaction = null;
  if (room.player1) {
    room.player1.secret = null;
    room.player1.guesses = [];
    room.player1.won = false;
    room.player1.ready = false;
  }
  if (room.player2) {
    room.player2.secret = null;
    room.player2.guesses = [];
    room.player2.won = false;
    room.player2.ready = false;
  }
  room.lastActivity = Date.now();

  broadcastToRoom(room, {
    type: 'rematch_accepted',
    message: '🔄 تم بدء جولة جديدة! اختاروا شفراتكم السرية مرة أخرى.'
  });

  res.json({ success: true, room: sanitizeRoomForPlayer(room, 'player1') });
});

// 8. Public Room Info
app.get('/api/multiplayer/room/:id', (req, res) => {
  const roomId = normalizeDigits(req.params.id);
  const room = multiplayerRooms.get(roomId);
  if (!room) {
    return res.json({ exists: false });
  }
  return res.json({
    exists: true,
    id: room.id,
    status: room.status,
    player1Name: room.player1?.name,
    hasPlayer2: !!room.player2,
    digits: room.digits
  });
});

// ----------------------------------------------------
// WEBSOCKET SERVER (Instant real-time updates)
// ----------------------------------------------------
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let boundRoomId = null;
  let boundToken = null;
  let boundRole = null;

  // Setup ping/pong
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      // Ping
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }

      // AUTH / RECONNECT
      if (data.type === 'auth') {
        const roomId = normalizeDigits(data.roomId);
        const token = data.token;
        const room = multiplayerRooms.get(roomId);
        if (room && token) {
          if (room.player1?.id === token) {
            room.player1.ws = ws;
            boundRoomId = roomId;
            boundToken = token;
            boundRole = 'player1';
            ws.send(JSON.stringify({
              type: 'authenticated',
              role: 'player1',
              roomId: roomId,
              room: sanitizeRoomForPlayer(room, 'player1')
            }));
          } else if (room.player2?.id === token) {
            room.player2.ws = ws;
            boundRoomId = roomId;
            boundToken = token;
            boundRole = 'player2';
            ws.send(JSON.stringify({
              type: 'authenticated',
              role: 'player2',
              roomId: roomId,
              room: sanitizeRoomForPlayer(room, 'player2')
            }));
          }
        }
        return;
      }

      // CREATE ROOM
      if (data.type === 'create_room') {
        const roomId = generateRoomId();
        const playerName = (data.playerName || 'القائد').trim().slice(0, 20);
        const digits = parseInt(data.digits, 10) || 4;
        const token = crypto.randomUUID();

        const room = {
          id: roomId,
          digits: digits,
          status: 'waiting',
          player1: {
            id: token,
            ws: ws,
            name: playerName,
            secret: null,
            guesses: [],
            won: false,
            ready: false
          },
          player2: null,
          winner: null,
          createdAt: Date.now(),
          lastActivity: Date.now()
        };

        multiplayerRooms.set(roomId, room);
        boundRoomId = roomId;
        boundToken = token;
        boundRole = 'player1';

        ws.send(JSON.stringify({
          type: 'room_created',
          roomId: roomId,
          playerToken: token,
          role: 'player1',
          room: sanitizeRoomForPlayer(room, 'player1')
        }));
        return;
      }

      // JOIN ROOM
      if (data.type === 'join_room') {
        const roomId = normalizeDigits(data.roomId);
        const playerName = (data.playerName || 'المتحدي').trim().slice(0, 20);
        const room = multiplayerRooms.get(roomId);

        if (!room) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `الغرفة #${roomId} غير موجودة أو انتهت صلاحيتها! ⚠️`
          }));
          return;
        }

        if (room.player2 && room.player2.ws && room.player2.ws.readyState === WebSocket.OPEN && room.player2.id !== data.token) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'الغرفة ممتلئة بالفعل باثنين من اللاعبين! ⚠️'
          }));
          return;
        }

        const token = data.token || crypto.randomUUID();
        room.player2 = {
          id: token,
          ws: ws,
          name: playerName,
          secret: null,
          guesses: [],
          won: false,
          ready: false
        };
        room.status = 'setup';
        room.lastActivity = Date.now();

        boundRoomId = roomId;
        boundToken = token;
        boundRole = 'player2';

        ws.send(JSON.stringify({
          type: 'joined_room',
          roomId: roomId,
          playerToken: token,
          role: 'player2',
          room: sanitizeRoomForPlayer(room, 'player2')
        }));

        broadcastToRoom(room, {
          type: 'room_ready_for_setup',
          message: `انضم ${playerName}! الآن اختاروا أرقامكم السرية لمنافسكم 🔐`
        });
        return;
      }

      // SET SECRET
      if (data.type === 'set_secret') {
        const roomId = normalizeDigits(data.roomId || boundRoomId);
        const secret = normalizeDigits(data.secret);
        const room = multiplayerRooms.get(roomId);
        if (!room) return;

        const player = (boundRole === 'player1' || room.player1?.id === boundToken) ? room.player1 : room.player2;
        if (!player) return;

        if (secret.length !== room.digits) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `يجب أن تتكون الشفرة من ${room.digits} أرقام!`
          }));
          return;
        }

        player.secret = secret;
        player.ready = true;
        room.lastActivity = Date.now();

        if (room.player1?.ready && room.player2?.ready) {
          room.status = 'playing';
          broadcastToRoom(room, {
            type: 'game_started',
            message: '🚀 تم قفل الشفرات السرية! بدأت المواجهة المباشرة الآن، خمن شفرة منافسك!'
          });
        } else {
          broadcastToRoom(room, {
            type: 'secret_locked',
            message: `${player.name} قفل شفرته السرية! في انتظار الطرف الآخر...`
          });
        }
        return;
      }

      // SUBMIT GUESS
      if (data.type === 'submit_guess') {
        const roomId = normalizeDigits(data.roomId || boundRoomId);
        const guess = normalizeDigits(data.guess);
        const room = multiplayerRooms.get(roomId);
        if (!room || room.status !== 'playing') return;

        const isP1 = (boundRole === 'player1' || room.player1?.id === boundToken);
        const player = isP1 ? room.player1 : room.player2;
        const opponent = isP1 ? room.player2 : room.player1;
        const role = isP1 ? 'player1' : 'player2';

        if (!player || !opponent || !opponent.secret) return;

        if (guess.length !== room.digits) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `التخمين يجب أن يتكون من ${room.digits} أرقام!`
          }));
          return;
        }

        const evalResult = evaluateMastermind(guess, opponent.secret, room.digits);
        const guessRecord = {
          attemptNumber: player.guesses.length + 1,
          guess: guess.split(''),
          clues: evalResult.clues,
          greens: evalResult.greens,
          yellows: evalResult.yellows,
          timestamp: Date.now()
        };

        player.guesses.push(guessRecord);
        room.lastActivity = Date.now();

        if (evalResult.greens === room.digits) {
          player.won = true;
          room.status = 'game_over';
          room.winner = role;

          broadcastToRoom(room, {
            type: 'game_over',
            winner: role,
            winnerName: player.name,
            message: `🎉 فاز ${player.name} بفك الشفرة السرية أولاً في ${player.guesses.length} محاولات!`
          });
        } else {
          broadcastToRoom(room, {
            type: 'guess_recorded',
            whoGuessed: role,
            whoGuessedName: player.name
          });
        }
        return;
      }

      // CHAT / REACTION
      if (data.type === 'chat_reaction') {
        const roomId = normalizeDigits(data.roomId || boundRoomId);
        const room = multiplayerRooms.get(roomId);
        if (!room) return;

        const isP1 = (boundRole === 'player1' || room.player1?.id === boundToken);
        const senderName = isP1 ? room.player1?.name : room.player2?.name;
        const role = isP1 ? 'player1' : 'player2';

        broadcastToRoom(room, {
          type: 'chat_reaction',
          sender: senderName,
          role: role,
          emoji: data.emoji || '🔥',
          text: data.text || ''
        });
        return;
      }

      // REMATCH
      if (data.type === 'rematch') {
        const roomId = normalizeDigits(data.roomId || boundRoomId);
        const room = multiplayerRooms.get(roomId);
        if (!room) return;

        room.status = 'setup';
        room.winner = null;
        if (room.player1) {
          room.player1.secret = null;
          room.player1.guesses = [];
          room.player1.won = false;
          room.player1.ready = false;
        }
        if (room.player2) {
          room.player2.secret = null;
          room.player2.guesses = [];
          room.player2.won = false;
          room.player2.ready = false;
        }

        broadcastToRoom(room, {
          type: 'rematch_accepted',
          message: '🔄 تم بدء جولة جديدة! اختاروا شفراتكم السرية مرة أخرى.'
        });
        return;
      }

    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    // Graceful disconnect: do NOT destroy room immediately
    if (boundRoomId && multiplayerRooms.has(boundRoomId)) {
      const room = multiplayerRooms.get(boundRoomId);
      if (room) {
        // Clean up empty rooms after 30 minutes of inactivity
        setTimeout(() => {
          const r = multiplayerRooms.get(boundRoomId);
          if (r && Date.now() - r.lastActivity > 1800000) {
            multiplayerRooms.delete(boundRoomId);
          }
        }, 1800000);
      }
    }
  });
});

// Heartbeat Interval to keep connections alive through Cloud Run & Proxies
setInterval(() => {
  wss.clients.forEach((ws) => {
    if (ws.isAlive === false) return ws.terminate();
    ws.isAlive = false;
    ws.ping();
  });
}, 20000);

// ----------------------------------------------------
// STATIC & ROUTE HANDLING
// ----------------------------------------------------

// Serve static assets from root and src directory
app.use('/src', express.static(path.join(__dirname, 'src')));
app.use(express.static(__dirname, {
  extensions: ['html'],
  index: 'index.html'
}));

// Route Aliases
app.get(['/admin', '/dashboard', '/control'], (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

app.get(['/mastermind', '/cipher', '/code-breaker', '/master-mind', '/shafra'], (req, res) => {
  res.sendFile(path.join(__dirname, 'mastermind.html'));
});

app.get(['/guess', '/guess-number', '/number', '/a3ref-el-rakam'], (req, res) => {
  res.sendFile(path.join(__dirname, 'guess-number.html'));
});

// Fallback to index.html for root path
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server and WebSocket running on http://0.0.0.0:${PORT}`);
});
