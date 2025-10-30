require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const DB_DIR = process.env.NODE_ENV === 'production' 
  ? '/opt/render/project/src/data'
  : path.join(__dirname, 'data');
const DB_PATH = path.join(DB_DIR, 'db.sqlite');
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database');
});


db.configure("busyTimeout", 10000);

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`, (err) => {
    if (err) console.error('Error creating users table:', err.message);
    else console.log('Users table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, (err) => {
    if (err) console.error('Error creating expenses table:', err.message);
    else console.log('Expenses table ready');
  });

  db.run(`CREATE TABLE IF NOT EXISTS budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    monthly_budget REAL DEFAULT 1000.00,
    weekly_budget REAL DEFAULT 250.00,
    daily_budget REAL DEFAULT 35.00,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`, (err) => {
    if (err) console.error('Error creating budgets table:', err.message);
    else console.log('Budgets table ready');
  });
});

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname)));

// Route handling for SPA-like behavior
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Specific routes first
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'signup.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

// Dashboard section routes - all serve the same dashboard.html (SPA behavior)
app.get('/dashboard/expenses', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

app.get('/dashboard/budget', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

app.get('/dashboard/reports', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

app.get('/dashboard/categories', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' });
}

function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing authorization header' });
  const parts = auth.split(' ');
  if (parts.length !== 2) return res.status(401).json({ error: 'Invalid authorization header' });
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

app.post('/api/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });

  console.log('Signup attempt for:', name, email.toLowerCase());

  const hashed = bcrypt.hashSync(password, 10);
  const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
  stmt.run(name, email.toLowerCase(), hashed, function (err) {
    if (err) {
      console.error('Database error during signup:', err.message);
      if (err.message && err.message.includes('UNIQUE')) {
        return res.status(400).json({ error: 'Email already in use' });
      }
      return res.status(500).json({ error: 'Database connection error. Please try again.' });
    }

    const user = { id: this.lastID, name, email: email.toLowerCase() };
    const token = generateToken(user);
    console.log('Signup successful for user:', user.email);
    res.json({ token, user });
  });
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

  console.log('Login attempt for email:', email.toLowerCase());

  db.get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()], (err, row) => {
    if (err) {
      console.error('Database error during login:', err.message);
      return res.status(500).json({ error: 'Database connection error. Please try again.' });
    }
    if (!row) {
      console.log('User not found:', email.toLowerCase());
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    console.log('User found, checking password');
    const ok = bcrypt.compareSync(password, row.password);
    if (!ok) {
      console.log('Password mismatch for user:', email.toLowerCase());
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const user = { id: row.id, name: row.name, email: row.email };
    const token = generateToken(user);
    console.log('Login successful for user:', user.email);
    res.json({ token, user });
  });
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

app.post('/api/expenses', authMiddleware, (req, res) => {
  const userId = req.user.id;
  let { amount, category, note, date } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  amount = parseFloat(amount);
  if (!date) date = (new Date()).toISOString().slice(0, 10);
  const stmt = db.prepare('INSERT INTO expenses (user_id, amount, category, note, date) VALUES (?, ?, ?, ?, ?)');
  stmt.run(userId, amount, category || 'Other', note || '', date, function (err) {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json({ id: this.lastID, user_id: userId, amount, category, note, date });
  });
});

app.get('/api/expenses/list', authMiddleware, (req, res) => {
  const userId = req.user.id;
  db.all('SELECT id, amount, category, note, date, created_at FROM expenses WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 100', [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

// Update expense
app.put('/api/expenses/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const expenseId = req.params.id;
  let { amount, category, note, date } = req.body;

  if (!amount) return res.status(400).json({ error: 'Amount required' });
  amount = parseFloat(amount);
  if (!date) date = (new Date()).toISOString().slice(0, 10);

  // First check if expense belongs to user
  db.get('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [expenseId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Expense not found' });

    // Update the expense
    const stmt = db.prepare('UPDATE expenses SET amount = ?, category = ?, note = ?, date = ? WHERE id = ? AND user_id = ?');
    stmt.run(amount, category || 'Other', note || '', date, expenseId, userId, function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ id: expenseId, user_id: userId, amount, category, note, date });
    });
  });
});

// Delete expense
app.delete('/api/expenses/:id', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const expenseId = req.params.id;

  // First check if expense belongs to user
  db.get('SELECT id FROM expenses WHERE id = ? AND user_id = ?', [expenseId, userId], (err, row) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    if (!row) return res.status(404).json({ error: 'Expense not found' });

    // Delete the expense
    const stmt = db.prepare('DELETE FROM expenses WHERE id = ? AND user_id = ?');
    stmt.run(expenseId, userId, function (err) {
      if (err) return res.status(500).json({ error: 'DB error' });
      res.json({ message: 'Expense deleted successfully', id: expenseId });
    });
  });
});

// Get user budget
app.get('/api/budget', authMiddleware, (req, res) => {
  const userId = req.user.id;

  db.get('SELECT * FROM budgets WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      console.error('Database error getting budget:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!row) {
      // Create default budget for new user
      const stmt = db.prepare('INSERT INTO budgets (user_id, monthly_budget, weekly_budget, daily_budget) VALUES (?, ?, ?, ?)');
      stmt.run(userId, 1000.00, 250.00, 35.00, function (err) {
        if (err) {
          console.error('Error creating default budget:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }

        res.json({
          monthly_budget: 1000.00,
          weekly_budget: 250.00,
          daily_budget: 35.00
        });
      });
    } else {
      res.json({
        monthly_budget: row.monthly_budget,
        weekly_budget: row.weekly_budget,
        daily_budget: row.daily_budget
      });
    }
  });
});

// Update user budget
app.put('/api/budget', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { monthly_budget, weekly_budget, daily_budget } = req.body;

  if (!monthly_budget || !weekly_budget || !daily_budget) {
    return res.status(400).json({ error: 'All budget fields are required' });
  }

  if (monthly_budget < 0 || weekly_budget < 0 || daily_budget < 0) {
    return res.status(400).json({ error: 'Budget amounts must be positive' });
  }

  console.log('Updating budget for user:', userId, { monthly_budget, weekly_budget, daily_budget });

  // Check if budget exists
  db.get('SELECT id FROM budgets WHERE user_id = ?', [userId], (err, row) => {
    if (err) {
      console.error('Database error checking budget:', err.message);
      return res.status(500).json({ error: 'Database error' });
    }

    if (row) {
      // Update existing budget
      const stmt = db.prepare('UPDATE budgets SET monthly_budget = ?, weekly_budget = ?, daily_budget = ?, updated_at = datetime("now") WHERE user_id = ?');
      stmt.run(monthly_budget, weekly_budget, daily_budget, userId, function (err) {
        if (err) {
          console.error('Error updating budget:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }

        console.log('Budget updated successfully for user:', userId);
        res.json({ monthly_budget, weekly_budget, daily_budget });
      });
    } else {
      // Create new budget
      const stmt = db.prepare('INSERT INTO budgets (user_id, monthly_budget, weekly_budget, daily_budget) VALUES (?, ?, ?, ?)');
      stmt.run(userId, monthly_budget, weekly_budget, daily_budget, function (err) {
        if (err) {
          console.error('Error creating budget:', err.message);
          return res.status(500).json({ error: 'Database error' });
        }

        console.log('Budget created successfully for user:', userId);
        res.json({ monthly_budget, weekly_budget, daily_budget });
      });
    }
  });
});

// Reports: period = daily|weekly|monthly
app.get('/api/reports', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const period = req.query.period || 'daily';
  let sql;
  if (period === 'daily') {
    sql = `SELECT date AS period, SUM(amount) AS total FROM expenses WHERE user_id = ? GROUP BY date ORDER BY date DESC LIMIT 30`;
  } else if (period === 'weekly') {
    // week number and year
    sql = `SELECT strftime('%Y', date) AS year, strftime('%W', date) AS week, SUM(amount) AS total FROM expenses WHERE user_id = ? GROUP BY year, week ORDER BY year DESC, week DESC LIMIT 52`;
  } else if (period === 'monthly') {
    sql = `SELECT strftime('%Y-%m', date) AS period, SUM(amount) AS total FROM expenses WHERE user_id = ? GROUP BY period ORDER BY period DESC LIMIT 36`;
  } else {
    return res.status(400).json({ error: 'Invalid period' });
  }
  db.all(sql, [userId], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB error' });
    res.json(rows);
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Open http://localhost:${PORT}/ in your browser`);
});
