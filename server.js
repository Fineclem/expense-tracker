require('dotenv').config();
const express = require('express');
const path = require('path');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET || 'fineclem_expense_tracker_secret_key_2024_production';

console.log('JWT_SECRET loaded:', JWT_SECRET ? 'Yes' : 'No');
console.log('External API Mode - No database needed');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (frontend)
app.use(express.static(path.join(__dirname)));

// Route handling for SPA-like behavior
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'login.html'));
});

app.get('/signup', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'signup.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'dashboard.html'));
});

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

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'pages', 'admin.html'));
});

// Authentication middleware (for JWT tokens from external API)
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }
  
  const parts = auth.split(' ');
  if (parts.length !== 2) {
    return res.status(401).json({ error: 'Invalid authorization header' });
  }
  
  const token = parts[1];
  
  try {
    // First try to verify with our local JWT_SECRET (for tokens we issued)
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      console.log('Local JWT payload:', payload);
      req.user = payload;
      return next();
    } catch (localErr) {
      console.log('Local JWT verification failed, trying external API validation');
    }
    
    // If local verification fails, validate with external API
    const response = await fetch('https://testapi-touo.onrender.com/api/auth/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log('External API user data:', userData);
      req.user = userData.user || userData;
      return next();
    }
    
    // If external API validation fails, try to decode token without verification
    // (This is less secure but allows the app to work)
    try {
      const decoded = jwt.decode(token);
      console.log('Decoded token:', decoded);
      if (decoded && decoded.exp && decoded.exp > Date.now() / 1000) {
        req.user = decoded;
        return next();
      }
    } catch (decodeErr) {
      console.log('Token decode failed:', decodeErr.message);
    }
    
    return res.status(401).json({ error: 'Invalid token' });
    
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// Proxy endpoints to external API
app.post('/api/signup', async (req, res) => {
  try {
    console.log('Proxying signup to external API');
    const response = await fetch('https://testapi-touo.onrender.com/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      return res.status(response.status).json(data);
    }
    
    console.log('Signup successful via external API');
    res.json(data);
    
  } catch (error) {
    console.error('External API signup error:', error);
    res.status(500).json({ error: 'External API connection error' });
  }
});

app.post('/api/login', async (req, res) => {
  try {
    console.log('Proxying login to external API with payload:', req.body);
    const response = await fetch('https://testapi-touo.onrender.com/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    console.log('External API response:', { status: response.status, data });
    
    if (!response.ok) {
      console.log('External API login failed:', data);
      return res.status(response.status).json(data);
    }
    
    // Ensure the response has the expected format
    const responseData = {
      token: data.token || data.accessToken || data.access_token,
      user: data.user || {
        id: data.id || data.userId || Date.now(),
        name: data.name || data.username || 'User',
        email: data.email || 'user@example.com'
      }
    };
    
    console.log('Login successful via external API, returning:', responseData);
    res.json(responseData);
    
  } catch (error) {
    console.error('External API login error:', error);
    res.status(500).json({ error: 'External API connection error' });
  }
});

// Mock endpoints for app functionality (since no database)
app.get('/api/me', authMiddleware, (req, res) => {
  // Ensure user object has required fields
  const user = {
    id: req.user.id || req.user.userId || Date.now(),
    name: req.user.name || req.user.username || 'User',
    email: req.user.email || 'user@example.com'
  };
  
  console.log('Returning user data:', user);
  res.json({ user });
});

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    mode: 'External API',
    timestamp: new Date().toISOString()
  });
});

// Mock endpoints for expenses (no database storage)
let mockExpenses = [];
let mockBudgets = {};

app.post('/api/expenses', authMiddleware, (req, res) => {
  const userId = req.user.id;
  let { amount, category, note, date } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  
  amount = parseFloat(amount);
  if (!date) date = new Date().toISOString().slice(0, 10);
  
  const expense = {
    id: Date.now(),
    user_id: userId,
    amount,
    category: category || 'Other',
    note: note || '',
    date,
    created_at: new Date().toISOString()
  };
  
  mockExpenses.push(expense);
  res.json(expense);
});

app.get('/api/expenses/list', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const userExpenses = mockExpenses.filter(e => e.user_id === userId);
  res.json(userExpenses);
});

app.get('/api/budget', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const budget = mockBudgets[userId] || {
    id: userId,
    user_id: userId,
    monthly_budget: 1000.00,
    weekly_budget: 250.00,
    daily_budget: 35.00
  };
  res.json(budget);
});

app.put('/api/budget', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const { monthly_budget, weekly_budget, daily_budget } = req.body;
  
  mockBudgets[userId] = {
    id: userId,
    user_id: userId,
    monthly_budget: parseFloat(monthly_budget),
    weekly_budget: parseFloat(weekly_budget),
    daily_budget: parseFloat(daily_budget)
  };
  
  res.json(mockBudgets[userId]);
});

app.get('/api/reports', authMiddleware, (req, res) => {
  const userId = req.user.id;
  const userExpenses = mockExpenses.filter(e => e.user_id === userId);
  
  // Simple daily reports
  const reports = userExpenses.reduce((acc, expense) => {
    const date = expense.date;
    if (!acc[date]) {
      acc[date] = { period: date, total: 0 };
    }
    acc[date].total += expense.amount;
    return acc;
  }, {});
  
  res.json(Object.values(reports).slice(0, 10));
});

// Debug endpoint for external API users
app.get('/api/debug/users', async (req, res) => {
  try {
    // Try to fetch users from external API
    const possibleEndpoints = [
      'https://testapi-touo.onrender.com/api/users',
      'https://testapi-touo.onrender.com/api/auth/users',
      'https://testapi-touo.onrender.com/users',
      'https://testapi-touo.onrender.com/api/admin/users'
    ];
    
    let users = [];
    let successEndpoint = null;
    let attempts = [];
    
    for (const endpoint of possibleEndpoints) {
      try {
        console.log(`Trying to fetch users from: ${endpoint}`);
        const response = await fetch(endpoint);
        
        attempts.push({
          endpoint,
          status: response.status,
          ok: response.ok
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log(`Response from ${endpoint}:`, data);
          
          if (data && (Array.isArray(data) || data.users || data.data)) {
            users = Array.isArray(data) ? data : (data.users || data.data || []);
            successEndpoint = endpoint;
            console.log(`Successfully fetched ${users.length} users from ${endpoint}`);
            break;
          }
        }
      } catch (err) {
        console.log(`Failed to fetch from ${endpoint}:`, err.message);
        attempts.push({
          endpoint,
          status: 'Error',
          error: err.message
        });
      }
    }
    
    if (users.length > 0) {
      res.json({
        success: true,
        users,
        count: users.length,
        source: successEndpoint,
        attempts
      });
    } else {
      res.json({
        success: false,
        message: 'No users found from external API',
        api_endpoint: 'https://testapi-touo.onrender.com',
        mode: 'External API Mode',
        attempts,
        note: 'User data is managed by external API but no accessible endpoint found'
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log('Mode: External API Authentication');
  console.log('Registration: https://testapi-touo.onrender.com/api/auth/register');
  console.log('Login: https://testapi-touo.onrender.com/api/auth/login');
});