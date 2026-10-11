import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
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

// Helper to clean expired sessions (older than 24h)
function cleanSessions() {
  const now = Date.now();
  for (const [token, data] of activeSessions.entries()) {
    if (now - data.createdAt > 24 * 60 * 60 * 1000) {
      activeSessions.delete(token);
    }
  }
}

// Auth middleware for protected admin routes
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

// Admin Login
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

// Verify Current Token
app.get('/api/admin/verify', (req, res) => {
  cleanSessions();
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];

  if (token && activeSessions.has(token)) {
    return res.json({ success: true, authenticated: true });
  }
  return res.json({ success: false, authenticated: false });
});

// Change Admin Password in Database
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

  // Verify current password if provided
  if (currentPassword && currentPassword !== storedPassword) {
    return res.status(400).json({
      success: false,
      error: 'كلمة السر الحالية غير صحيحة!'
    });
  }

  // Update password in database
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

// Get Settings
app.get('/api/admin/settings', (req, res) => {
  const db = readDB();
  res.json({
    success: true,
    settings: db.settings || {},
    updatedAt: db.admin?.updatedAt
  });
});

// Update Settings
app.post('/api/admin/settings', requireAdminAuth, (req, res) => {
  const db = readDB();
  db.settings = Object.assign({}, db.settings, req.body.settings || {});
  writeDB(db);
  res.json({ success: true, message: 'تم حفظ إعدادات المجرة بنجاح!' });
});

// Admin Logout
app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-admin-token'];
  if (token) {
    activeSessions.delete(token);
  }
  res.json({ success: true, message: 'تم تسجيل الخروج.' });
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
