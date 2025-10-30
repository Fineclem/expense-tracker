# Design Document

## Overview

The Expense Tracker is a full-stack web application built with Node.js/Express backend, SQLite database, and vanilla JavaScript frontend. The system provides secure user authentication, expense management with categorization, and comprehensive reporting capabilities. The architecture follows a RESTful API design pattern with JWT-based authentication and responsive Bootstrap UI.

## Architecture

### System Architecture

```mermaid
graph TB
    A[Web Browser] --> B[Frontend - HTML/CSS/JS]
    B --> C[Express.js Server]
    C --> D[SQLite Database]
    C --> E[JWT Authentication]
    C --> F[bcrypt Password Hashing]
    
    subgraph "Frontend Components"
        B1[Authentication Forms]
        B2[Expense Entry Form]
        B3[Dashboard/Reports]
        B4[Expense List View]
    end
    
    subgraph "Backend API Endpoints"
        C1[/api/signup]
        C2[/api/login]
        C3[/api/expenses]
        C4[/api/reports]
    end
    
    subgraph "Database Tables"
        D1[users]
        D2[expenses]
    end
```

### Technology Stack

- **Frontend**: HTML5, CSS3 (Bootstrap 5), Vanilla JavaScript, jQuery
- **Backend**: Node.js, Express.js
- **Database**: SQLite3
- **Authentication**: JWT (JSON Web Tokens), bcryptjs for password hashing
- **Development**: npm for package management

### Security Architecture

- Password hashing using bcryptjs with salt rounds
- JWT tokens for stateless authentication
- CORS enabled for cross-origin requests
- SQL injection prevention through prepared statements
- Input validation on both client and server sides

## Components and Interfaces

### Frontend Components

#### 1. Authentication Component
- **Purpose**: Handle user registration and login
- **Files**: `signup.html`, `login.html`, `assets/js/auth.js` (logic)
- **Features**:
  - Separate pages for signup and login forms
  - Client-side form validation
  - Token storage in localStorage
  - Navigation between authentication pages
  - Automatic redirect to dashboard after successful authentication

#### 2. Expense Management Component
- **Purpose**: Add, view, and manage expense entries
- **Features**:
  - Expense entry form with amount, category, date, note
  - Real-time expense list display
  - Category dropdown with predefined options
  - Date picker with current date default

#### 3. Reporting Component
- **Purpose**: Display expense summaries and analytics
- **Features**:
  - Daily, weekly, monthly report generation
  - Interactive period selection buttons
  - Formatted report display with totals
  - Category-wise breakdowns

#### 4. Dashboard Component
- **Purpose**: Main application interface after login
- **Features**:
  - Unified view of expense entry and reports
  - Recent expenses list
  - User session management
  - Logout functionality

### Backend API Interfaces

#### Authentication Endpoints

```javascript
POST /api/signup
Request: { name: string, email: string, password: string }
Response: { token: string, user: { id, name, email } }

POST /api/login
Request: { email: string, password: string }
Response: { token: string, user: { id, name, email } }

GET /api/me
Headers: { Authorization: "Bearer <token>" }
Response: { user: { id, name, email } }
```

#### Expense Management Endpoints

```javascript
POST /api/expenses
Headers: { Authorization: "Bearer <token>" }
Request: { amount: number, category: string, note: string, date: string }
Response: { id, user_id, amount, category, note, date }

GET /api/expenses/list
Headers: { Authorization: "Bearer <token>" }
Response: [{ id, amount, category, note, date, created_at }]
```

#### Reporting Endpoints

```javascript
GET /api/reports?period=daily|weekly|monthly
Headers: { Authorization: "Bearer <token>" }
Response: [{ period: string, total: number }]
```

### Middleware Components

#### 1. Authentication Middleware
- **Purpose**: Validate JWT tokens for protected routes
- **Implementation**: `authMiddleware` function
- **Features**:
  - Token extraction from Authorization header
  - JWT verification and payload extraction
  - User context injection into request object

#### 2. CORS Middleware
- **Purpose**: Enable cross-origin resource sharing
- **Implementation**: Express CORS middleware
- **Configuration**: Allow all origins for development

## Data Models

### Database Schema

#### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
```

#### Expenses Table
```sql
CREATE TABLE expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    category TEXT,
    note TEXT,
    date TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
);
```

### Data Relationships

- **One-to-Many**: User → Expenses (one user can have many expenses)
- **Foreign Key Constraint**: expenses.user_id references users.id
- **Data Isolation**: Users can only access their own expense data

### Data Validation Rules

#### User Data
- **Name**: Required, non-empty string
- **Email**: Required, valid email format, unique across system
- **Password**: Required, minimum 8 characters (to be enhanced with complexity rules)

#### Expense Data
- **Amount**: Required, positive number with up to 2 decimal places
- **Category**: Optional, defaults to "Other" if not provided
- **Date**: Required, ISO date format (YYYY-MM-DD)
- **Note**: Optional, text field for additional details

### Predefined Categories
- Food
- Transportation
- Entertainment
- Utilities
- Healthcare
- Shopping
- Other (default)

## Error Handling

### Client-Side Error Handling

#### Form Validation Errors
- **Implementation**: HTML5 validation attributes + JavaScript validation
- **User Feedback**: Bootstrap form validation classes and messages
- **Prevention**: Disable submit buttons during processing

#### API Communication Errors
- **Network Errors**: Display user-friendly messages for connection issues
- **Authentication Errors**: Automatic logout and redirect to login form
- **Validation Errors**: Display server-provided error messages

### Server-Side Error Handling

#### Authentication Errors
```javascript
// Missing/Invalid Token
Status: 401 Unauthorized
Response: { error: "Missing authorization header" | "Invalid token" }

// Invalid Credentials
Status: 400 Bad Request
Response: { error: "Invalid credentials" }
```

#### Validation Errors
```javascript
// Missing Required Fields
Status: 400 Bad Request
Response: { error: "Missing fields" | "Amount required" }

// Duplicate Email
Status: 400 Bad Request
Response: { error: "Email already in use" }
```

#### Database Errors
```javascript
// General Database Error
Status: 500 Internal Server Error
Response: { error: "DB error" }
```

### Error Recovery Strategies

1. **Graceful Degradation**: Application continues to function with reduced features
2. **Retry Logic**: Automatic retry for transient network errors
3. **User Guidance**: Clear error messages with suggested actions
4. **Logging**: Server-side error logging for debugging (to be implemented)

## Testing Strategy

### Unit Testing Approach

#### Backend Testing
- **Framework**: Jest or Mocha (to be implemented)
- **Coverage Areas**:
  - Authentication middleware functionality
  - Password hashing and verification
  - JWT token generation and validation
  - Database query functions
  - API endpoint logic

#### Frontend Testing
- **Framework**: Jest with jsdom or Cypress (to be implemented)
- **Coverage Areas**:
  - Form validation logic
  - API communication functions
  - UI state management
  - Local storage operations

### Integration Testing

#### API Integration Tests
- **Scope**: End-to-end API workflow testing
- **Test Cases**:
  - Complete user registration and login flow
  - Expense CRUD operations with authentication
  - Report generation with various date ranges
  - Error handling for invalid inputs

#### Database Integration Tests
- **Scope**: Database operations and data integrity
- **Test Cases**:
  - User creation and uniqueness constraints
  - Expense data persistence and retrieval
  - Foreign key relationships
  - Data isolation between users

### Manual Testing Procedures

#### User Acceptance Testing
1. **Registration Flow**: Test complete signup process with various inputs
2. **Authentication Flow**: Test login, logout, and session management
3. **Expense Management**: Test adding, viewing, and managing expenses
4. **Reporting**: Test all report types with different date ranges
5. **Cross-Browser Testing**: Verify functionality across major browsers

#### Security Testing
1. **Authentication Security**: Test JWT token handling and expiration
2. **Data Access Control**: Verify users can only access their own data
3. **Input Validation**: Test SQL injection and XSS prevention
4. **Password Security**: Verify password hashing and strength requirements

### Performance Testing

#### Load Testing Scenarios
- **Concurrent Users**: Test system behavior with multiple simultaneous users
- **Database Performance**: Test query performance with large datasets
- **API Response Times**: Measure and optimize endpoint response times

#### Optimization Strategies
- **Database Indexing**: Add indexes on frequently queried columns
- **Caching**: Implement caching for frequently accessed data
- **Query Optimization**: Optimize SQL queries for better performance

## Implementation Considerations

### Security Enhancements
- Implement password complexity requirements
- Add rate limiting for API endpoints
- Implement HTTPS in production
- Add input sanitization and validation
- Implement proper session management

### Scalability Considerations
- Database connection pooling for high concurrency
- Horizontal scaling with load balancers
- Database migration to PostgreSQL for production
- Implement caching layer (Redis)

### User Experience Improvements
- Add expense editing and deletion functionality
- Implement expense search and filtering
- Add data export capabilities (CSV, PDF)
- Implement responsive design for mobile devices
- Add data visualization charts for reports

### Monitoring and Logging
- Implement structured logging with Winston
- Add application performance monitoring
- Implement error tracking and alerting
- Add user activity analytics