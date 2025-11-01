require('dotenv').config();
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const { db, initializeDatabase } = require('./database-postgres');

const JWT_SECRET = process.env.JWT_SECRET || 'fineclem_expense_tracker_secret_key_2024_production';

// Log JWT secret status (without revealing the actual secret)
console.log('JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
console.log('JWT_SECRET source:', process.env.JWT_SECRET ? 'Environment variable' : 'Default fallback');
console.log('JWT_SECRET length:', JWT_SECRET.length);

const app = express();
app.use(cors());
app.use(express.json());

// Initialize database
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

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

app.get('/expenses', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'expenses.html'));
});

// JWT token generation
function generateToken(user) {
  return jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '30d' });
}

// Authentication middleware
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    console.log('Auth middleware: Missing authorization header');
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const parts = auth.split(' ');
  if (parts.length !== 2) {
    console.log('Auth middleware: Invalid authorization header format');
    return res.status(401).json({ error: 'Invalid authorization header' });
  }
  
  const token = parts[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    console.log('Auth middleware: Token verified for user:', payload.email);
    next();
  } catch (err) {
    console.log('Auth middleware: Token verification failed:', err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    return res.status(401).json({ error: 'Token verification failed' });
  }
}

// API Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    console.log('Signup attempt for:', name, email.toLowerCase());

    const hashed = bcrypt.hashSync(password, 10);
    
    const userId = await db.insert(
      'INSERT INTO users (name, email, password) VALUES ($1, $2, $3)',
      [name, email.toLowerCase(), hashed]
    );

    const user = { id: userId, name, email: email.toLowerCase() };
    const token = generateToken(user);
    console.log('Signup successful for user:', user.email);
    res.json({ token, user });
    
  } catch (err) {
    console.error('Database error during signup:', err.message);
    if (err.code === '23505') { // PostgreSQL unique violation
      return res.status(400).json({ error: 'Email already in use' });
    }
    return res.status(500).json({ error: 'Database connection error. Please try again.' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    console.log('Login attempt for email:', email.toLowerCase());

    const row = await db.get('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    
    if (!row) {
      console.log('User not found:', email.toLowerCase());
      console.log('DEBUG: Checking all users in database...');
      const allUsers = await db.all('SELECT email FROM users');
      console.log('DEBUG: All users in database:', allUsers.map(u => u.email));
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
    
  } catch (err) {
    console.error('Database error during login:', err.message);
    return res.status(500).json({ error: 'Database connection error. Please try again.' });
  }
});

app.get('/api/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

// Simple health check with user count
app.get('/api/health', async (req, res) => {
  try {
    const result = await db.get('SELECT COUNT(*) as count FROM users');
    res.json({ 
      status: 'ok', 
      userCount: parseInt(result.count),
      database: 'PostgreSQL',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// Debug endpoint to check users (remove in production)
app.get('/api/debug/users', async (req, res) => {
  try {
    const users = await db.all('SELECT id, name, email, created_at FROM users');
    res.json({ users, count: users.length, database: 'PostgreSQL' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Expenses endpoints
app.post('/api/expenses', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    let { amount, category, note, date } = req.body;
    if (!amount) return res.status(400).json({ error: 'Amount required' });
    
    amount = parseFloat(amount);
    if (!date) date = new Date().toISOString().slice(0, 10);
    
    const expenseId = await db.insert(
      'INSERT INTO expenses (user_id, amount, category, note, date) VALUES ($1, $2, $3, $4, $5)',
      [userId, amount, category || 'Other', note || '', date]
    );
    
    res.json({ id: expenseId, user_id: userId, amount, category, note, date });
  } catch (err) {
    console.error('Error adding expense:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.get('/api/expenses/list', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const expenses = await db.all(
      'SELECT * FROM expenses WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [userId]
    );
    res.json(expenses);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Budget endpoints
app.get('/api/budget', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    let budget = await db.get('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    
    if (!budget) {
      // Create default budget
      const budgetId = await db.insert(
        'INSERT INTO budgets (user_id) VALUES ($1)',
        [userId]
      );
      budget = await db.get('SELECT * FROM budgets WHERE id = $1', [budgetId]);
    }
    
    res.json(budget);
  } catch (err) {
    console.error('Error fetching budget:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

app.put('/api/budget', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { monthly_budget, weekly_budget, daily_budget } = req.body;
    
    // Check if budget exists
    const existingBudget = await db.get('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    
    if (existingBudget) {
      // Update existing budget
      await db.query(
        'UPDATE budgets SET monthly_budget = $1, weekly_budget = $2, daily_budget = $3, updated_at = CURRENT_TIMESTAMP WHERE user_id = $4',
        [monthly_budget, weekly_budget, daily_budget, userId]
      );
    } else {
      // Create new budget
      await db.insert(
        'INSERT INTO budgets (user_id, monthly_budget, weekly_budget, daily_budget) VALUES ($1, $2, $3, $4)',
        [userId, monthly_budget, weekly_budget, daily_budget]
      );
    }
    
    const budget = await db.get('SELECT * FROM budgets WHERE user_id = $1', [userId]);
    res.json(budget);
  } catch (err) {
    console.error('Error updating budget:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Reports endpoint
app.get('/api/reports', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const period = req.query.period || 'daily';
    
    let groupBy, dateFormat;
    switch (period) {
      case 'weekly':
        groupBy = 'EXTRACT(YEAR FROM date), EXTRACT(WEEK FROM date)';
        dateFormat = 'EXTRACT(YEAR FROM date) || \'-W\' || EXTRACT(WEEK FROM date)';
        break;
      case 'monthly':
        groupBy = 'EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)';
        dateFormat = 'EXTRACT(YEAR FROM date) || \'-\' || LPAD(EXTRACT(MONTH FROM date)::text, 2, \'0\')';
        break;
      default: // daily
        groupBy = 'date';
        dateFormat = 'date::text';
    }
    
    const reports = await db.all(`
      SELECT ${dateFormat} as period, SUM(amount) as total 
      FROM expenses 
      WHERE user_id = $1 
      GROUP BY ${groupBy} 
      ORDER BY date DESC 
      LIMIT 10
    `, [userId]);
    
    res.json(reports);
  } catch (err) {
    console.error('Error fetching reports:', err);
    res.status(500).json({ error: 'Database error' });
  }
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
});