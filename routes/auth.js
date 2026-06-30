const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const { body, validationResult } = require('express-validator');
const { dbGet, dbRun } = require('../db');

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized. Please log in.' });
}

// Middleware validation error handler
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array().map(e => e.msg).join('. ') });
  }
  next();
};

// Validation rules
const registerValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Username must be between 3 and 20 characters')
    .isAlphanumeric().withMessage('Username must contain only letters and numbers'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
];

const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
];

/**
 * Register a new user
 */
router.post('/register', registerValidation, validate, async (req, res) => {
  const { username, password } = req.body;
  
  try {
    // Check if user already exists (parameterized query)
    const existingUser = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existingUser) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Hash the password securely (rounds = 12)
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Save user to the database (parameterized query)
    await dbRun(
      'INSERT INTO users (username, password_hash) VALUES (?, ?)',
      [username, passwordHash]
    );

    res.status(201).json({ success: true, message: 'Registration successful! You can now log in.' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'An error occurred during registration. Please try again.' });
  }
});

/**
 * Log in user
 */
router.post('/login', loginValidation, validate, async (req, res) => {
  const { username, password } = req.body;

  try {
    // Retrieve user by username (parameterized query)
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    
    // Check if user exists and verify password hash
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      // Use generic error message to prevent username harvesting/enumeration
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check if user has 2FA enabled
    if (user.two_factor_enabled && user.two_factor_secret) {
      // Set temporary state in session and prompt for 2FA
      req.session.tempUserId = user.id;
      return res.json({ require2FA: true, message: 'Two-factor authentication code required.' });
    }

    // Normal session establishment
    req.session.userId = user.id;
    res.json({
      success: true,
      user: {
        username: user.username,
        twoFactorEnabled: false
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'An error occurred during login. Please try again.' });
  }
});

/**
 * Validate 2FA code during login
 */
router.post('/2fa/validate', async (req, res) => {
  const { code } = req.body;
  const tempUserId = req.session.tempUserId;

  if (!tempUserId) {
    return res.status(400).json({ error: 'Session expired or invalid login attempt. Please log in again.' });
  }

  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'A 6-digit verification code is required.' });
  }

  try {
    // Retrieve user (parameterized query)
    const user = await dbGet('SELECT * FROM users WHERE id = ?', [tempUserId]);
    if (!user || !user.two_factor_secret) {
      return res.status(400).json({ error: 'Invalid authentication state.' });
    }

    // Verify code
    const isVerified = authenticator.verify({
      token: code,
      secret: user.two_factor_secret
    });

    if (isVerified) {
      // Fully establish session
      req.session.userId = user.id;
      delete req.session.tempUserId;
      
      res.json({
        success: true,
        user: {
          username: user.username,
          twoFactorEnabled: true
        }
      });
    } else {
      res.status(401).json({ error: 'Invalid verification code. Please try again.' });
    }
  } catch (error) {
    console.error('2FA validation error:', error);
    res.status(500).json({ error: 'An error occurred during 2FA validation.' });
  }
});

/**
 * Retrieve current logged-in user profile status
 */
router.get('/me', async (req, res) => {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const user = await dbGet('SELECT username, two_factor_enabled FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      username: user.username,
      twoFactorEnabled: !!user.two_factor_enabled
    });
  } catch (error) {
    console.error('Error fetching user status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Setup 2FA: Generate secret & QR Code
 */
router.post('/2fa/setup', isAuthenticated, async (req, res) => {
  try {
    const user = await dbGet('SELECT username, two_factor_enabled FROM users WHERE id = ?', [req.session.userId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.two_factor_enabled) {
      return res.status(400).json({ error: '2FA is already enabled.' });
    }

    // Generate secret and service parameters
    const secret = authenticator.generateSecret();
    const service = 'SecureLoginSystem';
    const otpauth = authenticator.keyuri(user.username, service, secret);
    
    // Generate QR code data URI
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Save secret temporarily in session
    req.session.tempSecret = secret;

    res.json({
      qrCodeUrl,
      secret // Provide secret key for manual entry
    });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ error: 'Failed to initiate 2FA setup.' });
  }
});

/**
 * Verify 2FA code and enable 2FA
 */
router.post('/2fa/verify', isAuthenticated, async (req, res) => {
  const { code } = req.body;
  const tempSecret = req.session.tempSecret;

  if (!tempSecret) {
    return res.status(400).json({ error: '2FA setup was not initiated. Please request setup first.' });
  }

  if (!code || code.length !== 6) {
    return res.status(400).json({ error: 'A 6-digit code is required.' });
  }

  try {
    // Verify code
    const isVerified = authenticator.verify({
      token: code,
      secret: tempSecret
    });

    if (isVerified) {
      // Save secret to database and enable 2FA (parameterized query)
      await dbRun(
        'UPDATE users SET two_factor_secret = ?, two_factor_enabled = 1 WHERE id = ?',
        [tempSecret, req.session.userId]
      );

      delete req.session.tempSecret;
      res.json({ success: true, message: 'Two-factor authentication successfully enabled!' });
    } else {
      res.status(400).json({ error: 'Invalid code. Verification failed.' });
    }
  } catch (error) {
    console.error('2FA verification error:', error);
    res.status(500).json({ error: 'An error occurred during 2FA verification.' });
  }
});

/**
 * Disable 2FA
 */
router.post('/2fa/disable', isAuthenticated, async (req, res) => {
  try {
    // Disable 2FA in DB (parameterized query)
    await dbRun(
      'UPDATE users SET two_factor_secret = NULL, two_factor_enabled = 0 WHERE id = ?',
      [req.session.userId]
    );

    res.json({ success: true, message: 'Two-factor authentication has been disabled.' });
  } catch (error) {
    console.error('Disable 2FA error:', error);
    res.status(500).json({ error: 'Failed to disable Two-factor authentication.' });
  }
});

/**
 * Log out user
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destruction error:', err);
      return res.status(500).json({ error: 'Failed to log out.' });
    }
    res.clearCookie('connect.sid'); // default cookie name for express-session
    res.json({ success: true, message: 'Successfully logged out.' });
  });
});

module.exports = router;
