// controllers/userController.js
const pool    = require('../config/db');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { SECRET_KEY } = require('../config/config');

exports.register = async (req, res) => {
  const { username, password } = req.body;
  const role = 1; 
  try {
    const { rows } = await pool.query("SELECT 1 FROM users WHERE username = $1", [username]);
    if (rows.length) return res.status(400).json({ error: 'Username already exists' });

    const result = await pool.query(
      `INSERT INTO users (username, password, role_id) VALUES ($1, $2, $3) RETURNING id, username, role_id`,
      [username, password, role]
    );
    const user = result.rows[0];

    // Generate tokens immediately
    const accessToken = jwt.sign({ userId: user.id, username, role: user.role_id }, SECRET_KEY, { expiresIn: '1h' });
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7*24*60*60*1000);

    await pool.query(
      `INSERT INTO refresh_tokens(token, user_id, expires_at) VALUES ($1, $2, $3)`,
      [refreshToken, user.id, expiresAt]
    );

    res.status(201).json({
      message: 'User registered',
      user,
      token: accessToken,
      accessToken,
      refreshToken,
      role: user.role_id,
      username: user.username
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.login = async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id, username, password, role_id FROM users WHERE username = $1',
      [username]
    );
    if (!result.rows.length) return res.status(401).json({ error: 'Invalid credentials' });
    const user = result.rows[0];
    if (password !== user.password) return res.status(401).json({ error: 'Invalid credentials' });

    const accessToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role_id },
      SECRET_KEY,
      { expiresIn: '1h' }
    );
    const refreshToken = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + 7*24*60*60*1000);

    await pool.query(
      'INSERT INTO refresh_tokens(token, user_id, expires_at) VALUES ($1, $2, $3)',
      [refreshToken, user.id, expiresAt]
    );

    res.json({
      message: 'Login successful',
      token: accessToken,
      accessToken,
      refreshToken,
      role: user.role_id,
      username: user.username
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.refreshToken = async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Refresh token is required' });

  const { rows } = await pool.query(
    'SELECT user_id, expires_at FROM refresh_tokens WHERE token = $1',
    [refreshToken]
  );
  if (!rows.length) return res.status(403).json({ error: 'Invalid refresh token' });

  const { user_id, expires_at } = rows[0];
  if (new Date() > expires_at) {
    await pool.query('DELETE FROM refresh_tokens WHERE token = $1', [refreshToken]);
    return res.status(403).json({ error: 'Expired refresh token' });
  }

  const { rows: u } = await pool.query(
    'SELECT username, role_id FROM users WHERE id = $1',
    [user_id]
  );
  const payload = { userId: user_id, username: u[0].username, role: u[0].role_id };
  const accessToken = jwt.sign(payload, SECRET_KEY, { expiresIn: '1h' });

  res.json({ accessToken });
};

exports.getUsers = async (req, res) => {
  try {
    const result = await pool.query('SELECT id, username, role_id FROM users');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, role_id, is_blocked FROM users WHERE id = $1',
      [req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.updateProfile = async (req, res) => {
  const { description, avatar_url } = req.body;
  try {
    const result = await pool.query(
      'UPDATE users SET description = $1, avatar_url = $2 WHERE id = $3 RETURNING id, username, description, avatar_url, role_id',
      [description, avatar_url, req.user.userId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE users SET is_blocked = TRUE WHERE id = $1 RETURNING id, username, is_blocked',
      [parseInt(req.params.id, 10)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User blocked', user: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM users WHERE id = $1 RETURNING id',
      [parseInt(req.params.id, 10)]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'User deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};