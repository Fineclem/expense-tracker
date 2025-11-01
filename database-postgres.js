const { Pool } = require('pg');

// PostgreSQL configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database and tables
async function initializeDatabase() {
  try {
    console.log('Connecting to PostgreSQL database...');
    
    // Test connection
    const client = await pool.connect();
    console.log('Connected to PostgreSQL database successfully');
    
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DECIMAL(10, 2) NOT NULL,
        category VARCHAR(100),
        note TEXT,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Create budgets table
    await client.query(`
      CREATE TABLE IF NOT EXISTS budgets (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        monthly_budget DECIMAL(10, 2) DEFAULT 1000.00,
        weekly_budget DECIMAL(10, 2) DEFAULT 250.00,
        daily_budget DECIMAL(10, 2) DEFAULT 35.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    client.release();
    console.log('Database tables initialized successfully');
    
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Database helper functions
const db = {
  // Execute query
  async query(sql, params = []) {
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  },
  
  // Get single row
  async get(sql, params = []) {
    try {
      const result = await pool.query(sql, params);
      return result.rows[0] || null;
    } catch (error) {
      console.error('Database get error:', error);
      throw error;
    }
  },
  
  // Get all rows
  async all(sql, params = []) {
    try {
      const result = await pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('Database all error:', error);
      throw error;
    }
  },
  
  // Insert and return ID
  async insert(sql, params = []) {
    try {
      const result = await pool.query(sql + ' RETURNING id', params);
      return result.rows[0].id;
    } catch (error) {
      console.error('Database insert error:', error);
      throw error;
    }
  }
};

module.exports = { db, initializeDatabase };