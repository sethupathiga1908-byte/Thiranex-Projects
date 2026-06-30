const express = require('express');
const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. Apply Helmet security headers with custom CSP
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"], // Required to allow QR code base64 data URIs
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// 2. Setup Rate Limiting
// Global limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests from this IP, please try again later.' }
});
app.use(globalLimiter);

// Auth rate limiter (more restrictive to prevent brute-force attacks)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // limit each IP to 20 attempts
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again after 15 minutes.' }
});

// 3. Body Parsing Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 4. Session Configuration with persistent SQLite store
const sessionStore = new SQLiteStore({
  db: 'sessions.sqlite',
  dir: __dirname,
  concurrentDb: true
});

app.use(
  session({
    store: sessionStore,
    secret: process.env.SESSION_SECRET || 'secure_login_system_session_secret_123!@#',
    resave: false,
    saveUninitialized: false,
    name: 'secure_session_id', // Avoid default 'connect.sid' to obscure tech stack
    cookie: {
      httpOnly: true, // Prevents client-side JS from reading the cookie
      secure: process.env.NODE_ENV === 'production', // true requires HTTPS
      sameSite: 'lax', // CSRF protection
      maxAge: 24 * 60 * 60 * 1000 // 24 hours expiration
    }
  })
);

// 5. Serve static files from the "public" directory
app.use(express.static(path.join(__dirname, 'public')));

// 6. Routes
app.use('/api/auth', authLimiter, authRoutes);

// Fallback to index.html for UI routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`Secure Login System running at http://localhost:${PORT}`);
  console.log(`===================================================`);
});

module.exports = server;
