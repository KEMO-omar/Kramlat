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
// MULTIPLAYER MASTERMIND ENGINE (WebSocket & Rooms)
// ----------------------------------------------------
const multiplayerRooms = new Map();

function generateRoomId() {
  let id = '';
  do {
    id = Math.floor(1000 + Math.random() * 9000).toString();
  } while (multiplayerRooms.has(id));
  return id;
}

// Evaluate Mastermind Guess against Secret
function evaluateMastermind(guess, secret, digits = 4) {
  const secretCopy = secret.split('');
  const guessCopy = guess.split('');
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
    me: me ? {
      name: me.name,
      role: isP1 ? 'player1' : 'player2',
      hasChosenSecret: !!me.secret,
      mySecret: me.secret, // Player can see the secret they chose for their opponent
      guesses: me.guesses,
      won: me.won,
      ready: me.ready
    } : null,
    opponent: opponent ? {
      name: opponent.name,
      role: isP1 ? 'player2' : 'player1',
      hasChosenSecret: !!opponent.secret,
      // my opponent's secret is HIDDEN until game over
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
    const payload = Object.assign({}, messageObj, {
      room: sanitizeRoomForPlayer(room, 'player1')
    });
    room.player1.ws.send(JSON.stringify(payload));
  }

  if (room.player2?.ws && room.player2.ws.readyState === WebSocket.OPEN) {
    const payload = Object.assign({}, messageObj, {
      room: sanitizeRoomForPlayer(room, 'player2')
    });
    room.player2.ws.send(JSON.stringify(payload));
  }
}

// REST route to inspect room
app.get('/api/multiplayer/room/:id', (req, res) => {
  const room = multiplayerRooms.get(req.params.id);
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

// WebSocket Server
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentRole = null;

  ws.on('message', (messageRaw) => {
    try {
      const data = JSON.parse(messageRaw.toString());

      // 1. CREATE ROOM
      if (data.type === 'create_room') {
        const roomId = generateRoomId();
        const playerName = (data.playerName || 'القائد').trim().slice(0, 20);
        const digits = parseInt(data.digits, 10) || 4;

        const room = {
          id: roomId,
          digits: digits,
          status: 'waiting', // waiting for player 2
          player1: {
            id: crypto.randomUUID(),
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
        currentRoomId = roomId;
        currentRole = 'player1';

        ws.send(JSON.stringify({
          type: 'room_created',
          roomId: roomId,
          role: 'player1',
          room: sanitizeRoomForPlayer(room, 'player1')
        }));
      }

      // 2. JOIN ROOM
      else if (data.type === 'join_room') {
        const roomId = (data.roomId || '').trim();
        const playerName = (data.playerName || 'المتحدي').trim().slice(0, 20);
        const room = multiplayerRooms.get(roomId);

        if (!room) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'رقم الغرفة غير موجود أو انتهت صلاحيتها! ⚠️'
          }));
          return;
        }

        if (room.player2 && room.player2.ws && room.player2.ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: 'error',
            message: 'الغرفة ممتلئة بالفعل باثنين من اللاعبين! ⚠️'
          }));
          return;
        }

        // Join as Player 2
        room.player2 = {
          id: crypto.randomUUID(),
          ws: ws,
          name: playerName,
          secret: null,
          guesses: [],
          won: false,
          ready: false
        };
        room.status = 'setup'; // Both now set their secrets!
        room.lastActivity = Date.now();

        currentRoomId = roomId;
        currentRole = 'player2';

        // Notify both players
        broadcastToRoom(room, {
          type: 'room_ready_for_setup',
          message: `انضم ${playerName}! الآن اختاروا أرقامكم السرية لمنافسكم 🔐`
        });
      }

      // 3. SET SECRET NUMBER (Custom chosen by each player for their opponent to guess)
      else if (data.type === 'set_secret') {
        const roomId = data.roomId || currentRoomId;
        const secret = (data.secret || '').trim();
        const room = multiplayerRooms.get(roomId);

        if (!room) return;
        const player = currentRole === 'player1' ? room.player1 : room.player2;
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

        // Check if both players have set their secrets
        if (room.player1?.ready && room.player2?.ready) {
          room.status = 'playing';
          broadcastToRoom(room, {
            type: 'game_started',
            message: '🚀 تم قفل الشفرات السرية! بدأت المواجهة المباشرة الآن، خمن شفرة منافسك!'
          });
        } else {
          // Inform both of the readiness status
          broadcastToRoom(room, {
            type: 'secret_locked',
            message: `${player.name} قفل شفرته السرية! في انتظار الطرف الآخر...`
          });
        }
      }

      // 4. SUBMIT GUESS IN REAL-TIME
      else if (data.type === 'submit_guess') {
        const roomId = data.roomId || currentRoomId;
        const guess = (data.guess || '').trim();
        const room = multiplayerRooms.get(roomId);

        if (!room || room.status !== 'playing') return;

        const isP1 = currentRole === 'player1';
        const player = isP1 ? room.player1 : room.player2;
        const opponent = isP1 ? room.player2 : room.player1;

        if (!player || !opponent || !opponent.secret) return;

        if (guess.length !== room.digits) {
          ws.send(JSON.stringify({
            type: 'error',
            message: `التخمين يجب أن يتكون من ${room.digits} أرقام!`
          }));
          return;
        }

        // Evaluate guess against OPPONENT'S secret
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

        // Check if this player WON!
        if (evalResult.greens === room.digits) {
          player.won = true;
          room.status = 'game_over';
          room.winner = currentRole;

          broadcastToRoom(room, {
            type: 'game_over',
            winner: currentRole,
            winnerName: player.name,
            message: `🎉 فاز ${player.name} بفك الشفرة السرية أولاً في ${player.guesses.length} محاولات!`
          });
        } else {
          // Broadcast progress
          broadcastToRoom(room, {
            type: 'guess_recorded',
            whoGuessed: currentRole,
            whoGuessedName: player.name
          });
        }
      }

      // 5. CHAT & QUICK REACTIONS
      else if (data.type === 'chat_reaction') {
        const roomId = data.roomId || currentRoomId;
        const room = multiplayerRooms.get(roomId);
        if (!room) return;

        const senderName = currentRole === 'player1' ? room.player1?.name : room.player2?.name;
        broadcastToRoom(room, {
          type: 'chat_reaction',
          sender: senderName,
          role: currentRole,
          emoji: data.emoji || '🔥',
          text: data.text || ''
        });
      }

      // 6. REMATCH REQUEST
      else if (data.type === 'rematch') {
        const roomId = data.roomId || currentRoomId;
        const room = multiplayerRooms.get(roomId);
        if (!room) return;

        // Reset room state for rematch
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
      }

    } catch (err) {
      console.error('WebSocket message handling error:', err);
    }
  });

  ws.on('close', () => {
    if (currentRoomId && multiplayerRooms.has(currentRoomId)) {
      const room = multiplayerRooms.get(currentRoomId);
      if (room) {
        broadcastToRoom(room, {
          type: 'opponent_disconnected',
          role: currentRole,
          message: '⚠️ انقطع اتصال المنافس بالغرفة.'
        });

        // Clean up empty rooms after 10 minutes
        setTimeout(() => {
          const r = multiplayerRooms.get(currentRoomId);
          if (r && (!r.player1?.ws || r.player1.ws.readyState !== WebSocket.OPEN) &&
                   (!r.player2?.ws || r.player2.ws.readyState !== WebSocket.OPEN)) {
            multiplayerRooms.delete(currentRoomId);
          }
        }, 600000);
      }
    }
  });
});

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
