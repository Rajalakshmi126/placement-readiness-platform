const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('../config/db');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: 465,
  secure: true,

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  },

  connectionTimeout: 15000,
  greetingTimeout: 15000,
  socketTimeout: 15000
});

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, branch, graduationYear } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        error: 'name, email and password are required.'
      });
    }

    const [existing] = await pool.query(
      'SELECT id FROM users WHERE email=?',
      [email]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, branch, graduation_year)
       VALUES (?, ?, ?, ?, ?)`,
      [
        name,
        email,
        passwordHash,
        branch || null,
        graduationYear || null
      ]
    );

    const token = jwt.sign(
      {
        id: result.insertId,
        name,
        email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    res.status(201).json({
      token,
      user: {
        id: result.insertId,
        name,
        email
      }
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Registration failed.'
    });
  }
});


// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'email and password are required.'
      });
    }

    const [rows] = await pool.query(
      'SELECT * FROM users WHERE email=?',
      [email]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const user = rows[0];

    const valid = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!valid) {
      return res.status(401).json({
        error: 'Invalid email or password.'
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        name: user.name,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: '7d'
      }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });

  } catch (err) {
    console.error(err);

    res.status(500).json({
      error: 'Login failed.'
    });
  }
});


// ====================================================
// FORGOT PASSWORD
// ====================================================

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required.'
      });
    }

    const [users] = await pool.query(
      'SELECT id, email FROM users WHERE email=?',
      [email]
    );

    /*
     * Do not reveal whether the email exists.
     * This prevents account enumeration.
     */
    if (users.length === 0) {
      return res.json({
        message:
          'If an account exists for this email, a password reset link has been created.'
      });
    }

    const user = users[0];

    // Remove previous unused reset tokens
    await pool.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ?
       AND used_at IS NULL`,
      [user.id]
    );

    // Generate secure random token
    const rawToken =
      crypto.randomBytes(32).toString('hex');

    // Store only the hash of the token
    const tokenHash =
      crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    // Token expires in 30 minutes
    const expiresAt =
      new Date(Date.now() + 30 * 60 * 1000);

    await pool.query(
      `INSERT INTO password_reset_tokens
       (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [
        user.id,
        tokenHash,
        expiresAt
      ]
    );

    /*
     * For development/testing we return the reset link.
     *
     * In production, this link should be sent
     * through your email provider instead.
     */
    const resetLink =
  `${process.env.RESET_URL || 'http://localhost:5000'}/pages/reset-password.html?token=${rawToken}`;

console.log('');
console.log('======================================');
console.log('PASSWORD RESET LINK');
console.log(resetLink);
console.log('======================================');
console.log('');


// ==========================================
// SEND RESET EMAIL
// ==========================================

await transporter.sendMail({
  from: `"Placement Readiness" <${process.env.EMAIL_USER}>`,
  to: user.email,
  subject: 'Password Reset - Placement Readiness',

  text:
`Hello,

We received a request to reset your Placement Readiness account password.

Use the following link to create a new password:

${resetLink}

This link will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
Placement Readiness Team`,

  html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 30px;">

      <h2>Placement Readiness</h2>

      <h3>Password Reset</h3>

      <p>Hello,</p>

      <p>
        We received a request to reset your Placement Readiness
        account password.
      </p>

      <p>
        Click the button below to create a new password:
      </p>

      <p>
        <a
          href="${resetLink}"
          style="
            display:inline-block;
            padding:12px 20px;
            background:#ffb32c;
            color:#000;
            text-decoration:none;
            border-radius:6px;
            font-weight:bold;
          "
        >
          Reset Password
        </a>
      </p>

      <p>
        Or copy this link into your browser:
      </p>

      <p>
        ${resetLink}
      </p>

      <p>
        This link will expire in <strong>30 minutes</strong>.
      </p>

      <p>
        If you did not request a password reset, you can safely ignore
        this email.
      </p>

      <p>
        Regards,<br>
        Placement Readiness Team
      </p>

    </div>
  `
});

console.log('Password reset email sent to:', user.email);

res.json({
  message:
    'If an account exists for this email, a password reset link has been sent.'
});
  } catch (err) {
    console.error('FORGOT PASSWORD ERROR:', err);

    res.status(500).json({
      error: 'Unable to process password reset request.'
    });
  }
});

// ====================================================
// FORGOT PASSWORD
// ====================================================

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req, res) => {
  try {

    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: 'Email is required.'
      });
    }

    // Find user
    const [users] = await pool.query(
      'SELECT id, name, email FROM users WHERE email=?',
      [email]
    );

    /*
     * Do not reveal whether the email exists.
     */
    if (users.length === 0) {
      return res.json({
        message:
          'If an account exists for this email, a password reset link has been sent.'
      });
    }

    const user = users[0];

    // ------------------------------------------------
    // Remove old unused reset tokens
    // ------------------------------------------------

    await pool.query(
      `DELETE FROM password_reset_tokens
       WHERE user_id = ?
       AND used_at IS NULL`,
      [user.id]
    );

    // ------------------------------------------------
    // Generate secure random token
    // ------------------------------------------------

    const rawToken =
      crypto.randomBytes(32).toString('hex');

    // ------------------------------------------------
    // Hash token before storing in database
    // ------------------------------------------------

    const tokenHash =
      crypto
        .createHash('sha256')
        .update(rawToken)
        .digest('hex');

    // ------------------------------------------------
    // Token expires after 30 minutes
    // ------------------------------------------------

    const expiresAt =
      new Date(Date.now() + 30 * 60 * 1000);

    // ------------------------------------------------
    // Save token
    // ------------------------------------------------

    await pool.query(
      `INSERT INTO password_reset_tokens
       (user_id, token_hash, expires_at)
       VALUES (?, ?, ?)`,
      [
        user.id,
        tokenHash,
        expiresAt
      ]
    );

    // ------------------------------------------------
    // Generate reset link
    // ------------------------------------------------

    const appUrl =
      process.env.APP_URL || 'http://localhost:5000';

    const resetLink =
      `${appUrl}/pages/reset-password.html?token=${encodeURIComponent(rawToken)}`;

    console.log('');
    console.log('======================================');
    console.log('PASSWORD RESET LINK');
    console.log(resetLink);
    console.log('======================================');
    console.log('');

    // ------------------------------------------------
    // Send email
    // ------------------------------------------------

    await transporter.sendMail({
      from: `"Placement Readiness" <${process.env.EMAIL_USER}>`,
      to: user.email,
      subject: 'Reset your Placement Readiness password',

      text:
`Hello ${user.name || 'User'},

We received a request to reset your Placement Readiness password.

Use the link below to reset your password:

${resetLink}

This link will expire in 30 minutes.

If you did not request a password reset, you can safely ignore this email.

Regards,
Placement Readiness Team`,

      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">

          <h2>Password Reset</h2>

          <p>
            Hello ${user.name || 'User'},
          </p>

          <p>
            We received a request to reset your
            Placement Readiness password.
          </p>

          <p>
            Click the button below to reset your password:
          </p>

          <p>
            <a
              href="${resetLink}"
              style="
                display:inline-block;
                padding:12px 20px;
                background:#ffb02e;
                color:#000;
                text-decoration:none;
                border-radius:6px;
                font-weight:bold;
              "
            >
              Reset Password
            </a>
          </p>

          <p>
            Or copy this link into your browser:
          </p>

          <p>
            ${resetLink}
          </p>

          <p>
            <strong>This link expires in 30 minutes.</strong>
          </p>

          <p>
            If you did not request a password reset,
            you can safely ignore this email.
          </p>

          <p>
            Regards,<br>
            Placement Readiness Team
          </p>

        </div>
      `
    });

    // ------------------------------------------------
    // Success response
    // ------------------------------------------------

    res.json({
      message:
        'If an account exists for this email, a password reset link has been sent.'
    });

  } catch (err) {

    console.error('FORGOT PASSWORD ERROR:', err);

    res.status(500).json({
      error: 'Unable to process password reset request.'
    });
  }
});
module.exports = router;